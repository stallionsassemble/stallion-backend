import { ReputationCategory, ReputationLevel } from '@prisma/client';

export interface ReputationAction {
  category: ReputationCategory;
  points: number;
  description: string;
}

export const REPUTATION_ACTIONS: Record<string, ReputationAction> = {
  // Bounty actions
  BOUNTY_SUBMISSION: {
    category: ReputationCategory.BOUNTY,
    points: 10,
    description: 'Submitted a bounty',
  },
  BOUNTY_WIN_FIRST: {
    category: ReputationCategory.BOUNTY,
    points: 100,
    description: 'Won 1st place in a bounty',
  },
  BOUNTY_WIN_SECOND: {
    category: ReputationCategory.BOUNTY,
    points: 60,
    description: 'Won 2nd place in a bounty',
  },
  BOUNTY_WIN_THIRD: {
    category: ReputationCategory.BOUNTY,
    points: 40,
    description: 'Won 3rd place in a bounty',
  },
  BOUNTY_QUALITY_SUBMISSION: {
    category: ReputationCategory.QUALITY,
    points: 20,
    description: 'High-quality bounty submission',
  },

  // Hackathon actions
  HACKATHON_SUBMISSION: {
    category: ReputationCategory.HACKATHON,
    points: 15,
    description: 'Submitted to a hackathon',
  },
  HACKATHON_WIN_FIRST: {
    category: ReputationCategory.HACKATHON,
    points: 150,
    description: 'Won 1st place in a hackathon',
  },
  HACKATHON_WIN_SECOND: {
    category: ReputationCategory.HACKATHON,
    points: 90,
    description: 'Won 2nd place in a hackathon',
  },
  HACKATHON_WIN_THIRD: {
    category: ReputationCategory.HACKATHON,
    points: 60,
    description: 'Won 3rd place in a hackathon',
  },

  // Community actions
  FORUM_POST: {
    category: ReputationCategory.FORUM,
    points: 2,
    description: 'Created a forum post',
  },
  FORUM_HELPFUL_VOTE: {
    category: ReputationCategory.FORUM,
    points: 5,
    description: 'Received a helpful vote',
  },
  FORUM_THREAD_CREATED: {
    category: ReputationCategory.FORUM,
    points: 5,
    description: 'Started a forum thread',
  },

  // Consistency bonuses
  WEEKLY_ACTIVE: {
    category: ReputationCategory.CONSISTENCY,
    points: 10,
    description: 'Active for a week',
  },
  MONTHLY_ACTIVE: {
    category: ReputationCategory.CONSISTENCY,
    points: 50,
    description: 'Active for a month',
  },

  // Penalties
  SUBMISSION_REJECTED: {
    category: ReputationCategory.QUALITY,
    points: -5,
    description: 'Submission rejected',
  },
  SPAM_DETECTED: {
    category: ReputationCategory.COMMUNITY,
    points: -50,
    description: 'Spam detected',
  },
};

export const REPUTATION_LEVEL_THRESHOLDS: Record<ReputationLevel, number> = {
  [ReputationLevel.NEWCOMER]: 0,
  [ReputationLevel.CONTRIBUTOR]: 100,
  [ReputationLevel.REGULAR]: 500,
  [ReputationLevel.VETERAN]: 1000,
  [ReputationLevel.EXPERT]: 2500,
  [ReputationLevel.MASTER]: 5000,
  [ReputationLevel.LEGEND]: 10000,
};

export const REPUTATION_BADGES = {
  FIRST_BOUNTY: {
    id: 'first_bounty',
    name: 'First Bounty',
    description: 'Completed your first bounty',
    icon: '🎯',
  },
  BOUNTY_MASTER: {
    id: 'bounty_master',
    name: 'Bounty Master',
    description: 'Won 10 bounties',
    icon: '👑',
  },
  HACKATHON_HERO: {
    id: 'hackathon_hero',
    name: 'Hackathon Hero',
    description: 'Won 5 hackathons',
    icon: '🏆',
  },
  COMMUNITY_CHAMPION: {
    id: 'community_champion',
    name: 'Community Champion',
    description: 'Received 100 helpful votes',
    icon: '⭐',
  },
  CONSISTENT_CONTRIBUTOR: {
    id: 'consistent_contributor',
    name: 'Consistent Contributor',
    description: 'Active for 30 consecutive days',
    icon: '🔥',
  },
  QUALITY_FIRST: {
    id: 'quality_first',
    name: 'Quality First',
    description: 'Maintained 90%+ submission acceptance rate',
    icon: '💎',
  },
  EARLY_ADOPTER: {
    id: 'early_adopter',
    name: 'Early Adopter',
    description: 'Joined in the first month',
    icon: '🚀',
  },
  HELPFUL_HAND: {
    id: 'helpful_hand',
    name: 'Helpful Hand',
    description: 'Helped 50 community members',
    icon: '🤝',
  },
  // Level achievement badges
  RISING_STAR: {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Reached Contributor level',
    icon: '🌟',
  },
  ESTABLISHED_MEMBER: {
    id: 'established_member',
    name: 'Established Member',
    description: 'Reached Regular level',
    icon: '🎖️',
  },
  BATTLE_TESTED: {
    id: 'battle_tested',
    name: 'Battle Tested',
    description: 'Reached Veteran level',
    icon: '⚔️',
  },
  EXPERT_STATUS: {
    id: 'expert_status',
    name: 'Expert Status',
    description: 'Reached Expert level',
    icon: '🎓',
  },
  MASTER_CRAFTSMAN: {
    id: 'master_craftsman',
    name: 'Master Craftsman',
    description: 'Reached Master level',
    icon: '🏅',
  },
  LEGENDARY_STATUS: {
    id: 'legendary_status',
    name: 'Legendary Status',
    description: 'Reached Legend level',
    icon: '🔱',
  },
};

export function calculateLevel(score: number): ReputationLevel {
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.LEGEND])
    return ReputationLevel.LEGEND;
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.MASTER])
    return ReputationLevel.MASTER;
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.EXPERT])
    return ReputationLevel.EXPERT;
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.VETERAN])
    return ReputationLevel.VETERAN;
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.REGULAR])
    return ReputationLevel.REGULAR;
  if (score >= REPUTATION_LEVEL_THRESHOLDS[ReputationLevel.CONTRIBUTOR])
    return ReputationLevel.CONTRIBUTOR;
  return ReputationLevel.NEWCOMER;
}
