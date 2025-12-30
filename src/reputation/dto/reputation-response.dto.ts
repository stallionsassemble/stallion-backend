import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReputationResponseDto {
  @ApiProperty({ description: 'Unique identifier', example: 'rep-uuid' })
  id: string;

  @ApiProperty({ description: 'Total reputation score', example: 1250 })
  score: number;

  @ApiProperty({ description: 'Reputation level', example: '5' })
  level: string;

  @ApiProperty({ description: 'Score from bounties', example: 800 })
  bountyScore: number;

  @ApiProperty({ description: 'Score from hackathons', example: 350 })
  hackathonScore: number;

  @ApiProperty({ description: 'Score from community activity', example: 100 })
  communityScore: number;

  @ApiProperty({ description: 'Total bounties participated in', example: 15 })
  totalBounties: number;

  @ApiProperty({ description: 'Number of bounties won', example: 8 })
  wonBounties: number;

  @ApiProperty({ description: 'Total hackathons participated in', example: 5 })
  totalHackathons: number;

  @ApiProperty({ description: 'Number of hackathons won', example: 2 })
  wonHackathons: number;

  @ApiProperty({ description: 'Number of forum posts', example: 42 })
  forumPosts: number;

  @ApiProperty({ description: 'Number of helpful votes received', example: 28 })
  helpfulVotes: number;

  @ApiProperty({
    description: 'Array of badge IDs',
    type: [String],
    example: ['badge-uuid-1', 'badge-uuid-2'],
  })
  badges: string[];

  @ApiPropertyOptional({ description: 'User rank on leaderboard', example: 42 })
  rank?: number;

  @ApiPropertyOptional({
    description: 'Score needed for next level',
    example: 1500,
  })
  nextLevelScore?: number;
}

export class ReputationHistoryDto {
  @ApiProperty({ description: 'Unique identifier', example: 'history-uuid' })
  id: string;

  @ApiProperty({ description: 'Reputation change amount', example: 100 })
  change: number;

  @ApiProperty({
    description: 'Reason for reputation change',
    example: 'Bounty completed',
  })
  reason: string;

  @ApiProperty({
    description: 'Category of reputation change',
    example: 'bounty',
  })
  category: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { bountyId: 'bounty-uuid' },
  })
  metadata?: any;

  @ApiProperty({
    description: 'Timestamp of change',
    example: '2024-03-01T12:00:00.000Z',
  })
  createdAt: Date;
}

export class LeaderboardEntryDto {
  @ApiProperty({ description: 'User ID', example: 'user-uuid' })
  userId: string;

  @ApiProperty({ description: 'Username', example: 'john_doe' })
  username: string;

  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  profilePicture?: string;

  @ApiProperty({ description: 'Total reputation score', example: 1250 })
  score: number;

  @ApiProperty({ description: 'Reputation level', example: '5' })
  level: string;

  @ApiProperty({ description: 'Leaderboard rank', example: 42 })
  rank: number;
}

export class BadgeDto {
  @ApiProperty({ description: 'Badge ID', example: 'badge-uuid' })
  id: string;

  @ApiProperty({ description: 'Badge name', example: 'First Bounty' })
  name: string;

  @ApiProperty({
    description: 'Badge description',
    example: 'Complete your first bounty',
  })
  description: string;

  @ApiProperty({ description: 'Badge icon emoji', example: '🎯' })
  icon: string;
}
