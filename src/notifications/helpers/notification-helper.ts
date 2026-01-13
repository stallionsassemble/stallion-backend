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
  threadReply: (
    userId: string,
    replierName: string,
    threadTitle: string,
    data?: any,
  ) => ({
    userId,
    type: 'THREAD_REPLY' as NotificationType,
    title: 'New reply to your thread',
    message: `${replierName} replied to "${threadTitle}"`,
    data,
    sendInApp: true,
    sendPush: true,
  }),

  postReaction: (
    userId: string,
    reactorName: string,
    emoji: string,
    data?: any,
  ) => ({
    userId,
    type: 'POST_REACTION' as NotificationType,
    title: 'Someone reacted to your post',
    message: `${reactorName} reacted with ${emoji}`,
    data,
    sendInApp: true,
    sendPush: true,
  }),

  threadMention: (
    userId: string,
    mentionerName: string,
    threadTitle: string,
    data?: any,
  ) => ({
    userId,
    type: 'THREAD_MENTION' as NotificationType,
    title: `${mentionerName} mentioned you`,
    message: `In thread: ${threadTitle}`,
    data,
    sendInApp: true,
    sendPush: true,
  }),

  postComment: (userId: string, commenterName: string, data?: any) => ({
    userId,
    type: 'POST_COMMENT' as NotificationType,
    title: 'New comment on your post',
    message: `${commenterName} commented on your post`,
    data,
    sendInApp: true,
    sendPush: true,
  }),

  commentReply: (userId: string, replierName: string, data?: any) => ({
    userId,
    type: 'COMMENT_REPLY' as NotificationType,
    title: 'New reply to your comment',
    message: `${replierName} replied to your comment`,
    data,
    sendInApp: true,
    sendPush: true,
  }),
};

// Reputation notification helpers
export const ReputationNotifications = {
  badgeEarned: (
    userId: string,
    badgeName: string,
    badgeIcon: string,
    data?: any,
  ) => ({
    userId,
    type: 'BADGE_EARNED' as NotificationType,
    title: 'New badge earned!',
    message: `You earned the "${badgeName}" badge ${badgeIcon}`,
    data,
    sendInApp: true,
    sendPush: true,
  }),

  levelUp: (userId: string, newLevel: string, data?: any) => ({
    userId,
    type: 'LEVEL_UP' as NotificationType,
    title: 'Level up!',
    message: `Congratulations! You reached ${newLevel} level`,
    data,
    sendInApp: true,
    sendPush: true,
  }),
};

// Project notification helpers
export const ProjectNotifications = {
  projectCreated: (userId: string, projectTitle: string) => ({
    userId,
    type: 'PROJECT_CREATED' as NotificationType,
    title: 'Project created successfully',
    message: `Your project "${projectTitle}" is now live`,
  }),

  projectUpdated: (userId: string, projectTitle: string) => ({
    userId,
    type: 'PROJECT_UPDATED' as NotificationType,
    title: 'Project updated',
    message: `Your project "${projectTitle}" has been updated`,
  }),

  projectCancelled: (userId: string, projectTitle: string) => ({
    userId,
    type: 'PROJECT_CANCELLED' as NotificationType,
    title: 'Project cancelled',
    message: `Your project "${projectTitle}" has been cancelled`,
  }),

  applicationReceived: (
    ownerId: string,
    projectTitle: string,
    applicantName: string,
  ) => ({
    userId: ownerId,
    type: 'APPLICATION_RECEIVED' as NotificationType,
    title: 'New application received',
    message: `${applicantName} applied to "${projectTitle}"`,
  }),

  applicationAccepted: (userId: string, projectTitle: string) => ({
    userId,
    type: 'APPLICATION_ACCEPTED' as NotificationType,
    title: 'Application accepted!',
    message: `Your application to "${projectTitle}" was accepted`,
  }),

  applicationRejected: (
    userId: string,
    projectTitle: string,
    reason?: string,
  ) => ({
    userId,
    type: 'APPLICATION_REJECTED' as NotificationType,
    title: 'Application not accepted',
    message: `Your application to "${projectTitle}" was not accepted${reason ? `: ${reason}` : ''}`,
  }),

  milestoneSubmitted: (
    ownerId: string,
    projectTitle: string,
    milestoneTitle: string,
    contributorName: string,
  ) => ({
    userId: ownerId,
    type: 'MILESTONE_SUBMITTED' as NotificationType,
    title: 'Milestone submitted for review',
    message: `${contributorName} submitted "${milestoneTitle}" for "${projectTitle}"`,
  }),

  milestoneApproved: (
    userId: string,
    projectTitle: string,
    milestoneTitle: string,
  ) => ({
    userId,
    type: 'MILESTONE_APPROVED' as NotificationType,
    title: 'Milestone approved!',
    message: `Your milestone "${milestoneTitle}" for "${projectTitle}" was approved`,
  }),

  milestoneRevisionRequested: (
    userId: string,
    projectTitle: string,
    milestoneTitle: string,
    revisionNote?: string,
  ) => ({
    userId,
    type: 'MILESTONE_REVISION_REQUESTED' as NotificationType,
    title: 'Revision requested',
    message: `Revision requested for "${milestoneTitle}" in "${projectTitle}"${revisionNote ? `: ${revisionNote}` : ''}`,
  }),

  milestonePaid: (
    userId: string,
    projectTitle: string,
    milestoneTitle: string,
    amount: string,
    currency: string,
  ) => ({
    userId,
    type: 'MILESTONE_PAID' as NotificationType,
    title: 'Payment received!',
    message: `You received ${amount} ${currency} for "${milestoneTitle}" in "${projectTitle}"`,
    data: { amount, currency },
  }),

  projectCompleted: (userId: string, projectTitle: string) => ({
    userId,
    type: 'PROJECT_COMPLETED' as NotificationType,
    title: 'Project completed!',
    message: `Project "${projectTitle}" has been completed`,
  }),
};
