import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ActivitiesService } from '../../activities/activities.service';
import { BountyActivities } from '../../activities/helpers/activity-helper';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BountyNotifications } from '../../notifications/helpers/notification-helper';
import { NotificationsService } from '../../notifications/notifications.service';
import { ReputationService } from '../../reputation/reputation.service';

interface BountyWinnerJobData {
  bountyId: string;
  winners: Array<{
    userId: string;
    position: number;
    payoutAmount: number;
  }>;
  bountyTitle: string;
  currency: string;
  totalReward: number;
}

@Injectable()
@Processor('bounty-winner')
export class BountyWinnerWorker extends WorkerHost {
  private readonly logger = new Logger(BountyWinnerWorker.name);

  constructor(
    private prisma: PrismaService,
    private reputationService: ReputationService,
    private notificationsService: NotificationsService,
    private activitiesService: ActivitiesService,
  ) {
    super();
  }

  async process(job: Job<BountyWinnerJobData>): Promise<any> {
    const { bountyId, winners, bountyTitle, currency } = job.data;

    this.logger.log(
      `Processing bounty winner job for bounty ${bountyId} with ${winners.length} winners`,
    );

    const results: Array<{
      userId: string;
      position: number;
      success: boolean;
      error?: string;
    }> = [];

    for (const winner of winners) {
      try {
        // Create winner record
        await this.prisma.bountyWinner.create({
          data: {
            bountyId,
            userId: winner.userId,
            position: winner.position,
            awardedAt: new Date(),
          },
        });

        this.logger.log(
          `Created winner record for user ${winner.userId} at position ${winner.position}`,
        );

        // Award reputation based on position
        try {
          let reputationAction = 'BOUNTY_WIN_FIRST';
          if (winner.position === 2) reputationAction = 'BOUNTY_WIN_SECOND';
          else if (winner.position === 3) reputationAction = 'BOUNTY_WIN_THIRD';

          await this.reputationService.addReputation(
            winner.userId,
            reputationAction,
            {
              bountyId,
              bountyTitle,
              position: winner.position,
              reward: winner.payoutAmount,
              currency,
            },
          );

          this.logger.log(
            `Added reputation for winner ${winner.userId} (${reputationAction})`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to add reputation for winner ${winner.userId}`,
            error,
          );
        }

        // Send notification to winner
        try {
          await this.notificationsService.sendNotification(
            BountyNotifications.bountyWinner(
              winner.userId,
              bountyTitle,
              winner.position,
            ),
          );

          this.logger.log(`Sent notification to winner ${winner.userId}`);
        } catch (error) {
          this.logger.error(
            `Failed to send notification to winner ${winner.userId}`,
            error,
          );
        }

        // Record activity for bounty win
        try {
          await this.activitiesService.recordActivity(
            BountyActivities.won(
              winner.userId,
              bountyId,
              bountyTitle,
              winner.position,
              winner.payoutAmount.toString(),
              currency,
            ),
          );

          this.logger.log(`Recorded activity for winner ${winner.userId}`);
        } catch (error) {
          this.logger.error(
            `Failed to record activity for winner ${winner.userId}`,
            error,
          );
        }

        results.push({
          userId: winner.userId,
          position: winner.position,
          success: true,
        });
      } catch (error) {
        this.logger.error(
          `Failed to process winner ${winner.userId}`,
          error.stack,
        );
        results.push({
          userId: winner.userId,
          position: winner.position,
          success: false,
          error: error.message,
        });
      }
    }

    this.logger.log(
      `Completed bounty winner processing for bounty ${bountyId}. Successful: ${results.filter((r) => r.success).length}/${winners.length}`,
    );

    return {
      bountyId,
      results,
      totalProcessed: winners.length,
      successful: results.filter((r) => r.success).length,
    };
  }
}
