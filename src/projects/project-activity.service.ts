import { Injectable } from '@nestjs/common';
import { ProjectActivityType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ProjectActivityService {
  constructor(private prisma: PrismaService) {}

  async createActivity(params: {
    projectId: string;
    userId: string;
    type: ProjectActivityType;
    message: string;
    metadata?: any;
  }) {
    return this.prisma.projectActivity.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        type: params.type,
        message: params.message,
        metadata: params.metadata,
      },
    });
  }

  async getProjectActivities(projectId: string) {
    return this.prisma.projectActivity.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
