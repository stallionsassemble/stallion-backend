import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class UserSuspensionCron {
  private readonly logger = new Logger(UserSuspensionCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSuspensionExpiry() {
    const now = new Date();

    const result = await this.prisma.user.updateMany({
      where: {
        status: UserStatus.SUSPENDED,
        suspendedUntil: {
          lte: now,
        },
      },
      data: {
        status: UserStatus.ACTIVE,
        suspendedUntil: null,
        suspensionReason: null,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Unsuspended ${result.count} users after expiry`);
    }
  }
}
