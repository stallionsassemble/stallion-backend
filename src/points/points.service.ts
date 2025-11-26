import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { POINTS_CONFIG, PointsAction } from './points.config';

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(private prisma: PrismaService) {}

  async addPoints(
    userId: string,
    amount: number,
    action: string,
    note?: string,
    meta?: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Get or create UserPoints
      let userPoints = await tx.userPoint.findUnique({
        where: { userId },
      });

      if (!userPoints) {
        userPoints = await tx.userPoint.create({
          data: {
            userId,
            total: 0,
          },
        });
      }

      // Create Point entry
      const point = await tx.point.create({
        data: {
          userPointId: userPoints.id,
          amount,
          action,
          note,
          meta,
        },
      });

      // Update total atomically
      await tx.userPoint.update({
        where: { id: userPoints.id },
        data: {
          total: {
            increment: amount,
          },
        },
      });

      this.logger.log(
        `Awarded ${amount} points to user ${userId} for action: ${action}`,
      );

      return point;
    });
  }

  async addPointsForAction(
    userId: string,
    action: PointsAction,
    note?: string,
    meta?: Prisma.InputJsonValue,
  ) {
    const amount = POINTS_CONFIG[action];
    return this.addPoints(userId, amount, action, note, meta);
  }

  async getUserPoints(userId: string) {
    return this.prisma.userPoint.findUnique({
      where: { userId },
      include: {
        points: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 50, // Limit to recent 50 entries
        },
      },
    });
  }

  async getLeaderboard(limit = 10) {
    return this.prisma.userPoint.findMany({
      take: limit,
      orderBy: {
        total: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getUserRank(userId: string): Promise<number> {
    const userPoints = await this.prisma.userPoint.findUnique({
      where: { userId },
    });

    if (!userPoints) {
      return 0;
    }

    const rank = await this.prisma.userPoint.count({
      where: {
        total: {
          gt: userPoints.total,
        },
      },
    });

    return rank + 1;
  }
}
