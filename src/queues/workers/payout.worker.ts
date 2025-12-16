import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { TxState, TxType } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { generateIdempotencyKey } from '../../common/utils/idempotency.util';
import { NotificationsService } from '../../notifications/notifications.service';
import { PointsService } from '../../points/points.service';

interface PayoutJobData {
  bountyId?: string;
  hackathonId?: string;
  winnerId: string;
  amount: number;
  currency: string;
  position: number;
  type: 'bounty' | 'hackathon';
}

@Injectable()
@Processor('payout')
export class PayoutWorker extends WorkerHost {
  private readonly logger = new Logger(PayoutWorker.name);

  constructor(
    private prisma: PrismaService,
    private pointsService: PointsService,
    private notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<PayoutJobData>): Promise<any> {
    const {
      winnerId,
      amount,
      currency,
      position,
      type,
      bountyId,
      hackathonId,
    } = job.data;

    this.logger.log(
      `Processing ${type} payout for winner ${winnerId}: ${amount} ${currency} (position ${position})`,
    );

    try {
      // 1. Verify winner exists
      const winner = await this.prisma.user.findUnique({
        where: { id: winnerId },
        include: { wallet: true },
      });

      if (!winner || !winner.wallet) {
        throw new Error(`Winner ${winnerId} or wallet not found`);
      }

      // 2. Verify bounty/hackathon winner record
      if (type === 'bounty' && bountyId) {
        const bountyWinner = await this.prisma.bountyWinner.findFirst({
          where: {
            bountyId,
            userId: winnerId,
          },
        });

        if (!bountyWinner) {
          throw new Error(
            `Bounty winner record not found for bounty ${bountyId} and user ${winnerId}`,
          );
        }

        // Check if already awarded
        if (bountyWinner.awardedAt) {
          this.logger.warn(
            `Bounty payout already processed for ${winnerId} at ${bountyWinner.awardedAt.toISOString()}`,
          );
          return { success: false, reason: 'Already awarded' };
        }
      }

      // 3. Create payout transaction and update wallet atomically
      const transaction = await this.prisma.$transaction(async (tx) => {
        // Create payout transaction
        const payoutTx = await tx.transaction.create({
          data: {
            walletId: winner.wallet!.id,
            type: TxType.PAYOUT,
            amount,
            currency,
            state: TxState.COMPLETED,
            idempotencyKey: generateIdempotencyKey(),
            note: `${type === 'bounty' ? 'Bounty' : 'Hackathon'} reward - Position ${position}`,
            metadata: {
              [type === 'bounty' ? 'bountyId' : 'hackathonId']:
                bountyId || hackathonId,
              position,
              type,
            },
          },
        });

        // Update wallet balance
        await tx.wallet.update({
          where: { id: winner.wallet!.id },
          data: {
            balance: {
              increment: amount,
            },
          },
        });

        // Mark bounty winner as awarded
        if (type === 'bounty' && bountyId) {
          await tx.bountyWinner.updateMany({
            where: {
              bountyId,
              userId: winnerId,
            },
            data: {
              awardedAt: new Date(),
            },
          });
        }

        return payoutTx;
      });

      this.logger.log(
        `Payout transaction ${transaction.id} created for winner ${winnerId}`,
      );

      // 4. Award points to winner
      try {
        const pointsAmount =
          position === 1 ? 100 : position === 2 ? 50 : position === 3 ? 25 : 10;
        await this.pointsService.addPoints(
          winnerId,
          pointsAmount,
          type === 'bounty' ? 'BOUNTY_WIN' : 'HACKATHON_WIN',
          `Won ${position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`} place`,
        );
        this.logger.log(`Points awarded to winner ${winnerId}`);
      } catch (error) {
        this.logger.error(
          `Failed to award points to winner ${winnerId}: ${error.message}`,
        );
        // Don't fail the entire payout if points fail
      }

      // 5. Send notification
      try {
        await this.notificationsService.sendNotification({
          userId: winnerId,
          type:
            type === 'bounty' ? 'BOUNTY_WINNER' : 'HACKATHON_WINNER_ANNOUNCED',
          title: `Congratulations! You won ${position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`} place`,
          message: `You've been awarded ${amount} ${currency}`,
          data: {
            [type === 'bounty' ? 'bountyId' : 'hackathonId']:
              bountyId || hackathonId,
            amount,
            currency,
            position,
            transactionId: transaction.id,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send notification to winner ${winnerId}: ${error.message}`,
        );
        // Don't fail the entire payout if notification fails
      }

      this.logger.log(
        `Payout completed successfully for winner ${winnerId}: ${amount} ${currency}`,
      );

      return {
        success: true,
        transactionId: transaction.id,
        winnerId,
        amount,
      };
    } catch (error) {
      this.logger.error(
        `Payout failed for winner ${winnerId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
