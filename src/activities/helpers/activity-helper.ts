import { ActivityType } from '@prisma/client';
import { ActivityPayload } from '../types/activity-payload.type';

export const BountyActivities = {
  created: (
    userId: string,
    bountyId: string,
    title: string,
    reward: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.BOUNTY_CREATED,
    message: `Created bounty "${title}" with reward of ${reward} ${currency}`,
    bountyId,
    metadata: { title, reward, currency },
  }),

  submission: (
    userId: string,
    bountyId: string,
    bountyTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.BOUNTY_SUBMISSION,
    message: `Submitted to bounty "${bountyTitle}"`,
    bountyId,
    metadata: { bountyTitle },
  }),

  won: (
    userId: string,
    bountyId: string,
    bountyTitle: string,
    position: number,
    reward: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.BOUNTY_WON,
    message: `Won ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} place in bounty "${bountyTitle}" - ${reward} ${currency}`,
    bountyId,
    metadata: { bountyTitle, position, reward, currency },
  }),

  completed: (
    userId: string,
    bountyId: string,
    bountyTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.BOUNTY_COMPLETED,
    message: `Bounty "${bountyTitle}" completed`,
    bountyId,
    metadata: { bountyTitle },
  }),
};

export const ProjectActivities = {
  created: (
    userId: string,
    projectId: string,
    title: string,
    reward: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_CREATED,
    message: `Created project "${title}" with reward of ${reward} ${currency}`,
    projectId,
    metadata: { title, reward, currency },
  }),

  updated: (
    userId: string,
    projectId: string,
    title: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_UPDATED,
    message: `Updated project "${title}"`,
    projectId,
    metadata: { title },
  }),

  won: (
    userId: string,
    projectId: string,
    projectTitle: string,
    reward: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_WON,
    message: `Won project "${projectTitle}" - ${reward} ${currency}`,
    projectId,
    metadata: { projectTitle, reward, currency },
  }),

  applicationSubmitted: (
    userId: string,
    projectId: string,
    projectTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_APPLICATION_SUBMITTED,
    message: `Applied to project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle },
  }),

  applicationAccepted: (
    userId: string,
    projectId: string,
    projectTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_APPLICATION_ACCEPTED,
    message: `Application accepted for project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle },
  }),

  applicationRejected: (
    userId: string,
    projectId: string,
    projectTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_APPLICATION_REJECTED,
    message: `Application rejected for project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle },
  }),

  milestoneSubmitted: (
    userId: string,
    projectId: string,
    projectTitle: string,
    milestoneTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_MILESTONE_SUBMITTED,
    message: `Submitted milestone "${milestoneTitle}" for project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle, milestoneTitle },
  }),

  milestoneApproved: (
    userId: string,
    projectId: string,
    projectTitle: string,
    milestoneTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_MILESTONE_APPROVED,
    message: `Milestone "${milestoneTitle}" approved for project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle, milestoneTitle },
  }),

  milestonePaid: (
    userId: string,
    projectId: string,
    projectTitle: string,
    milestoneTitle: string,
    amount: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_MILESTONE_PAID,
    message: `Received ${amount} ${currency} for milestone "${milestoneTitle}" in project "${projectTitle}"`,
    projectId,
    metadata: { projectTitle, milestoneTitle, amount, currency },
  }),

  completed: (
    userId: string,
    projectId: string,
    projectTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_COMPLETED,
    message: `Project "${projectTitle}" completed`,
    projectId,
    metadata: { projectTitle },
  }),

  cancelled: (
    userId: string,
    projectId: string,
    projectTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.PROJECT_CANCELLED,
    message: `Project "${projectTitle}" cancelled`,
    projectId,
    metadata: { projectTitle },
  }),
};

export const HackathonActivities = {
  created: (
    userId: string,
    hackathonId: string,
    title: string,
    totalReward: string,
    currency: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.HACKATHON_CREATED,
    message: `Created hackathon "${title}" with total reward of ${totalReward} ${currency}`,
    hackathonId,
    metadata: { title, totalReward, currency },
  }),

  submission: (
    userId: string,
    hackathonId: string,
    hackathonTitle: string,
    trackName?: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.HACKATHON_SUBMISSION,
    message: trackName
      ? `Submitted to hackathon "${hackathonTitle}" - ${trackName} track`
      : `Submitted to hackathon "${hackathonTitle}"`,
    hackathonId,
    metadata: { hackathonTitle, trackName },
  }),

  won: (
    userId: string,
    hackathonId: string,
    hackathonTitle: string,
    position: number,
    reward: string,
    currency: string,
    trackName?: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.HACKATHON_WON,
    message: trackName
      ? `Won ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} place in hackathon "${hackathonTitle}" (${trackName} track) - ${reward} ${currency}`
      : `Won ${position}${position === 1 ? 'st' : position === 2 ? 'nd' : position === 3 ? 'rd' : 'th'} place in hackathon "${hackathonTitle}" - ${reward} ${currency}`,
    hackathonId,
    metadata: { hackathonTitle, position, reward, currency, trackName },
  }),

  completed: (
    userId: string,
    hackathonId: string,
    hackathonTitle: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.HACKATHON_COMPLETED,
    message: `Hackathon "${hackathonTitle}" completed`,
    hackathonId,
    metadata: { hackathonTitle },
  }),
};

export const ForumActivities = {
  threadCreated: (
    userId: string,
    threadTitle: string,
    categoryName: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.FORUM_THREAD_CREATED,
    message: `Created thread "${threadTitle}" in ${categoryName}`,
    metadata: { threadTitle, categoryName },
  }),

  postCreated: (userId: string, threadTitle: string): ActivityPayload => ({
    userId,
    type: ActivityType.FORUM_POST_CREATED,
    message: `Posted in thread "${threadTitle}"`,
    metadata: { threadTitle },
  }),

  commentCreated: (userId: string, postAuthor: string): ActivityPayload => ({
    userId,
    type: ActivityType.FORUM_COMMENT_CREATED,
    message: `Commented on ${postAuthor}'s post`,
    metadata: { postAuthor },
  }),
};

export const ReputationActivities = {
  badgeEarned: (
    userId: string,
    badgeName: string,
    badgeIcon: string,
  ): ActivityPayload => ({
    userId,
    type: ActivityType.BADGE_EARNED,
    message: `Earned the "${badgeName}" badge ${badgeIcon}`,
    metadata: { badgeName, badgeIcon },
  }),

  levelUp: (userId: string, newLevel: string): ActivityPayload => ({
    userId,
    type: ActivityType.LEVEL_UP,
    message: `Reached ${newLevel} level`,
    metadata: { newLevel },
  }),
};
