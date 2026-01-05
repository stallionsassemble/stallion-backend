import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateReviewDto, ReviewResponseDto } from './dto/create-review.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':identifier')
  @ApiOperation({
    summary: 'Get public user profile',
    description:
      'Fetch public user profile by username or user ID. No authentication required.',
  })
  @ApiParam({
    name: 'identifier',
    description: 'Username or user ID',
    example: 'johndoe',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: PublicUserProfileDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @Param('identifier') identifier: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(identifier);
  }

  @Post(':userId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create or update a review for a user',
    description:
      'Create a review for another user. If a review already exists, it will be updated.',
  })
  @ApiParam({ name: 'userId', description: 'User ID to review' })
  @ApiResponse({
    status: 201,
    description: 'Review created or updated successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot review yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createReview(
    @Param('userId') userId: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.usersService.createReview(
      reviewerId,
      userId,
      dto.rating,
      dto.message,
    );
  }

  @Get(':userId/reviews')
  @ApiOperation({
    summary: 'Get reviews for a user',
    description: 'Get all reviews for a specific user with average rating',
  })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'Reviews retrieved successfully',
    schema: {
      example: {
        reviews: [
          {
            id: 'review-uuid',
            rating: 4.5,
            message: 'Great work!',
            createdAt: '2024-01-01T00:00:00.000Z',
            reviewer: {
              id: 'user-uuid',
              username: 'johndoe',
              firstName: 'John',
              lastName: 'Doe',
              profilePicture: 'https://example.com/profile.jpg',
            },
          },
        ],
        averageRating: 4.5,
        totalReviews: 10,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserReviews(@Param('userId') userId: string) {
    return this.usersService.getUserReviews(userId);
  }
}
