import { ActivityType } from '@prisma/client';

export interface ActivityPayload {
  userId: string;
  type: ActivityType;
  message: string;
  metadata?: any;
  bountyId?: string;
  projectId?: string;
  hackathonId?: string;
}

export enum ActivityCategory {
  BOUNTY = 'bounty',
  PROJECT = 'project',
  HACKATHON = 'hackathon',
  FORUM = 'forum',
  REPUTATION = 'reputation',
}

export const ActivityTypeToCategory: Record<ActivityType, ActivityCategory> = {
  // Bounty activities
  BOUNTY_CREATED: ActivityCategory.BOUNTY,
  BOUNTY_SUBMISSION: ActivityCategory.BOUNTY,
  BOUNTY_WON: ActivityCategory.BOUNTY,
  BOUNTY_COMPLETED: ActivityCategory.BOUNTY,

  // Project activities
  PROJECT_CREATED: ActivityCategory.PROJECT,
  PROJECT_UPDATED: ActivityCategory.PROJECT,
  PROJECT_WON: ActivityCategory.PROJECT,
  PROJECT_APPLICATION_SUBMITTED: ActivityCategory.PROJECT,
  PROJECT_APPLICATION_ACCEPTED: ActivityCategory.PROJECT,
  PROJECT_APPLICATION_REJECTED: ActivityCategory.PROJECT,
  PROJECT_MILESTONE_SUBMITTED: ActivityCategory.PROJECT,
  PROJECT_MILESTONE_APPROVED: ActivityCategory.PROJECT,
  PROJECT_MILESTONE_PAID: ActivityCategory.PROJECT,
  PROJECT_COMPLETED: ActivityCategory.PROJECT,
  PROJECT_CANCELLED: ActivityCategory.PROJECT,

  // Hackathon activities
  HACKATHON_CREATED: ActivityCategory.HACKATHON,
  HACKATHON_SUBMISSION: ActivityCategory.HACKATHON,
  HACKATHON_WON: ActivityCategory.HACKATHON,
  HACKATHON_COMPLETED: ActivityCategory.HACKATHON,

  // Forum activities
  FORUM_THREAD_CREATED: ActivityCategory.FORUM,
  FORUM_POST_CREATED: ActivityCategory.FORUM,
  FORUM_COMMENT_CREATED: ActivityCategory.FORUM,

  // Reputation activities
  BADGE_EARNED: ActivityCategory.REPUTATION,
  LEVEL_UP: ActivityCategory.REPUTATION,
};
