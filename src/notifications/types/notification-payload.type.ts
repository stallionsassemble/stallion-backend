import { NotificationType } from '@prisma/client';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  sendInApp?: boolean;
  sendEmail?: boolean;
  sendPush?: boolean;
}

export interface EmailNotificationData {
  to: string;
  subject: string;
  template: string;
  context: any;
}

export interface PushNotificationData {
  tokens: string[];
  title: string;
  body: string;
  data?: any;
}

export enum NotificationCategory {
  CHAT = 'chat',
  WALLET = 'wallet',
  BOUNTY = 'bounty',
  FORUM = 'forum',
  SYSTEM = 'system',
}

export const NotificationTypeToCategory: Record<
  NotificationType,
  NotificationCategory
> = {
  // Chat
  NEW_MESSAGE: NotificationCategory.CHAT,
  NEW_CONVERSATION: NotificationCategory.CHAT,
  MENTION: NotificationCategory.CHAT,

  // Wallet
  DEPOSIT_RECEIVED: NotificationCategory.WALLET,
  WITHDRAWAL_COMPLETED: NotificationCategory.WALLET,
  WITHDRAWAL_FAILED: NotificationCategory.WALLET,

  // Bounty
  BOUNTY_CREATED: NotificationCategory.BOUNTY,
  SUBMISSION_RECEIVED: NotificationCategory.BOUNTY,
  SUBMISSION_APPROVED: NotificationCategory.BOUNTY,
  SUBMISSION_REJECTED: NotificationCategory.BOUNTY,
  BOUNTY_WINNER: NotificationCategory.BOUNTY,
  PAYOUT_RECEIVED: NotificationCategory.BOUNTY,

  // Forum
  THREAD_REPLY: NotificationCategory.FORUM,
  POST_REACTION: NotificationCategory.FORUM,
  THREAD_MENTION: NotificationCategory.FORUM,

  // System
  SYSTEM_ANNOUNCEMENT: NotificationCategory.SYSTEM,
  ACCOUNT_UPDATE: NotificationCategory.SYSTEM,
};
