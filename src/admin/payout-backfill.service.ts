import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  MilestoneStatus,
  PayoutSourceType,
  PayoutStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class PayoutBackfillService implements OnModuleInit {
  private readonly logger = new Logger(PayoutBackfillService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.backfillBountyWinnerPayouts();
    await this.backfillMilestonePayouts();
    await this.backfillHackathonWinnerPayouts();
  }

  private async backfillBountyWinnerPayouts(): Promise<void> {
    const winnersWithoutPayout = await this.prisma.bountyWinner.findMany({
      where: {
        payout: null,
      },
      include: {
        bounty: {
          select: {
            id: true,
            reward: true,
            rewardCurrency: true,
            rewardDistribution: true,
          },
        },
      },
    });

    if (winnersWithoutPayout.length === 0) {
      return;
    }

    for (const winner of winnersWithoutPayout) {
      const distribution = winner.bounty.rewardDistribution as Array<{
        rank: number;
        percentage: number;
      }>;
      const percentage =
        distribution.find((entry) => entry.rank === winner.position)
          ?.percentage || 0;
      const totalReward = Number(winner.bounty.reward || 0);
      const payoutAmount = (totalReward * percentage) / 100;

      await this.prisma.payout.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: PayoutSourceType.BOUNTY_WIN,
            sourceId: winner.id,
          },
        },
        update: {
          status: PayoutStatus.COMPLETED,
          token: winner.bounty.rewardCurrency || 'XLM',
          amount: payoutAmount,
          usdAmount: winner.usdValueAtCompletion || null,
          completedAt: winner.awardedAt || new Date(),
          contributorId: winner.userId,
          bountyId: winner.bountyId,
          bountyWinnerId: winner.id,
          metadata: {
            position: winner.position,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
        create: {
          sourceType: PayoutSourceType.BOUNTY_WIN,
          sourceId: winner.id,
          status: PayoutStatus.COMPLETED,
          token: winner.bounty.rewardCurrency || 'XLM',
          amount: payoutAmount,
          usdAmount: winner.usdValueAtCompletion || null,
          requestedAt: winner.awardedAt || new Date(),
          completedAt: winner.awardedAt || new Date(),
          contributorId: winner.userId,
          bountyId: winner.bountyId,
          bountyWinnerId: winner.id,
          metadata: {
            position: winner.position,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log(
      `Backfilled ${winnersWithoutPayout.length} bounty winner payouts`,
    );
  }

  private async backfillMilestonePayouts(): Promise<void> {
    const milestonesWithoutPayout = await this.prisma.userMilestone.findMany({
      where: {
        payout: null,
        status: {
          in: [
            MilestoneStatus.SUBMITTED,
            MilestoneStatus.APPROVED,
            MilestoneStatus.PAID,
          ],
        },
      },
      include: {
        milestone: {
          include: {
            project: {
              select: {
                id: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    if (milestonesWithoutPayout.length === 0) {
      return;
    }

    for (const milestone of milestonesWithoutPayout) {
      const completed = !!milestone.paidAt;
      const requestedAt =
        milestone.submittedAt || milestone.reviewedAt || milestone.createdAt;

      await this.prisma.payout.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: PayoutSourceType.PROJECT_MILESTONE,
            sourceId: milestone.id,
          },
        },
        update: {
          status: completed
            ? PayoutStatus.COMPLETED
            : PayoutStatus.PENDING_APPROVAL,
          token: milestone.milestone.project.currency,
          amount: milestone.milestone.amount,
          usdAmount: completed ? milestone.usdValueAtCompletion || null : null,
          completedAt: completed ? milestone.paidAt : null,
          txHash: completed ? milestone.txHash : null,
          contributorId: milestone.contributorId,
          projectId: milestone.milestone.projectId,
          userMilestoneId: milestone.id,
          metadata: {
            projectMilestoneId: milestone.milestoneId,
            applicationId: milestone.applicationId,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
        create: {
          sourceType: PayoutSourceType.PROJECT_MILESTONE,
          sourceId: milestone.id,
          status: completed
            ? PayoutStatus.COMPLETED
            : PayoutStatus.PENDING_APPROVAL,
          token: milestone.milestone.project.currency,
          amount: milestone.milestone.amount,
          usdAmount: completed ? milestone.usdValueAtCompletion || null : null,
          requestedAt,
          completedAt: completed ? milestone.paidAt : null,
          txHash: completed ? milestone.txHash : null,
          contributorId: milestone.contributorId,
          projectId: milestone.milestone.projectId,
          userMilestoneId: milestone.id,
          metadata: {
            projectMilestoneId: milestone.milestoneId,
            applicationId: milestone.applicationId,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log(
      `Backfilled ${milestonesWithoutPayout.length} milestone payouts`,
    );
  }

  private async backfillHackathonWinnerPayouts(): Promise<void> {
    const winnersWithoutPayout = await this.prisma.hackathonWinner.findMany({
      where: {
        payout: null,
      },
      include: {
        hackathon: {
          select: {
            id: true,
            currency: true,
          },
        },
      },
    });

    if (winnersWithoutPayout.length === 0) {
      return;
    }

    for (const winner of winnersWithoutPayout) {
      const completed = winner.isPaid;
      const requestedAt = winner.createdAt;

      await this.prisma.payout.upsert({
        where: {
          sourceType_sourceId: {
            sourceType: PayoutSourceType.HACKATHON_WIN,
            sourceId: winner.id,
          },
        },
        update: {
          status: completed
            ? PayoutStatus.COMPLETED
            : PayoutStatus.PENDING_APPROVAL,
          token: winner.hackathon.currency,
          amount: winner.prizeAmount,
          usdAmount: winner.usdValueAtCompletion || null,
          completedAt: completed ? winner.paidAt : null,
          txHash: completed ? winner.txHash : null,
          contributorId: winner.userId,
          hackathonId: winner.hackathonId,
          hackathonWinnerId: winner.id,
          metadata: {
            position: winner.position,
            submissionId: winner.submissionId,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
        create: {
          sourceType: PayoutSourceType.HACKATHON_WIN,
          sourceId: winner.id,
          status: completed
            ? PayoutStatus.COMPLETED
            : PayoutStatus.PENDING_APPROVAL,
          token: winner.hackathon.currency,
          amount: winner.prizeAmount,
          usdAmount: winner.usdValueAtCompletion || null,
          requestedAt,
          completedAt: completed ? winner.paidAt : null,
          txHash: completed ? winner.txHash : null,
          contributorId: winner.userId,
          hackathonId: winner.hackathonId,
          hackathonWinnerId: winner.id,
          metadata: {
            position: winner.position,
            submissionId: winner.submissionId,
            source: 'backfill',
          } as Prisma.InputJsonValue,
        },
      });
    }

    this.logger.log(
      `Backfilled ${winnersWithoutPayout.length} hackathon winner payouts`,
    );
  }
}
