import { NotificationType } from '@prisma/client';

export interface NotificationHelper {
  sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: any,
  ): Promise<void>;
}

export function createNotificationPayload(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: any,
) {
  return {
    userId,
    type,
    title,
    message,
    data,
  };
}

// Chat notification helpers
export const ChatNotifications = {
  newMessage: (recipientId: string, senderName: string, preview: string) => ({
    userId: recipientId,
    type: 'NEW_MESSAGE' as NotificationType,
    title: `New message from ${senderName}`,
    message: preview,
  }),

  newConversation: (userId: string, initiatorName: string) => ({
    userId,
    type: 'NEW_CONVERSATION' as NotificationType,
    title: 'New conversation',
    message: `${initiatorName} started a conversation with you`,
  }),

  mention: (userId: string, mentionerName: string, context: string) => ({
    userId,
    type: 'MENTION' as NotificationType,
    title: `${mentionerName} mentioned you`,
    message: context,
  }),
};

// Wallet notification helpers
export const WalletNotifications = {
  depositReceived: (userId: string, amount: string, currency: string) => ({
    userId,
    type: 'DEPOSIT_RECEIVED' as NotificationType,
    title: 'Deposit received',
    message: `You received ${amount} ${currency}`,
    data: { amount, currency },
  }),

  withdrawalCompleted: (userId: string, amount: string, currency: string) => ({
    userId,
    type: 'WITHDRAWAL_COMPLETED' as NotificationType,
    title: 'Withdrawal completed',
    message: `Your withdrawal of ${amount} ${currency} has been completed`,
    data: { amount, currency },
  }),

  withdrawalFailed: (
    userId: string,
    amount: string,
    currency: string,
    reason?: string,
  ) => ({
    userId,
    type: 'WITHDRAWAL_FAILED' as NotificationType,
    title: 'Withdrawal failed',
    message: `Your withdrawal of ${amount} ${currency} failed${reason ? `: ${reason}` : ''}`,
    data: { amount, currency, reason },
  }),
};

// Bounty notification helpers
export const BountyNotifications = {
  bountyCreated: (userId: string, bountyTitle: string) => ({
    userId,
    type: 'BOUNTY_CREATED' as NotificationType,
    title: 'New bounty available',
    message: `New bounty: ${bountyTitle}`,
  }),

  submissionReceived: (
    ownerId: string,
    bountyTitle: string,
    submitterName: string,
  ) => ({
    userId: ownerId,
    type: 'SUBMISSION_RECEIVED' as NotificationType,
    title: 'New submission',
    message: `${submitterName} submitted to "${bountyTitle}"`,
  }),

  submissionApproved: (userId: string, bountyTitle: string) => ({
    userId,
    type: 'SUBMISSION_APPROVED' as NotificationType,
    title: 'Submission approved',
    message: `Your submission to "${bountyTitle}" was approved`,
  }),

  submissionRejected: (userId: string, bountyTitle: string) => ({
    userId,
    type: 'SUBMISSION_REJECTED' as NotificationType,
    title: 'Submission rejected',
    message: `Your submission to "${bountyTitle}" was rejected`,
  }),

  bountyWinner: (userId: string, bountyTitle: string, position: number) => ({
    userId,
    type: 'BOUNTY_WINNER' as NotificationType,
    title: 'Congratulations! You won!',
    message: `You placed #${position} in "${bountyTitle}"`,
    data: { position },
  }),

  payoutReceived: (userId: string, amount: string, bountyTitle: string) => ({
    userId,
    type: 'PAYOUT_RECEIVED' as NotificationType,
    title: 'Payout received',
    message: `You received ${amount} XLM for "${bountyTitle}"`,
    data: { amount },
  }),
};

// Forum notification helpers
export const ForumNotifications = {
  threadReply: (userId: string, replierName: string, threadTitle: string) => ({
    userId,
    type: 'THREAD_REPLY' as NotificationType,
    title: 'New reply to your thread',
    message: `${replierName} replied to "${threadTitle}"`,
  }),

  postReaction: (userId: string, reactorName: string, emoji: string) => ({
    userId,
    type: 'POST_REACTION' as NotificationType,
    title: 'Someone reacted to your post',
    message: `${reactorName} reacted with ${emoji}`,
  }),

  threadMention: (
    userId: string,
    mentionerName: string,
    threadTitle: string,
  ) => ({
    userId,
    type: 'THREAD_MENTION' as NotificationType,
    title: `${mentionerName} mentioned you`,
    message: `In thread: ${threadTitle}`,
  }),
};
