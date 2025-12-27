import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TxState, TxType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class WithdrawalProcessingCron {
  private readonly logger = new Logger(WithdrawalProcessingCron.name);

  constructor(
    @InjectQueue('withdrawal') private withdrawalQueue: Queue,
    private prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleStaleWithdrawals() {
    this.logger.log('Running stale withdrawal processing cron job');

    try {
      // Find pending withdrawals older than 10 minutes
      const staleWithdrawals = await this.prisma.transaction.findMany({
        where: {
          type: TxType.WITHDRAWAL,
          state: TxState.PENDING,
          createdAt: {
            lt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          },
        },
        take: 50,
      });

      if (staleWithdrawals.length === 0) {
        this.logger.log('No stale withdrawals found');
        return;
      }

      this.logger.log(
        `Found ${staleWithdrawals.length} stale withdrawals to process`,
      );

      // Queue each stale withdrawal for processing
      for (const withdrawal of staleWithdrawals) {
        const metadata = withdrawal.metadata as any;

        await this.withdrawalQueue.add(
          'process-withdrawal',
          {
            transactionId: withdrawal.id,
            destination: metadata?.destination,
            amount: Number(withdrawal.amount),
            currency: withdrawal.currency,
            walletId: withdrawal.walletId,
            lockId: metadata?.lockId,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        );

        this.logger.log(
          `Queued stale withdrawal ${withdrawal.id} for processing`,
        );
      }

      this.logger.log(
        `Successfully queued ${staleWithdrawals.length} stale withdrawals`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process stale withdrawals: ${error.message}`,
        error.stack,
      );
    }
  }
}
