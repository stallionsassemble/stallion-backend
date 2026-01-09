import { PrismaService } from '../prisma/prisma.service';
import { calculateUsdValue } from './token-price.util';

/**
 * Calculates the total earnings for a user in USD
 * This includes earnings from bounty wins and completed project milestones
 * If USD value is not stored, it calculates based on current token price
 * @param prisma - PrismaService instance
 * @param userId - The user's ID
 * @param ownerId - Optional: Filter earnings by a specific project/bounty owner
 * @returns Total earnings in USD as a string formatted to 2 decimal places
 */
export async function calculateUserTotalEarnings(
  prisma: PrismaService,
  userId: string,
  ownerId?: string,
): Promise<string> {
  // Calculate earnings from bounty wins
  const bountyWins = await prisma.bountyWinner.findMany({
    where: {
      userId,
      ...(ownerId && {
        bounty: {
          ownerId,
        },
      }),
    },
    select: {
      usdValueAtCompletion: true,
      position: true,
      bounty: {
        select: {
          reward: true,
          rewardDistribution: true,
          rewardCurrency: true,
        },
      },
    },
  });

  let totalBountyEarnings = 0;
  for (const win of bountyWins) {
    if (win.usdValueAtCompletion) {
      // Use stored USD value
      totalBountyEarnings += parseFloat(win.usdValueAtCompletion.toString());
    } else {
      // Calculate USD value based on current token price
      const reward = parseFloat(win.bounty.reward);
      const distribution = win.bounty.rewardDistribution as Array<{
        rank: number;
        percentage: number;
      }>;
      const positionReward = distribution.find((d) => d.rank === win.position);
      const percentage = positionReward?.percentage || 0;
      const tokenAmount = (reward * percentage) / 100;

      const usdValue = await calculateUsdValue(
        tokenAmount.toString(),
        win.bounty.rewardCurrency || 'XLM',
      );
      totalBountyEarnings += usdValue;
    }
  }

  // Calculate earnings from project milestones
  const paidMilestones = await prisma.userMilestone.findMany({
    where: {
      contributorId: userId,
      ...(ownerId && {
        application: {
          project: {
            ownerId,
          },
        },
      }),
      paidAt: {
        not: null,
      },
    },
    select: {
      usdValueAtCompletion: true,
      milestone: {
        select: {
          amount: true,
          project: {
            select: {
              currency: true,
            },
          },
        },
      },
    },
  });

  let totalProjectEarnings = 0;
  for (const milestone of paidMilestones) {
    if (milestone.usdValueAtCompletion) {
      // Use stored USD value
      totalProjectEarnings += parseFloat(
        milestone.usdValueAtCompletion.toString(),
      );
    } else {
      // Calculate USD value based on current token price
      const usdValue = await calculateUsdValue(
        milestone.milestone.amount,
        milestone.milestone.project.currency,
      );
      totalProjectEarnings += usdValue;
    }
  }

  const totalEarnings = totalBountyEarnings + totalProjectEarnings;
  return totalEarnings.toFixed(2);
}

/**
 * Calculates earnings breakdown for a user
 * @param prisma - PrismaService instance
 * @param userId - The user's ID
 * @param ownerId - Optional: Filter earnings by a specific project/bounty owner
 * @returns Breakdown of earnings by source
 */
export async function calculateUserEarningsBreakdown(
  prisma: PrismaService,
  userId: string,
  ownerId?: string,
): Promise<{
  totalEarnings: string;
  bountyEarnings: string;
  projectEarnings: string;
}> {
  // Calculate earnings from bounty wins
  const bountyWins = await prisma.bountyWinner.findMany({
    where: {
      userId,
      ...(ownerId && {
        bounty: {
          ownerId,
        },
      }),
    },
    select: {
      usdValueAtCompletion: true,
      position: true,
      bounty: {
        select: {
          reward: true,
          rewardDistribution: true,
          rewardCurrency: true,
        },
      },
    },
  });

  let totalBountyEarnings = 0;
  for (const win of bountyWins) {
    if (win.usdValueAtCompletion) {
      // Use stored USD value
      totalBountyEarnings += parseFloat(win.usdValueAtCompletion.toString());
    } else {
      // Calculate USD value based on current token price
      const reward = parseFloat(win.bounty.reward);
      const distribution = win.bounty.rewardDistribution as Array<{
        rank: number;
        percentage: number;
      }>;
      const positionReward = distribution.find((d) => d.rank === win.position);
      const percentage = positionReward?.percentage || 0;
      const tokenAmount = (reward * percentage) / 100;

      const usdValue = await calculateUsdValue(
        tokenAmount.toString(),
        win.bounty.rewardCurrency || 'XLM',
      );
      totalBountyEarnings += usdValue;
    }
  }

  // Calculate earnings from project milestones
  const paidMilestones = await prisma.userMilestone.findMany({
    where: {
      contributorId: userId,
      ...(ownerId && {
        application: {
          project: {
            ownerId,
          },
        },
      }),
      paidAt: {
        not: null,
      },
    },
    select: {
      usdValueAtCompletion: true,
      milestone: {
        select: {
          amount: true,
          project: {
            select: {
              currency: true,
            },
          },
        },
      },
    },
  });

  let totalProjectEarnings = 0;
  for (const milestone of paidMilestones) {
    if (milestone.usdValueAtCompletion) {
      // Use stored USD value
      totalProjectEarnings += parseFloat(
        milestone.usdValueAtCompletion.toString(),
      );
    } else {
      // Calculate USD value based on current token price
      const usdValue = await calculateUsdValue(
        milestone.milestone.amount,
        milestone.milestone.project.currency,
      );
      totalProjectEarnings += usdValue;
    }
  }

  const totalEarnings = totalBountyEarnings + totalProjectEarnings;

  return {
    totalEarnings: totalEarnings.toFixed(2),
    bountyEarnings: totalBountyEarnings.toFixed(2),
    projectEarnings: totalProjectEarnings.toFixed(2),
  };
}
