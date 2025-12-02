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
import { RequestUser } from '../auth/interfaces/jwt-payload.interface';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PasskeyService } from '../passkey/passkey.service';

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class SettingsController {
  constructor(private readonly passkeyService: PasskeyService) {}

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
  async listPasskeys(@CurrentUser() user: RequestUser) {
    return this.passkeyService.getUserPasskeys(user.id);
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
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.passkeyService.updatePasskeyName(user.id, id, name);
  }

  @Delete('passkeys/:id')
  @ApiOperation({
    summary: 'Delete passkey',
    description:
      'Remove a passkey from the account (requires at least one other auth method)',
  })
  @ApiParam({ name: 'id', description: 'Passkey ID' })
  @ApiResponse({
    status: 200,
    description: 'Passkey deleted successfully',
    schema: {
      example: {
        message: 'Passkey deleted successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete last authentication method',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deletePasskey(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.passkeyService.deletePasskey(user.id, id);
  }
}
