import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IdParamDto } from '../common/dto/id-param.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';
import { GetActivitiesQueryDto } from './dto/get-activities-query.dto';

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all app-wide activities',
    description: 'Retrieve all activities across the platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
    schema: {
      example: {
        data: [
          {
            id: 'activity-uuid',
            type: 'BOUNTY_WON',
            message:
              'Won 1st place in bounty "Build a landing page" - 500 USDC',
            metadata: {
              bountyTitle: 'Build a landing page',
              position: 1,
              reward: '500',
              currency: 'USDC',
            },
            createdAt: '2024-01-01T00:00:00.000Z',
            user: {
              id: 'user-uuid',
              username: 'john_doe',
              firstName: 'John',
              lastName: 'Doe',
              profilePicture: 'https://...',
            },
            bounty: {
              id: 'bounty-uuid',
              title: 'Build a landing page',
              rewardCurrency: 'USDC',
            },
          },
        ],
        pagination: {
          total: 100,
          page: 1,
          limit: 50,
          totalPages: 2,
        },
      },
    },
  })
  async getAllActivities(@Query() query: GetActivitiesQueryDto) {
    return this.activitiesService.getActivities({
      page: query.page!,
      limit: query.limit!,
      type: query.type,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my activities',
    description: 'Retrieve activities for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivities(
    @CurrentUser('id') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activitiesService.getActivities({
      userId,
      page: query.page!,
      limit: query.limit!,
    });
  }

  @Get('user/:id')
  @ApiOperation({
    summary: 'Get user activities',
    description: 'Retrieve activities for a specific user',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
  })
  async getUserActivities(
    @Param() params: IdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activitiesService.getActivities({
      userId: params.id,
      page: query.page!,
      limit: query.limit!,
    });
  }

  @Get('bounty/:id')
  @ApiOperation({
    summary: 'Get bounty activities',
    description: 'Retrieve all activities for a specific bounty',
  })
  @ApiParam({ name: 'bountyId', description: 'Bounty ID' })
  @ApiResponse({
    status: 200,
    description: 'Bounty activities retrieved successfully',
  })
  async getBountyActivities(
    @Param() params: IdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activitiesService.getActivities({
      bountyId: params.id,
      page: query.page!,
      limit: query.limit!,
    });
  }

  @Get('project/:id')
  @ApiOperation({
    summary: 'Get project activities',
    description: 'Retrieve all activities for a specific project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Project activities retrieved successfully',
  })
  async getProjectActivities(
    @Param() params: IdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activitiesService.getActivities({
      projectId: params.id,
      page: query.page!,
      limit: query.limit!,
    });
  }

  @Get('hackathon/:id')
  @ApiOperation({
    summary: 'Get hackathon activities',
    description: 'Retrieve all activities for a specific hackathon',
  })
  @ApiParam({ name: 'hackathonId', description: 'Hackathon ID' })
  @ApiResponse({
    status: 200,
    description: 'Hackathon activities retrieved successfully',
  })
  async getHackathonActivities(
    @Param() params: IdParamDto,
    @Query() query: PaginationQueryDto,
  ) {
    return this.activitiesService.getActivities({
      hackathonId: params.id,
      page: query.page!,
      limit: query.limit!,
    });
  }
}
