import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(action: string, userId?: string, metadata?: Prisma.InputJsonValue) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          userId,
          metadata,
        },
      });

      this.logger.log(`Audit: ${action} by user ${userId || 'system'}`);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
    }
  }

  async getRecentLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUserLogs(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getLogsByAction(action: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { action },
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
