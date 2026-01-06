import { ActivityType } from '@prisma/client';

// Metadata type definitions for each activity type
export interface BountyCreatedMetadata {
  title: string;
  reward: string;
  currency: string;
  [key: string]: any;
}

export interface BountySubmissionMetadata {
  bountyTitle: string;
  [key: string]: any;
}

export interface BountyWonMetadata {
  bountyTitle: string;
  position: number;
  reward: string;
  currency: string;
  [key: string]: any;
}

export interface BountyCompletedMetadata {
  bountyTitle: string;
  [key: string]: any;
}

export interface ProjectCreatedMetadata {
  title: string;
  reward: string;
  currency: string;
  [key: string]: any;
}

export interface ProjectUpdatedMetadata {
  title: string;
  [key: string]: any;
}

export interface ProjectWonMetadata {
  projectTitle: string;
  reward: string;
  currency: string;
  [key: string]: any;
}

export interface ProjectApplicationMetadata {
  projectTitle: string;
  [key: string]: any;
}

export interface ProjectMilestoneMetadata {
  projectTitle: string;
  milestoneTitle: string;
  [key: string]: any;
}

export interface ProjectMilestonePaidMetadata {
  projectTitle: string;
  milestoneTitle: string;
  amount: string;
  currency: string;
  [key: string]: any;
}

export interface ProjectCompletedMetadata {
  projectTitle: string;
  [key: string]: any;
}

export interface ProjectCancelledMetadata {
  projectTitle: string;
  [key: string]: any;
}

export interface HackathonCreatedMetadata {
  title: string;
  totalReward: string;
  currency: string;
  [key: string]: any;
}

export interface HackathonSubmissionMetadata {
  hackathonTitle: string;
  trackName?: string;
  [key: string]: any;
}

export interface HackathonWonMetadata {
  hackathonTitle: string;
  position: number;
  reward: string;
  currency: string;
  trackName?: string;
  [key: string]: any;
}

export interface HackathonCompletedMetadata {
  hackathonTitle: string;
  [key: string]: any;
}

export interface ForumThreadCreatedMetadata {
  threadTitle: string;
  categoryName: string;
  [key: string]: any;
}

export interface ForumPostCreatedMetadata {
  threadTitle: string;
  [key: string]: any;
}

export interface ForumCommentCreatedMetadata {
  postAuthor: string;
  [key: string]: any;
}

export interface BadgeEarnedMetadata {
  badgeName: string;
  badgeIcon: string;
  [key: string]: any;
}

export interface LevelUpMetadata {
  newLevel: string;
  [key: string]: any;
}

// Conditional type that maps ActivityType to its specific metadata
export type ActivityMetadata<T extends ActivityType> =
  T extends 'BOUNTY_CREATED'
    ? BountyCreatedMetadata
    : T extends 'BOUNTY_SUBMISSION'
      ? BountySubmissionMetadata
      : T extends 'BOUNTY_WON'
        ? BountyWonMetadata
        : T extends 'BOUNTY_COMPLETED'
          ? BountyCompletedMetadata
          : T extends 'PROJECT_CREATED'
            ? ProjectCreatedMetadata
            : T extends 'PROJECT_UPDATED'
              ? ProjectUpdatedMetadata
              : T extends 'PROJECT_WON'
                ? ProjectWonMetadata
                : T extends 'PROJECT_APPLICATION_SUBMITTED'
                  ? ProjectApplicationMetadata
                  : T extends 'PROJECT_APPLICATION_ACCEPTED'
                    ? ProjectApplicationMetadata
                    : T extends 'PROJECT_APPLICATION_REJECTED'
                      ? ProjectApplicationMetadata
                      : T extends 'PROJECT_MILESTONE_SUBMITTED'
                        ? ProjectMilestoneMetadata
                        : T extends 'PROJECT_MILESTONE_APPROVED'
                          ? ProjectMilestoneMetadata
                          : T extends 'PROJECT_MILESTONE_PAID'
                            ? ProjectMilestonePaidMetadata
                            : T extends 'PROJECT_COMPLETED'
                              ? ProjectCompletedMetadata
                              : T extends 'PROJECT_CANCELLED'
                                ? ProjectCancelledMetadata
                                : T extends 'HACKATHON_CREATED'
                                  ? HackathonCreatedMetadata
                                  : T extends 'HACKATHON_SUBMISSION'
                                    ? HackathonSubmissionMetadata
                                    : T extends 'HACKATHON_WON'
                                      ? HackathonWonMetadata
                                      : T extends 'HACKATHON_COMPLETED'
                                        ? HackathonCompletedMetadata
                                        : T extends 'FORUM_THREAD_CREATED'
                                          ? ForumThreadCreatedMetadata
                                          : T extends 'FORUM_POST_CREATED'
                                            ? ForumPostCreatedMetadata
                                            : T extends 'FORUM_COMMENT_CREATED'
                                              ? ForumCommentCreatedMetadata
                                              : T extends 'BADGE_EARNED'
                                                ? BadgeEarnedMetadata
                                                : T extends 'LEVEL_UP'
                                                  ? LevelUpMetadata
                                                  : Record<string, any>;

// Base activity payload interface
export interface BaseActivityPayload {
  userId: string;
  type: ActivityType;
  message: string;
  bountyId?: string;
  projectId?: string;
  hackathonId?: string;
}

// Typed activity payload with conditional metadata
export type ActivityPayload<T extends ActivityType = ActivityType> =
  BaseActivityPayload & {
    type: T;
    metadata?: ActivityMetadata<T>;
  };

// Helper type for creating strongly-typed activity payloads
export type TypedActivityPayload<T extends ActivityType> = {
  userId: string;
  type: T;
  message: string;
  metadata: ActivityMetadata<T>;
  bountyId?: string;
  projectId?: string;
  hackathonId?: string;
};

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
