import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ActivityType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityPayload } from './types/activity-payload.type';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('activities') private activityQueue: Queue,
  ) {}

  async recordActivity(payload: ActivityPayload) {
    try {
      await this.activityQueue.add('create-activity', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(
        `Activity queued for user ${payload.userId}: ${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue activity: ${error.message}`,
        error.stack,
      );
    }
  }

  async createActivity(payload: ActivityPayload) {
    return this.prisma.activity.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        message: payload.message,
        metadata: payload.metadata,
        bountyId: payload.bountyId,
        projectId: payload.projectId,
        hackathonId: payload.hackathonId,
      },
    });
  }

  async getActivities(params: {
    page?: number;
    limit?: number;
    userId?: string;
    bountyId?: string;
    projectId?: string;
    hackathonId?: string;
    type?: ActivityType;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ActivityWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (params.bountyId) where.bountyId = params.bountyId;
    if (params.projectId) where.projectId = params.projectId;
    if (params.hackathonId) where.hackathonId = params.hackathonId;
    if (params.type) where.type = params.type;

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
              id: true,
              title: true,
              rewardCurrency: true,
            },
          },
          project: {
            select: {
              id: true,
              title: true,
              currency: true,
            },
          },
          hackathon: {
            select: {
              id: true,
              title: true,
              currency: true,
            },
          },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserActivities(userId: string, page = 1, limit = 50) {
    return this.getActivities({ userId, page, limit });
  }

  async getBountyActivities(bountyId: string, page = 1, limit = 50) {
    return this.getActivities({ bountyId, page, limit });
  }

  async getProjectActivities(projectId: string, page = 1, limit = 50) {
    return this.getActivities({ projectId, page, limit });
  }

  async getHackathonActivities(hackathonId: string, page = 1, limit = 50) {
    return this.getActivities({ hackathonId, page, limit });
  }

  async getAllActivities(page = 1, limit = 50) {
    return this.getActivities({ page, limit });
  }
}
