import { Injectable } from '@nestjs/common';
import { RewardDistributionItem } from 'src/bounties/dto';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  ContributorStatsDto,
  ProjectOwnerStatsDto,
} from './dto/dashboard-stats.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getContributorStats(userId: string): Promise<ContributorStatsDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Calculate total earnings from bounties using BountyWinner
    const bountyWins = await this.prisma.bountyWinner.findMany({
      where: {
        userId,
      },
      include: {
        bounty: {
          select: {
            reward: true,
            rewardDistribution: true,
          },
        },
      },
    });

    let totalBountyEarnings = 0;
    let currentMonthBountyEarnings = 0;
    let lastMonthBountyEarnings = 0;

    for (const win of bountyWins) {
      const reward = parseFloat(win.bounty.reward);
      const distribution = win.bounty
        .rewardDistribution as unknown as RewardDistributionItem[];

      // Find the percentage for this position
      const positionReward = distribution.find((d) => d.rank === win.position);
      const percentage = positionReward?.percentage || 0;

      const earnings = (reward * percentage) / 100;
      totalBountyEarnings += earnings;

      if (win.awardedAt) {
        const awardDate = new Date(win.awardedAt);
        if (awardDate >= startOfCurrentMonth) {
          currentMonthBountyEarnings += earnings;
        } else if (
          awardDate >= startOfLastMonth &&
          awardDate <= endOfLastMonth
        ) {
          lastMonthBountyEarnings += earnings;
        }
      }
    }

    // Calculate total earnings from projects (paid user milestones)
    const userMilestones = await this.prisma.userMilestone.findMany({
      where: {
        contributorId: userId,
        paidAt: { not: null },
      },
      include: {
        milestone: true,
      },
    });

    let totalProjectEarnings = 0;
    let currentMonthProjectEarnings = 0;
    let lastMonthProjectEarnings = 0;

    for (const userMilestone of userMilestones) {
      const amount = parseFloat(userMilestone.milestone.amount);
      totalProjectEarnings += amount;

      if (userMilestone.paidAt) {
        const paidDate = new Date(userMilestone.paidAt);
        if (paidDate >= startOfCurrentMonth) {
          currentMonthProjectEarnings += amount;
        } else if (paidDate >= startOfLastMonth && paidDate <= endOfLastMonth) {
          lastMonthProjectEarnings += amount;
        }
      }
    }

    const totalEarnings = totalBountyEarnings + totalProjectEarnings;
    const currentMonthEarnings =
      currentMonthBountyEarnings + currentMonthProjectEarnings;
    const lastMonthEarnings =
      lastMonthBountyEarnings + lastMonthProjectEarnings;

    // Calculate percentage change
    let earningsPercentageChange = 0;
    if (lastMonthEarnings > 0) {
      earningsPercentageChange =
        ((currentMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 100;
    } else if (currentMonthEarnings > 0) {
      earningsPercentageChange = 100;
    }

    // Count active bounties (bounties with submissions that are ACTIVE)
    const activeBounties = await this.prisma.bountySubmission.count({
      where: {
        userId,
        bounty: {
          status: 'ACTIVE',
        },
      },
    });

    // Count completed bounties (bounties with submissions that are COMPLETED)
    const completedBounties = await this.prisma.bountySubmission.count({
      where: {
        userId,
        bounty: {
          status: 'COMPLETED',
        },
      },
    });

    return {
      totalEarnings: totalEarnings.toFixed(2),
      earningsPercentageChange: parseFloat(earningsPercentageChange.toFixed(2)),
      activeBounties,
      completedBounties,
    };
  }

  async getProjectOwnerStats(userId: string): Promise<ProjectOwnerStatsDto> {
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Count total bounties created
    const totalBountiesCreated = await this.prisma.bounty.count({
      where: {
        ownerId: userId,
      },
    });

    // Calculate total paid out from bounties using BountyWinner
    const bountyWinners = await this.prisma.bountyWinner.findMany({
      where: {
        bounty: {
          ownerId: userId,
        },
      },
      include: {
        bounty: {
          select: {
            reward: true,
            rewardDistribution: true,
          },
        },
      },
    });

    let totalBountyPaidOut = 0;
    let currentMonthBountyPaidOut = 0;
    let lastMonthBountyPaidOut = 0;

    for (const winner of bountyWinners) {
      const reward = parseFloat(winner.bounty.reward);
      const distribution = winner.bounty.rewardDistribution as any[];

      // Find the percentage for this position
      const positionReward = distribution.find(
        (d) => d.rank === winner.position,
      );
      const percentage = positionReward?.percentage || 0;

      const paidAmount = (reward * percentage) / 100;
      totalBountyPaidOut += paidAmount;

      if (winner.awardedAt) {
        const awardDate = new Date(winner.awardedAt);
        if (awardDate >= startOfCurrentMonth) {
          currentMonthBountyPaidOut += paidAmount;
        } else if (
          awardDate >= startOfLastMonth &&
          awardDate <= endOfLastMonth
        ) {
          lastMonthBountyPaidOut += paidAmount;
        }
      }
    }

    // Calculate total paid out from projects (paid user milestones)
    const paidUserMilestones = await this.prisma.userMilestone.findMany({
      where: {
        milestone: {
          project: {
            ownerId: userId,
          },
        },
        paidAt: { not: null },
      },
      include: {
        milestone: true,
      },
    });

    let totalProjectPaidOut = 0;
    let currentMonthProjectPaidOut = 0;
    let lastMonthProjectPaidOut = 0;

    for (const userMilestone of paidUserMilestones) {
      const amount = parseFloat(userMilestone.milestone.amount);
      totalProjectPaidOut += amount;

      if (userMilestone.paidAt) {
        const paidDate = new Date(userMilestone.paidAt);
        if (paidDate >= startOfCurrentMonth) {
          currentMonthProjectPaidOut += amount;
        } else if (paidDate >= startOfLastMonth && paidDate <= endOfLastMonth) {
          lastMonthProjectPaidOut += amount;
        }
      }
    }

    const totalPaidOut = totalBountyPaidOut + totalProjectPaidOut;
    const currentMonthPaidOut =
      currentMonthBountyPaidOut + currentMonthProjectPaidOut;
    const lastMonthPaidOut = lastMonthBountyPaidOut + lastMonthProjectPaidOut;

    // Calculate percentage change
    let paidOutPercentageChange = 0;
    if (lastMonthPaidOut > 0) {
      paidOutPercentageChange =
        ((currentMonthPaidOut - lastMonthPaidOut) / lastMonthPaidOut) * 100;
    } else if (currentMonthPaidOut > 0) {
      paidOutPercentageChange = 100;
    }

    // Calculate pending payments
    // User milestones on projects owned by user that are APPROVED but not yet paid
    const pendingUserMilestones = await this.prisma.userMilestone.findMany({
      where: {
        milestone: {
          project: {
            ownerId: userId,
          },
        },
        status: 'APPROVED',
        paidAt: null,
      },
      include: {
        milestone: true,
      },
    });

    let pendingPayments = 0;
    for (const userMilestone of pendingUserMilestones) {
      pendingPayments += parseFloat(userMilestone.milestone.amount);
    }

    return {
      totalBountiesCreated,
      totalPaidOut: totalPaidOut.toFixed(2),
      paidOutPercentageChange: parseFloat(paidOutPercentageChange.toFixed(2)),
      pendingPayments: pendingPayments.toFixed(2),
    };
  }
}
