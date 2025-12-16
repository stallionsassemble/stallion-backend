import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { FcmService } from './fcm.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationWorker } from './workers/notification.worker';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService, NotificationWorker],
  exports: [NotificationsService, FcmService],
})
export class NotificationsModule {}
