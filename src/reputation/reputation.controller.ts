import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReputationService } from './reputation.service';

@Controller('reputation')
export class ReputationController {
  constructor(private readonly reputationService: ReputationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyReputation(@CurrentUser('id') userId: string) {
    const reputation = await this.reputationService.getUserReputation(userId);
    const rank = await this.reputationService.getUserRank(userId);
    return { ...reputation, rank };
  }

  @Get('user/:userId')
  async getUserReputation(@Param('userId') userId: string) {
    const reputation = await this.reputationService.getUserReputation(userId);
    const rank = await this.reputationService.getUserRank(userId);
    return { ...reputation, rank };
  }

  @Get('leaderboard')
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
  async getAllBadges() {
    return this.reputationService.getAllBadges();
  }

  @Get('badges/:badgeId')
  async getBadgeInfo(@Param('badgeId') badgeId: string) {
    return this.reputationService.getBadgeInfo(badgeId);
  }
}
