import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../../email/email.service';
import { FcmService } from '../fcm.service';
import { NotificationsService } from '../notifications.service';
import {
  EmailNotificationData,
  NotificationPayload,
  PushNotificationData,
} from '../types/notification-payload.type';

@Processor('notifications')
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    private notificationsService: NotificationsService,
    private fcmService: FcmService,
    private emailService: EmailService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case 'send-notification':
        return this.handleSendNotification(job.data);
      case 'send-email':
        return this.handleSendEmail(job.data);
      case 'send-push':
        return this.handleSendPush(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleSendNotification(data: NotificationPayload) {
    try {
      await this.notificationsService.processNotification(data);
      this.logger.log(
        `Successfully processed notification for user ${data.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleSendEmail(data: EmailNotificationData) {
    try {
      await this.emailService.sendEmail(
        data.to,
        data.subject,
        data.template,
        data.context,
      );
      this.logger.log(`Email sent successfully to ${data.to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleSendPush(data: PushNotificationData) {
    try {
      const result = await this.fcmService.sendToMultipleDevices(
        data.tokens,
        data.title,
        data.body,
        data.data,
      );

      this.logger.log(
        `Push notifications sent: ${result.successCount} succeeded, ${result.failureCount} failed`,
      );

      if (result.failureCount > 0) {
        this.logger.warn(
          `${result.failureCount} push notifications failed to send`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send push notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
