import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserIdParamDto } from '../users/dto/user-id-param.dto';
import { GetLeaderboardQueryDto } from './dto/get-leaderboard-query.dto';
import { RecentEarnersQueryDto } from './dto/recent-earners-query.dto';
import { ReputationService } from './reputation.service';

@ApiTags('Reputation')
@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my reputation',
    description: 'Retrieve reputation details for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User reputation and rank',
    schema: {
      example: {
        id: 'rep-uuid',
        userId: 'user-uuid',
        score: 1250,
        level: 'VETERAN',
        bountyScore: 800,
        hackathonScore: 350,
        communityScore: 100,
        badges: [
          {
            id: 'badge-uuid-1',
            name: 'First Bounty',
            description: 'Completed your first bounty',
            icon: '🎯',
            earnedAt: '2024-01-15T00:00:00.000Z',
          },
          {
            id: 'badge-uuid-2',
            name: 'Top Contributor',
            description: 'Ranked in top 10 contributors',
            icon: '⭐',
            earnedAt: '2024-02-01T00:00:00.000Z',
          },
        ],
        rank: 42,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-03-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyReputation(@CurrentUser('id') userId: string) {
    const reputation = await this.reputationService.getUserReputation(userId);
    const rank = await this.reputationService.getUserRank(userId);
    return { ...reputation, rank };
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user reputation',
    description: 'Retrieve reputation details for a specific user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User reputation and rank',
    schema: {
      example: {
        id: 'rep-uuid',
        userId: 'user-uuid',
        score: 1250,
        level: 'VETERAN',
        bountyScore: 800,
        hackathonScore: 350,
        communityScore: 100,
        badges: [
          {
            id: 'badge-uuid-1',
            name: 'First Bounty',
            description: 'Completed your first bounty',
            icon: '🎯',
            earnedAt: '2024-01-15T00:00:00.000Z',
          },
        ],
        rank: 42,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-03-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserReputation(@Param() dto: UserIdParamDto) {
    const reputation = await this.reputationService.getUserReputation(
      dto.userId,
    );
    const rank = await this.reputationService.getUserRank(dto.userId);
    return { ...reputation, rank };
  }

  @Get('leaderboard/recent-earners')
  @ApiOperation({
    summary: 'Get recent earners',
    description:
      'Retrieve users who have recently earned from bounties or projects',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users per page (default: 20)',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent earners with their earnings',
    schema: {
      example: {
        data: [
          {
            userId: 'user-uuid-1',
            username: 'top_earner',
            firstName: 'Alice',
            lastName: 'Johnson',
            profilePicture: 'https://example.com/alice.jpg',
            totalEarnings: '5000',
            bountyEarnings: '3000',
            projectEarnings: '2000',
            lastEarnedAt: '2024-03-01T12:00:00.000Z',
            recentWinsCount: 3,
            level: 'VETERAN',
            isVerified: true,
          },
          {
            userId: 'user-uuid-2',
            username: 'code_master',
            firstName: 'Bob',
            lastName: 'Smith',
            profilePicture: 'https://example.com/bob.jpg',
            totalEarnings: '3500',
            bountyEarnings: '2500',
            projectEarnings: '1000',
            lastEarnedAt: '2024-02-28T10:00:00.000Z',
            recentWinsCount: 2,
            level: 'MASTER',
            isVerified: false,
          },
        ],
        pagination: {
          total: 45,
          page: 1,
          limit: 20,
          totalPages: 3,
        },
      },
    },
  })
  async getRecentEarners(@Query() query: RecentEarnersQueryDto) {
    return this.reputationService.getRecentEarners(
      query.page,
      query.limit,
      query.days,
    );
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get leaderboard',
    description: 'Retrieve reputation leaderboard with optional filters',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users per page (default: 50)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category (bounty, hackathon, community)',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard rankings with pagination',
    schema: {
      example: {
        data: [
          {
            rank: 1,
            userId: 'user-uuid-1',
            username: 'top_contributor',
            firstName: 'Alice',
            lastName: 'Johnson',
            profilePicture: 'https://example.com/alice.jpg',
            score: 5420,
            level: 'LEGEND',
            bountyScore: 3200,
            hackathonScore: 1800,
            communityScore: 420,
            successRate: 85.7,
            isVerified: true,
            primarySkill: 'React',
            completedTasksCount: 24,
            earnedAmount: '45000',
            badges: ['badge-uuid-1', 'badge-uuid-2', 'badge-uuid-3'],
          },
          {
            rank: 2,
            userId: 'user-uuid-2',
            username: 'code_master',
            firstName: 'Bob',
            lastName: 'Smith',
            profilePicture: 'https://example.com/bob.jpg',
            score: 4850,
            level: 'MASTER',
            bountyScore: 2900,
            hackathonScore: 1650,
            communityScore: 300,
            successRate: 78.3,
            isVerified: true,
            primarySkill: 'TypeScript',
            completedTasksCount: 18,
            earnedAmount: '32500',
            badges: ['badge-uuid-4', 'badge-uuid-5'],
          },
        ],
        pagination: {
          total: 150,
          page: 1,
          limit: 50,
          totalPages: 3,
        },
      },
    },
  })
  async getLeaderboard(@Query() query: GetLeaderboardQueryDto) {
    const result = await this.reputationService.getLeaderboard(
      query.page ?? 1,
      query.limit ?? 50,
      query.category,
    );

    const startRank = ((query.page ?? 1) - 1) * (query.limit ?? 50);

    return {
      data: result.data.map((entry, index) => ({
        rank: startRank + index + 1,
        userId: entry.user.id,
        username: entry.user.username,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        profilePicture: entry.user.profilePicture,
        score: entry.score,
        level: entry.level,
        bountyScore: entry.bountyScore,
        hackathonScore: entry.hackathonScore,
        communityScore: entry.communityScore,
        badges: entry.badges,
        successRate: entry.successRate,
        isVerified: entry.isVerified,
        primarySkill: entry.primarySkill,
        completedTasksCount: entry.completedTasksCount,
        earnedAmount: entry.earnedAmount,
        rating: entry.rating,
        totalReviews: entry.totalReviews,
      })),
      pagination: result.pagination,
    };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my reputation history',
    description:
      'Retrieve reputation change history for the authenticated user',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of history entries per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Reputation history with pagination',
    schema: {
      example: {
        data: [
          {
            id: 'history-uuid-1',
            userId: 'user-uuid',
            change: 100,
            reason: 'Bounty completed',
            category: 'bounty',
            referenceId: 'bounty-uuid',
            createdAt: '2024-03-01T12:00:00.000Z',
          },
          {
            id: 'history-uuid-2',
            userId: 'user-uuid',
            change: 50,
            reason: 'Hackathon participation',
            category: 'hackathon',
            referenceId: 'hackathon-uuid',
            createdAt: '2024-02-28T10:00:00.000Z',
          },
          {
            id: 'history-uuid-3',
            userId: 'user-uuid',
            change: 10,
            reason: 'Forum post upvoted',
            category: 'community',
            referenceId: 'post-uuid',
            createdAt: '2024-02-27T15:30:00.000Z',
          },
        ],
        pagination: {
          total: 125,
          page: 1,
          limit: 50,
          totalPages: 3,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyHistory(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reputationService.getReputationHistory(
      userId,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  @Get('history/:userId')
  @ApiOperation({
    summary: 'Get user reputation history',
    description: 'Retrieve reputation change history for a specific user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of history entries per page (default: 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Reputation history with pagination',
    schema: {
      example: {
        data: [
          {
            id: 'history-uuid-1',
            userId: 'user-uuid',
            change: 100,
            reason: 'Bounty completed',
            category: 'bounty',
            referenceId: 'bounty-uuid',
            createdAt: '2024-03-01T12:00:00.000Z',
          },
        ],
        pagination: {
          total: 75,
          page: 1,
          limit: 50,
          totalPages: 2,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserHistory(
    @Param() params: UserIdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.reputationService.getReputationHistory(
      params.userId,
      query.page ?? 1,
      query.limit ?? 50,
    );
  }

  @Get('badges')
  @ApiOperation({
    summary: 'Get all badges',
    description: 'Retrieve all available badges in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all badges',
    schema: {
      example: [
        {
          id: 'badge-uuid-1',
          name: 'First Bounty',
          description: 'Complete your first bounty',
          icon: '🎯',
          category: 'bounty',
          rarity: 'common',
          requirement: 'Complete 1 bounty',
        },
        {
          id: 'badge-uuid-2',
          name: 'Bounty Hunter',
          description: 'Complete 10 bounties',
          icon: '🏹',
          category: 'bounty',
          rarity: 'rare',
          requirement: 'Complete 10 bounties',
        },
        {
          id: 'badge-uuid-3',
          name: 'Legend',
          description: 'Reach level 10',
          icon: '👑',
          category: 'achievement',
          rarity: 'legendary',
          requirement: 'Reach reputation level 10',
        },
      ],
    },
  })
  async getAllBadges() {
    return this.reputationService.getAllBadges();
  }

  @Get('badges/:badgeId')
  @ApiOperation({
    summary: 'Get badge info',
    description: 'Retrieve detailed information about a specific badge',
  })
  @ApiParam({ name: 'badgeId', description: 'Badge ID' })
  @ApiResponse({
    status: 200,
    description: 'Badge details',
    schema: {
      example: {
        id: 'badge-uuid',
        name: 'First Bounty',
        description: 'Complete your first bounty',
        icon: '🎯',
        category: 'bounty',
        rarity: 'common',
        requirement: 'Complete 1 bounty',
        earnedBy: 1247,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Badge not found' })
  async getBadgeInfo(@Param('badgeId') badgeId: string) {
    return this.reputationService.getBadgeInfo(badgeId);
  }
}
