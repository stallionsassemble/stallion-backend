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
  HACKATHON = 'hackathon',
  ACHIEVEMENT = 'achievement',
  PROJECT = 'project',
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
  BOUNTY_COMPLETED: NotificationCategory.BOUNTY,
  SUBMISSION_RECEIVED: NotificationCategory.BOUNTY,
  SUBMISSION_APPROVED: NotificationCategory.BOUNTY,
  SUBMISSION_REJECTED: NotificationCategory.BOUNTY,
  BOUNTY_WINNER: NotificationCategory.BOUNTY,
  PAYOUT_RECEIVED: NotificationCategory.BOUNTY,

  // Forum
  THREAD_REPLY: NotificationCategory.FORUM,
  POST_REACTION: NotificationCategory.FORUM,
  THREAD_MENTION: NotificationCategory.FORUM,
  POST_COMMENT: NotificationCategory.FORUM,
  COMMENT_REPLY: NotificationCategory.FORUM,

  // Reputation
  BADGE_EARNED: NotificationCategory.ACHIEVEMENT,
  LEVEL_UP: NotificationCategory.ACHIEVEMENT,

  // Hackathon
  HACKATHON_CREATED: NotificationCategory.HACKATHON,
  HACKATHON_STARTING_SOON: NotificationCategory.HACKATHON,
  HACKATHON_SUBMISSION_RECEIVED: NotificationCategory.HACKATHON,
  HACKATHON_WINNER_ANNOUNCED: NotificationCategory.HACKATHON,

  // Project
  PROJECT_CREATED: NotificationCategory.PROJECT,
  PROJECT_UPDATED: NotificationCategory.PROJECT,
  PROJECT_COMPLETED: NotificationCategory.PROJECT,
  PROJECT_CANCELLED: NotificationCategory.PROJECT,
  APPLICATION_RECEIVED: NotificationCategory.PROJECT,
  APPLICATION_ACCEPTED: NotificationCategory.PROJECT,
  APPLICATION_REJECTED: NotificationCategory.PROJECT,
  MILESTONE_SUBMITTED: NotificationCategory.PROJECT,
  MILESTONE_APPROVED: NotificationCategory.PROJECT,
  MILESTONE_REVISION_REQUESTED: NotificationCategory.PROJECT,
  MILESTONE_PAID: NotificationCategory.PROJECT,

  // System
  SYSTEM_ANNOUNCEMENT: NotificationCategory.SYSTEM,
  ACCOUNT_UPDATE: NotificationCategory.SYSTEM,
};
