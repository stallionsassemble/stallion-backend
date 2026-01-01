import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { PasskeyService } from '../passkey/passkey.service';
import { UpdateContributorProfileDto } from '../users/dto/update-contributor-profile.dto';
import { UpdateProjectOwnerProfileDto } from '../users/dto/update-project-owner-profile.dto';
import { UsersService } from '../users/users.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SettingsController {
  constructor(
    private readonly passkeyService: PasskeyService,
    private readonly usersService: UsersService,
  ) {}

  @Get('passkeys')
  @ApiOperation({
    summary: 'List user passkeys',
    description: 'Get all passkeys registered for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of passkeys',
    schema: {
      example: [
        {
          id: 'clx123...',
          name: 'My iPhone',
          deviceType: 'singleDevice',
          backedUp: true,
          transports: ['internal'],
          createdAt: '2025-01-01T00:00:00.000Z',
          lastUsedAt: '2025-01-15T10:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listPasskeys(@CurrentUser('id') userId: string) {
    return this.passkeyService.getUserPasskeys(userId);
  }

  @Patch('passkeys/:id')
  @ApiOperation({
    summary: 'Update passkey name',
    description: 'Change the user-friendly name of a passkey',
  })
  @ApiParam({ name: 'id', description: 'Passkey ID' })
  @ApiResponse({
    status: 200,
    description: 'Passkey updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Passkey not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePasskeyName(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.passkeyService.updatePasskeyName(userId, id, name);
  }

  @Delete('passkeys/:id')
  @ApiOperation({
    summary: 'Delete passkey',
    description:
      'Remove a passkey from the account (requires at least one other auth method)',
  })
  @ApiParam({ name: 'id', description: 'Passkey ID' })
  @ApiResponse({
    status: 204,
    description: 'Passkey deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete last authentication method',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePasskey(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.passkeyService.deletePasskey(userId, id);
  }

  @Patch('profile/contributor')
  @ApiOperation({
    summary: 'Update contributor profile',
    description:
      'Update profile settings for contributors. Only accessible by users with CONTRIBUTOR role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or user is not a contributor',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateContributorProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateContributorProfileDto,
  ) {
    return this.usersService.updateContributorProfile(userId, dto);
  }

  @Patch('profile/project-owner')
  @ApiOperation({
    summary: 'Update project owner profile',
    description:
      'Update profile settings for project owners. Only accessible by users with PROJECT_OWNER role.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request or user is not a project owner',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProjectOwnerProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProjectOwnerProfileDto,
  ) {
    return this.usersService.updateProjectOwnerProfile(userId, dto);
  }
}
