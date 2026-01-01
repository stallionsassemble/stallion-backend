import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ActivityType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActivitiesService } from './activities.service';

@ApiTags('Activities')
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all app-wide activities',
    description: 'Retrieve all activities across the platform',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'type', required: false, enum: ActivityType })
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
  async getAllActivities(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: ActivityType,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getActivities({
      page: pageNum,
      limit: limitNum,
      type,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my activities',
    description: 'Retrieve activities for the current user',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivities(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getUserActivities(userId, pageNum, limitNum);
  }

  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user activities',
    description: 'Retrieve activities for a specific user',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'User activities retrieved successfully',
  })
  async getUserActivities(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getUserActivities(userId, pageNum, limitNum);
  }

  @Get('bounty/:bountyId')
  @ApiOperation({
    summary: 'Get bounty activities',
    description: 'Retrieve all activities for a specific bounty',
  })
  @ApiParam({ name: 'bountyId', description: 'Bounty ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Bounty activities retrieved successfully',
  })
  async getBountyActivities(
    @Param('bountyId') bountyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getBountyActivities(
      bountyId,
      pageNum,
      limitNum,
    );
  }

  @Get('project/:projectId')
  @ApiOperation({
    summary: 'Get project activities',
    description: 'Retrieve all activities for a specific project',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Project activities retrieved successfully',
  })
  async getProjectActivities(
    @Param('projectId') projectId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getProjectActivities(
      projectId,
      pageNum,
      limitNum,
    );
  }

  @Get('hackathon/:hackathonId')
  @ApiOperation({
    summary: 'Get hackathon activities',
    description: 'Retrieve all activities for a specific hackathon',
  })
  @ApiParam({ name: 'hackathonId', description: 'Hackathon ID' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Hackathon activities retrieved successfully',
  })
  async getHackathonActivities(
    @Param('hackathonId') hackathonId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.activitiesService.getHackathonActivities(
      hackathonId,
      pageNum,
      limitNum,
    );
  }
}
