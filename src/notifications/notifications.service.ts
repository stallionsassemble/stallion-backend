import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationSettings, NotificationType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import {
  NotificationCategory,
  NotificationPayload,
  NotificationTypeToCategory,
} from './types/notification-payload.type';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationQueue: Queue,
  ) {}

  async sendNotification(payload: NotificationPayload) {
    try {
      await this.notificationQueue.add('send-notification', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(
        `Notification queued for user ${payload.userId}: ${payload.type}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async processNotification(payload: NotificationPayload) {
    const settings = await this.getNotificationSettings(payload.userId);
    const category = NotificationTypeToCategory[payload.type];

    const shouldSendInApp = this.shouldSendInApp(
      category,
      settings,
      payload.sendInApp,
    );
    const shouldSendEmail = this.shouldSendEmail(
      category,
      settings,
      payload.sendEmail,
    );
    const shouldSendPush = this.shouldSendPush(
      category,
      settings,
      payload.sendPush,
    );

    if (shouldSendInApp) {
      await this.createInAppNotification(payload);
    }

    if (shouldSendEmail) {
      await this.queueEmailNotification(payload);
    }

    if (shouldSendPush) {
      await this.queuePushNotification(payload);
    }
  }

  private async createInAppNotification(payload: NotificationPayload) {
    try {
      await this.prisma.notification.create({
        data: {
          userId: payload.userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data || {},
        },
      });

      this.logger.log(`In-app notification created for user ${payload.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to create in-app notification: ${error.message}`,
      );
    }
  }

  private async queueEmailNotification(payload: NotificationPayload) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (!user) {
        this.logger.warn(
          `User ${payload.userId} not found for email notification`,
        );
        return;
      }

      await this.notificationQueue.add(
        'send-email',
        {
          to: user.email,
          subject: payload.title,
          template: this.getEmailTemplate(payload.type),
          context: {
            name: user.firstName || user.email,
            title: payload.title,
            message: payload.message,
            data: payload.data,
          },
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log(`Email notification queued for user ${payload.userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue email notification: ${error.message}`);
    }
  }

  private async queuePushNotification(payload: NotificationPayload) {
    try {
      const tokens = await this.prisma.fcmToken.findMany({
        where: { userId: payload.userId },
        select: { token: true },
      });

      if (tokens.length === 0) {
        this.logger.debug(`No FCM tokens found for user ${payload.userId}`);
        return;
      }

      await this.notificationQueue.add(
        'send-push',
        {
          tokens: tokens.map((t) => t.token),
          title: payload.title,
          body: payload.message,
          data: payload.data,
        },
        {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 3000,
          },
        },
      );

      this.logger.log(
        `Push notification queued for ${tokens.length} devices of user ${payload.userId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue push notification: ${error.message}`);
    }
  }

  private shouldSendInApp(
    category: NotificationCategory,
    settings: NotificationSettings,
    override?: boolean,
  ): boolean {
    if (override !== undefined) return override;

    switch (category) {
      case NotificationCategory.CHAT:
        return settings.chatInApp;
      case NotificationCategory.WALLET:
        return settings.walletInApp;
      case NotificationCategory.BOUNTY:
        return settings.bountyInApp;
      case NotificationCategory.FORUM:
        return settings.forumInApp;
      case NotificationCategory.SYSTEM:
        return settings.systemInApp;
      default:
        return true;
    }
  }

  private shouldSendEmail(
    category: NotificationCategory,
    settings: NotificationSettings,
    override?: boolean,
  ): boolean {
    if (override !== undefined) return override;

    switch (category) {
      case NotificationCategory.CHAT:
        return settings.chatEmail;
      case NotificationCategory.WALLET:
        return settings.walletEmail;
      case NotificationCategory.BOUNTY:
        return settings.bountyEmail;
      case NotificationCategory.FORUM:
        return settings.forumEmail;
      case NotificationCategory.SYSTEM:
        return settings.systemEmail;
      default:
        return false;
    }
  }

  private shouldSendPush(
    category: NotificationCategory,
    settings: NotificationSettings,
    override?: boolean,
  ): boolean {
    if (override !== undefined) return override;
    return this.shouldSendInApp(category, settings);
  }

  private getEmailTemplate(type: NotificationType): string {
    const templateMap: Record<NotificationType, string> = {
      NEW_MESSAGE: 'new-message',
      NEW_CONVERSATION: 'new-conversation',
      MENTION: 'mention',
      DEPOSIT_RECEIVED: 'deposit-received',
      WITHDRAWAL_COMPLETED: 'withdrawal-completed',
      WITHDRAWAL_FAILED: 'withdrawal-failed',
      BOUNTY_CREATED: 'bounty-created',
      BOUNTY_COMPLETED: 'bounty-completed',
      SUBMISSION_RECEIVED: 'submission-received',
      SUBMISSION_APPROVED: 'submission-approved',
      SUBMISSION_REJECTED: 'submission-rejected',
      BOUNTY_WINNER: 'bounty-winner',
      PAYOUT_RECEIVED: 'payout-received',
      THREAD_REPLY: 'thread-reply',
      POST_REACTION: 'post-reaction',
      THREAD_MENTION: 'thread-mention',
      POST_COMMENT: 'post-comment',
      COMMENT_REPLY: 'comment-reply',
      BADGE_EARNED: 'badge-earned',
      LEVEL_UP: 'level-up',
      HACKATHON_CREATED: 'hackathon-created',
      HACKATHON_STARTING_SOON: 'hackathon-starting-soon',
      HACKATHON_SUBMISSION_RECEIVED: 'hackathon-submission-received',
      HACKATHON_WINNER_ANNOUNCED: 'hackathon-winner-announced',
      SYSTEM_ANNOUNCEMENT: 'system-announcement',
      ACCOUNT_UPDATE: 'account-update',
    };

    return templateMap[type] || 'notification';
  }

  async getNotificationSettings(userId: string) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: { userId },
      });
    }

    return settings;
  }

  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    const settings = await this.getNotificationSettings(userId);

    return this.prisma.notificationSettings.update({
      where: { id: settings.id },
      data: dto,
    });
  }

  async getNotifications(userId: string, limit = 50, offset = 0) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return { message: 'Notification deleted successfully' };
  }

  async registerFcmToken(userId: string, dto: RegisterFcmTokenDto) {
    const existing = await this.prisma.fcmToken.findUnique({
      where: { token: dto.token },
    });

    if (existing) {
      return this.prisma.fcmToken.update({
        where: { token: dto.token },
        data: {
          userId,
          deviceId: dto.deviceId,
          platform: dto.platform,
        },
      });
    }

    return this.prisma.fcmToken.create({
      data: {
        userId,
        token: dto.token,
        deviceId: dto.deviceId,
        platform: dto.platform,
      },
    });
  }

  async removeFcmToken(token: string, userId: string) {
    const fcmToken = await this.prisma.fcmToken.findUnique({
      where: { token },
    });

    if (!fcmToken || fcmToken.userId !== userId) {
      throw new NotFoundException('FCM token not found');
    }

    await this.prisma.fcmToken.delete({
      where: { token },
    });

    return { message: 'FCM token removed successfully' };
  }

  async getUserFcmTokens(userId: string) {
    return this.prisma.fcmToken.findMany({
      where: { userId },
    });
  }
}
