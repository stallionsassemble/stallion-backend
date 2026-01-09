import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import {
  ContributorStatsDto,
  ProjectOwnerStatsDto,
} from './dto/dashboard-stats.dto';
import { ContributorParticipationDto } from './dto/owner-contributors.dto';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats/contributor')
  @Roles('CONTRIBUTOR')
  @ApiOperation({
    summary: 'Get contributor dashboard statistics',
    description:
      'Retrieve dashboard statistics for contributors including earnings, active bounties, and completed bounties',
  })
  @ApiResponse({
    status: 200,
    description: 'Contributor statistics retrieved successfully',
    type: ContributorStatsDto,
    schema: {
      example: {
        totalEarnings: '15000.50',
        earningsPercentageChange: 25.5,
        activeBounties: 5,
        completedBounties: 12,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getContributorStats(
    @CurrentUser('id') userId: string,
  ): Promise<ContributorStatsDto> {
    return this.dashboardService.getContributorStats(userId);
  }

  @Get('stats/project-owner')
  @Roles('PROJECT_OWNER')
  @ApiOperation({
    summary: 'Get project owner dashboard statistics',
    description:
      'Retrieve dashboard statistics for project owners including bounties created, total paid out, and pending payments',
  })
  @ApiResponse({
    status: 200,
    description: 'Project owner statistics retrieved successfully',
    type: ProjectOwnerStatsDto,
    schema: {
      example: {
        totalBountiesCreated: 20,
        totalPaidOut: '50000.75',
        paidOutPercentageChange: -10.2,
        pendingPayments: '5000.00',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getProjectOwnerStats(
    @CurrentUser('id') userId: string,
  ): Promise<ProjectOwnerStatsDto> {
    return this.dashboardService.getProjectOwnerStats(userId);
  }

  @Get('contributors')
  @Roles('PROJECT_OWNER')
  @ApiOperation({
    summary: 'Get all contributors for owner',
    description:
      'Retrieve all contributors who have participated in bounties or projects created by the authenticated user, along with their participation statistics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contributors retrieved successfully',
    type: [ContributorParticipationDto],
    schema: {
      example: [
        {
          id: 'user-uuid-123',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
          bio: 'Full-stack developer with 5 years of experience',
          location: 'New York, USA',
          skills: ['JavaScript', 'TypeScript', 'React'],
          totalBountiesParticipated: 5,
          totalProjectsParticipated: 3,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async getOwnerContributors(
    @CurrentUser('id') userId: string,
  ): Promise<ContributorParticipationDto[]> {
    return this.dashboardService.getOwnerContributors(userId);
  }
}
