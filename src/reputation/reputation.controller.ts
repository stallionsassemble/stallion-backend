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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReputationService } from './reputation.service';

@ApiTags('Reputation')
@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my reputation',
    description: 'Retrieve reputation details for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'User reputation and rank' })
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
  @ApiResponse({ status: 200, description: 'User reputation and rank' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserReputation(@Param('userId') userId: string) {
    const reputation = await this.reputationService.getUserReputation(userId);
    const rank = await this.reputationService.getUserRank(userId);
    return { ...reputation, rank };
  }

  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get leaderboard',
    description: 'Retrieve reputation leaderboard with optional filters',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users to retrieve (default: 50)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category (bounty, hackathon, community)',
  })
  @ApiResponse({ status: 200, description: 'Leaderboard rankings' })
  async getLeaderboard(
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const leaderboard = await this.reputationService.getLeaderboard(
      limit ? parseInt(limit) : 50,
      category,
    );

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
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
    }));
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
    name: 'limit',
    required: false,
    description: 'Number of history entries (default: 50)',
  })
  @ApiResponse({ status: 200, description: 'Reputation history' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reputationService.getReputationHistory(
      userId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('history/:userId')
  @ApiOperation({
    summary: 'Get user reputation history',
    description: 'Retrieve reputation change history for a specific user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of history entries (default: 50)',
  })
  @ApiResponse({ status: 200, description: 'Reputation history' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    return this.reputationService.getReputationHistory(
      userId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('badges')
  @ApiOperation({
    summary: 'Get all badges',
    description: 'Retrieve all available badges in the system',
  })
  @ApiResponse({ status: 200, description: 'List of all badges' })
  async getAllBadges() {
    return this.reputationService.getAllBadges();
  }

  @Get('badges/:badgeId')
  @ApiOperation({
    summary: 'Get badge info',
    description: 'Retrieve detailed information about a specific badge',
  })
  @ApiParam({ name: 'badgeId', description: 'Badge ID' })
  @ApiResponse({ status: 200, description: 'Badge details' })
  @ApiResponse({ status: 404, description: 'Badge not found' })
  async getBadgeInfo(@Param('badgeId') badgeId: string) {
    return this.reputationService.getBadgeInfo(badgeId);
  }
}
