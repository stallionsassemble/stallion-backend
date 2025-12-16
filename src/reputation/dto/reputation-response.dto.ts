export class ReputationResponseDto {
  id: string;
  score: number;
  level: string;
  bountyScore: number;
  hackathonScore: number;
  communityScore: number;
  totalBounties: number;
  wonBounties: number;
  totalHackathons: number;
  wonHackathons: number;
  forumPosts: number;
  helpfulVotes: number;
  badges: string[];
  rank?: number;
  nextLevelScore?: number;
}

export class ReputationHistoryDto {
  id: string;
  change: number;
  reason: string;
  category: string;
  metadata?: any;
  createdAt: Date;
}

export class LeaderboardEntryDto {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  score: number;
  level: string;
  rank: number;
}

export class BadgeDto {
  id: string;
  name: string;
  description: string;
  icon: string;
}
