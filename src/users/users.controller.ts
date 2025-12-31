import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
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
}
