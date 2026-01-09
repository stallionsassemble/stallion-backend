import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ReputationLevel } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReputationNotifications } from '../notifications/helpers/notification-helper';
import { NotificationsService } from '../notifications/notifications.service';
import {
  REPUTATION_ACTIONS,
  REPUTATION_BADGES,
  calculateLevel,
} from './reputation.config';

@Injectable()
export class ReputationService {
  private readonly logger = new Logger(ReputationService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getUserReputation(userId: string) {
    let reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
      include: {
        history: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!reputation) {
      reputation = await this.createReputation(userId);
    }

    // Get user rating
    const ratingResult = await this.prisma.userReview.aggregate({
      where: { reviewedUserId: userId },
      _avg: { rating: true },
      _count: true,
    });

    return {
      ...reputation,
      rating: ratingResult._avg.rating || 0,
      totalReviews: ratingResult._count,
    };
  }

  async createReputation(userId: string) {
    return this.prisma.userReputation.create({
      data: {
        userId,
        score: 0,
        level: 'NEWCOMER',
        bountyScore: 0,
        hackathonScore: 0,
        communityScore: 0,
        totalBounties: 0,
        wonBounties: 0,
        totalHackathons: 0,
        wonHackathons: 0,
        forumPosts: 0,
        helpfulVotes: 0,
        badges: [],
      },
      include: {
        history: true,
      },
    });
  }

  async addReputation(
    userId: string,
    actionKey: string,
    metadata?: Record<string, any>,
  ) {
    const action = REPUTATION_ACTIONS[actionKey];
    if (!action) {
      this.logger.warn(`Unknown reputation action: ${actionKey}`);
      return null;
    }

    let reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (!reputation) {
      reputation = await this.createReputation(userId);
    }

    const oldScore = reputation.score;
    const newScore = Math.max(0, oldScore + action.points);
    const oldLevel = reputation.level;
    const newLevel = calculateLevel(newScore);

    // Update category scores
    const categoryUpdates: any = {};
    switch (action.category) {
      case 'BOUNTY':
        categoryUpdates.bountyScore = {
          increment: action.points,
        };
        break;
      case 'HACKATHON':
        categoryUpdates.hackathonScore = {
          increment: action.points,
        };
        break;
      case 'COMMUNITY':
      case 'FORUM':
        categoryUpdates.communityScore = {
          increment: action.points,
        };
        break;
    }

    // Update statistics based on action
    if (actionKey.includes('BOUNTY_SUBMISSION')) {
      categoryUpdates.totalBounties = { increment: 1 };
    } else if (actionKey.includes('BOUNTY_WIN')) {
      categoryUpdates.wonBounties = { increment: 1 };
    } else if (actionKey.includes('HACKATHON_SUBMISSION')) {
      categoryUpdates.totalHackathons = { increment: 1 };
    } else if (actionKey.includes('HACKATHON_WIN')) {
      categoryUpdates.wonHackathons = { increment: 1 };
    } else if (actionKey === 'FORUM_POST') {
      categoryUpdates.forumPosts = { increment: 1 };
    } else if (actionKey === 'FORUM_HELPFUL_VOTE') {
      categoryUpdates.helpfulVotes = { increment: 1 };
    }

    const updatedReputation = await this.prisma.$transaction(async (tx) => {
      // Update reputation
      const updated = await tx.userReputation.update({
        where: { userId },
        data: {
          score: newScore,
          level: newLevel,
          ...categoryUpdates,
        },
      });

      // Add history entry
      await tx.reputationHistory.create({
        data: {
          reputationId: updated.id,
          change: action.points,
          reason: action.description,
          category: action.category,
          metadata: metadata || {},
        },
      });

      return updated;
    });

    // Check for new badges
    if (oldLevel !== newLevel) {
      this.logger.log(
        `User ${userId} leveled up from ${oldLevel} to ${newLevel}`,
      );
      await this.checkLevelBadges(userId, newLevel);

      // Send level up notification
      try {
        await this.notificationsService.sendNotification(
          ReputationNotifications.levelUp(userId, newLevel, {
            oldLevel,
            newLevel,
            score: newScore,
          }),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send level up notification: ${error.message}`,
        );
      }
    }

    await this.checkBadges(userId);

    return updatedReputation;
  }

  async checkBadges(userId: string) {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (!reputation) return;

    const newBadges: string[] = [];

    // First Bounty
    if (
      reputation.totalBounties >= 1 &&
      !reputation.badges.includes(REPUTATION_BADGES.FIRST_BOUNTY.id)
    ) {
      newBadges.push(REPUTATION_BADGES.FIRST_BOUNTY.id);
    }

    // Bounty Master
    if (
      reputation.wonBounties >= 10 &&
      !reputation.badges.includes(REPUTATION_BADGES.BOUNTY_MASTER.id)
    ) {
      newBadges.push(REPUTATION_BADGES.BOUNTY_MASTER.id);
    }

    // Hackathon Hero
    if (
      reputation.wonHackathons >= 5 &&
      !reputation.badges.includes(REPUTATION_BADGES.HACKATHON_HERO.id)
    ) {
      newBadges.push(REPUTATION_BADGES.HACKATHON_HERO.id);
    }

    // Community Champion
    if (
      reputation.helpfulVotes >= 100 &&
      !reputation.badges.includes(REPUTATION_BADGES.COMMUNITY_CHAMPION.id)
    ) {
      newBadges.push(REPUTATION_BADGES.COMMUNITY_CHAMPION.id);
    }

    if (newBadges.length > 0) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: {
          badges: {
            push: newBadges,
          },
        },
      });

      this.logger.log(
        `User ${userId} earned new badges: ${newBadges.join(', ')}`,
      );

      // Send badge earned notifications
      for (const badgeId of newBadges) {
        const badge = Object.values(REPUTATION_BADGES).find(
          (b) => b.id === badgeId,
        );
        if (badge) {
          try {
            await this.notificationsService.sendNotification(
              ReputationNotifications.badgeEarned(
                userId,
                badge.name,
                badge.icon,
                {
                  badgeId: badge.id,
                  badgeName: badge.name,
                  badgeDescription: badge.description,
                },
              ),
            );
          } catch (error) {
            this.logger.error(
              `Failed to send badge notification: ${error.message}`,
            );
          }
        }
      }
    }
  }

  async checkLevelBadges(userId: string, newLevel: string) {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (!reputation) return;

    // Map levels to their corresponding badges
    const levelBadgeMap: Record<string, string> = {
      CONTRIBUTOR: REPUTATION_BADGES.RISING_STAR.id,
      REGULAR: REPUTATION_BADGES.ESTABLISHED_MEMBER.id,
      VETERAN: REPUTATION_BADGES.BATTLE_TESTED.id,
      EXPERT: REPUTATION_BADGES.EXPERT_STATUS.id,
      MASTER: REPUTATION_BADGES.MASTER_CRAFTSMAN.id,
      LEGEND: REPUTATION_BADGES.LEGENDARY_STATUS.id,
    };

    const badgeId = levelBadgeMap[newLevel];

    // Award badge if user reached a milestone level and doesn't have it yet
    if (badgeId && !reputation.badges.includes(badgeId)) {
      await this.prisma.userReputation.update({
        where: { userId },
        data: {
          badges: {
            push: badgeId,
          },
        },
      });

      // Log the achievement in reputation history
      await this.prisma.reputationHistory.create({
        data: {
          reputationId: reputation.id,
          change: 0,
          reason: `Reached ${newLevel} level`,
          category: 'BADGE',
          metadata: {
            badgeId,
            level: newLevel,
          },
        },
      });

      this.logger.log(
        `User ${userId} earned level badge: ${badgeId} for reaching ${newLevel}`,
      );

      // Send badge notification for level milestone badge
      const badge = Object.values(REPUTATION_BADGES).find(
        (b) => b.id === badgeId,
      );
      if (badge) {
        try {
          await this.notificationsService.sendNotification(
            ReputationNotifications.badgeEarned(
              userId,
              badge.name,
              badge.icon,
              {
                badgeId: badge.id,
                badgeName: badge.name,
                badgeDescription: badge.description,
                level: newLevel,
              },
            ),
          );
        } catch (error) {
          this.logger.error(
            `Failed to send level badge notification: ${error.message}`,
          );
        }
      }
    }
  }

  async getLeaderboard(page = 1, limit = 50, category?: string) {
    const orderBy: any = { score: 'desc' };

    if (category === 'bounty') {
      orderBy.bountyScore = 'desc';
    } else if (category === 'hackathon') {
      orderBy.hackathonScore = 'desc';
    } else if (category === 'community') {
      orderBy.communityScore = 'desc';
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.userReputation.findMany({
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              skills: true,
            },
          },
        },
      }),
      this.prisma.userReputation.count(),
    ]);

    // Enrich data with additional fields
    const enrichedData = await Promise.all(
      data.map(async (entry) => {
        const userId = entry.user.id;

        // Get bounty applications and wins
        const [bountySubmissions, bountyWins] = await Promise.all([
          this.prisma.bountySubmission.count({
            where: { userId },
          }),
          this.prisma.bountyWinner.count({
            where: { userId },
          }),
        ]);

        // Get project applications and wins
        const [projectApplications, projectWins] = await Promise.all([
          this.prisma.projectApplication.count({
            where: { userId },
          }),
          this.prisma.projectApplication.count({
            where: { userId, status: 'ACCEPTED' },
          }),
        ]);

        const totalApplications = bountySubmissions + projectApplications;
        const totalWins = bountyWins + projectWins;

        // Calculate success rate
        const successRate =
          totalApplications > 0
            ? Math.round((totalWins / totalApplications) * 100 * 10) / 10
            : 0;

        // Check if verified (has won at least one bounty or project)
        const isVerified = totalWins > 0;

        // Calculate primary skill
        let primarySkill = entry.user.skills?.[0] || 'N/A';

        if (entry.user.skills && entry.user.skills.length > 0) {
          // Get all bounty and project skills from applications
          const [bountySkills, projectSkills] = await Promise.all([
            this.prisma.bountySubmission.findMany({
              where: { userId },
              include: {
                bounty: {
                  select: { skills: true },
                },
              },
            }),
            this.prisma.projectApplication.findMany({
              where: { userId },
              include: {
                project: {
                  select: { skills: true },
                },
              },
            }),
          ]);

          // Count skill occurrences
          const skillCounts: Record<string, number> = {};
          bountySkills.forEach((sub) => {
            sub.bounty.skills.forEach((skill) => {
              if (entry.user.skills.includes(skill)) {
                skillCounts[skill] = (skillCounts[skill] || 0) + 1;
              }
            });
          });
          projectSkills.forEach((app) => {
            app.project.skills.forEach((skill) => {
              if (entry.user.skills.includes(skill)) {
                skillCounts[skill] = (skillCounts[skill] || 0) + 1;
              }
            });
          });

          // Find most common skill
          const mostCommonSkill = Object.entries(skillCounts).sort(
            ([, a], [, b]) => b - a,
          )[0];
          if (mostCommonSkill) {
            primarySkill = mostCommonSkill[0];
          }
        }

        // Calculate total earnings
        const [bountyEarnings, projectMilestones] = await Promise.all([
          this.prisma.bountyWinner.findMany({
            where: { userId },
            include: {
              bounty: {
                select: { reward: true, rewardDistribution: true },
              },
            },
          }),
          this.prisma.userMilestone.findMany({
            where: {
              contributorId: userId,
              status: 'PAID',
            },
            include: {
              milestone: {
                select: {
                  amount: true,
                },
              },
            },
          }),
        ]);

        let totalEarnings = BigInt(0);

        // Calculate bounty earnings
        bountyEarnings.forEach((winner) => {
          const distribution = winner.bounty.rewardDistribution as any[];
          const positionReward = distribution.find(
            (d) => d.rank === winner.position,
          );
          if (positionReward) {
            const bountyReward = BigInt(winner.bounty.reward);
            const percentage = BigInt(positionReward.percentage);
            totalEarnings += (bountyReward * percentage) / BigInt(100);
          }
        });

        // Add project earnings
        projectMilestones.forEach((userMilestone) => {
          totalEarnings += BigInt(userMilestone.milestone.amount);
        });

        // Get user rating
        const ratingResult = await this.prisma.userReview.aggregate({
          where: { reviewedUserId: userId },
          _avg: { rating: true },
          _count: true,
        });

        return {
          ...entry,
          successRate,
          isVerified,
          primarySkill,
          completedTasksCount: totalWins,
          earnedAmount: totalEarnings.toString(),
          rating: ratingResult._avg.rating || 0,
          totalReviews: ratingResult._count,
        };
      }),
    );

    return {
      data: enrichedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserRank(userId: string) {
    const reputation = await this.getUserReputation(userId);
    if (!reputation) {
      throw new NotFoundException('Reputation not found');
    }

    const rank = await this.prisma.userReputation.count({
      where: {
        score: {
          gt: reputation.score,
        },
      },
    });

    return rank + 1;
  }

  async getRecentEarners(page = 1, limit = 20, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Get users who have earned from bounties or projects in the specified period
    const [bountyWinners, projectEarners] = await Promise.all([
      this.prisma.bountyWinner.findMany({
        where: {
          awardedAt: {
            gte: cutoffDate,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          bounty: {
            select: {
              reward: true,
              rewardDistribution: true,
            },
          },
        },
        orderBy: {
          awardedAt: 'desc',
        },
      }),
      this.prisma.userMilestone.findMany({
        where: {
          paidAt: {
            gte: cutoffDate,
          },
        },
        include: {
          contributor: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          milestone: {
            select: {
              amount: true,
            },
          },
        },
        orderBy: {
          paidAt: 'desc',
        },
      }),
    ]);

    // Aggregate earnings by user
    const userEarningsMap = new Map<
      string,
      {
        userId: string;
        username: string | null;
        firstName: string | null;
        lastName: string | null;
        profilePicture: string | null;
        bountyEarnings: bigint;
        projectEarnings: bigint;
        lastEarnedAt: Date;
        recentWinsCount: number;
      }
    >();

    // Process bounty winners
    for (const winner of bountyWinners) {
      if (!winner.awardedAt) continue;

      const userId = winner.user.id;
      const distribution = winner.bounty.rewardDistribution as any[];
      const positionReward = distribution.find(
        (d) => d.rank === winner.position,
      );

      if (positionReward) {
        const bountyReward = BigInt(winner.bounty.reward);
        const percentage = BigInt(positionReward.percentage);
        const earnings = (bountyReward * percentage) / BigInt(100);

        const existing = userEarningsMap.get(userId);
        if (existing) {
          existing.bountyEarnings += earnings;
          existing.recentWinsCount += 1;
          if (winner.awardedAt > existing.lastEarnedAt) {
            existing.lastEarnedAt = winner.awardedAt;
          }
        } else {
          userEarningsMap.set(userId, {
            userId: winner.user.id,
            username: winner.user.username,
            firstName: winner.user.firstName,
            lastName: winner.user.lastName,
            profilePicture: winner.user.profilePicture,
            bountyEarnings: earnings,
            projectEarnings: BigInt(0),
            lastEarnedAt: winner.awardedAt,
            recentWinsCount: 1,
          });
        }
      }
    }

    // Process project earners
    for (const userMilestone of projectEarners) {
      const userId = userMilestone.contributor.id;
      const earnings = BigInt(userMilestone.milestone.amount);

      const existing = userEarningsMap.get(userId);
      if (existing) {
        existing.projectEarnings += earnings;
        existing.recentWinsCount += 1;
        if (userMilestone.paidAt! > existing.lastEarnedAt) {
          existing.lastEarnedAt = userMilestone.paidAt!;
        }
      } else {
        userEarningsMap.set(userId, {
          userId: userMilestone.contributor.id,
          username: userMilestone.contributor.username,
          firstName: userMilestone.contributor.firstName,
          lastName: userMilestone.contributor.lastName,
          profilePicture: userMilestone.contributor.profilePicture,
          bountyEarnings: BigInt(0),
          projectEarnings: earnings,
          lastEarnedAt: userMilestone.paidAt!,
          recentWinsCount: 1,
        });
      }
    }

    // Convert to array and sort by total earnings
    const earners = Array.from(userEarningsMap.values())
      .map((earner) => ({
        ...earner,
        totalEarnings: earner.bountyEarnings + earner.projectEarnings,
      }))
      .sort((a, b) => {
        const diff = b.totalEarnings - a.totalEarnings;
        return diff > 0 ? 1 : diff < 0 ? -1 : 0;
      });

    // Paginate
    const total = earners.length;
    const skip = (page - 1) * limit;
    const paginatedEarners = earners.slice(skip, skip + limit);

    // Get reputation data for each earner
    const enrichedData = await Promise.all(
      paginatedEarners.map(async (earner) => {
        const reputation = await this.prisma.userReputation.findUnique({
          where: { userId: earner.userId },
        });

        return {
          userId: earner.userId,
          username: earner.username,
          firstName: earner.firstName,
          lastName: earner.lastName,
          profilePicture: earner.profilePicture,
          totalEarnings: earner.totalEarnings.toString(),
          bountyEarnings: earner.bountyEarnings.toString(),
          projectEarnings: earner.projectEarnings.toString(),
          lastEarnedAt: earner.lastEarnedAt,
          recentWinsCount: earner.recentWinsCount,
          level: reputation?.level || ReputationLevel.NEWCOMER,
          isVerified: reputation ? reputation.score > 0 : false,
        };
      }),
    );

    return {
      data: enrichedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReputationHistory(userId: string, page = 1, limit = 50) {
    const reputation = await this.prisma.userReputation.findUnique({
      where: { userId },
    });

    if (!reputation) {
      throw new NotFoundException('Reputation not found');
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.reputationHistory.findMany({
        where: { reputationId: reputation.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.reputationHistory.count({
        where: { reputationId: reputation.id },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBadgeInfo(badgeId: string) {
    const badge = Object.values(REPUTATION_BADGES).find(
      (b) => b.id === badgeId,
    );
    return badge || null;
  }

  async getAllBadges() {
    return Object.values(REPUTATION_BADGES);
  }
}
