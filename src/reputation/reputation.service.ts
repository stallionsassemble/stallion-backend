import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

    return reputation;
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
            },
          },
        },
      }),
      this.prisma.userReputation.count(),
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
