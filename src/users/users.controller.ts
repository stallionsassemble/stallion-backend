import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import {
  GetAllSubmissionsQueryDto,
  PaginatedAllSubmissionsDto,
} from './dto/get-all-submissions.dto';
import { IdentifierParamDto } from './dto/identifier-param.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    @Param() params: UserIdParamDto,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.usersService.createReview(
      reviewerId,
      params.userId,
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
              role: 'CONTRIBUTOR',
              location: 'New York',
              skills: ['JavaScript', 'TypeScript'],
              socials: ['https://example.com', 'https://example.com'],
              companyName: 'Example Company',
              companyLogo: 'https://example.com/logo.jpg',
              companyBio: 'This is an example company',
            },
          },
        ],
        averageRating: 4.5,
        totalReviews: 10,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserReviews(@Param() params: UserIdParamDto) {
    return this.usersService.getUserReviews(params.userId);
  }

  @Get('submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all user submissions (bounty + project)',
    description:
      'Retrieve all submissions (bounty and project applications) for the authenticated user with pagination, filtering, and sorting',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of all user submissions',
    type: PaginatedAllSubmissionsDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMySubmissions(
    @CurrentUser('id') userId: string,
    @Query() query: GetAllSubmissionsQueryDto,
  ): Promise<PaginatedAllSubmissionsDto> {
    return this.usersService.getAllSubmissions(userId, query);
  }

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
    @Param() params: IdentifierParamDto,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfile(params.identifier);
  }
}
