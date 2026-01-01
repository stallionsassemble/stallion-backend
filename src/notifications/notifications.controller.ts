import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get notifications',
    description: 'Retrieve user notifications with pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of notifications to retrieve (default: 50)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Offset for pagination (default: 0)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    schema: {
      example: [
        {
          id: 'notif-uuid-1',
          userId: 'user-uuid',
          type: 'BOUNTY_COMPLETED',
          title: 'Bounty Completed',
          message: 'Your bounty "Build a DeFi Dashboard" has been completed',
          data: {
            bountyId: 'bounty-uuid',
            bountyTitle: 'Build a DeFi Dashboard',
          },
          isRead: false,
          createdAt: '2024-03-01T12:00:00.000Z',
        },
        {
          id: 'notif-uuid-2',
          userId: 'user-uuid',
          type: 'NEW_MESSAGE',
          title: 'New Message',
          message: 'You have a new message from john_doe',
          data: {
            conversationId: 'conv-uuid',
            senderId: 'user-uuid-2',
          },
          isRead: false,
          createdAt: '2024-03-01T11:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getNotifications(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(
      userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread count',
    description: 'Get the number of unread notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
    schema: {
      example: {
        count: 7,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUnreadCount(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark as read',
    description: 'Mark a notification as read',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: {
      example: {
        id: 'notif-uuid',
        userId: 'user-uuid',
        type: 'BOUNTY_COMPLETED',
        title: 'Bounty Completed',
        message: 'Your bounty has been completed',
        isRead: true,
        updatedAt: '2024-03-01T12:30:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all as read',
    description: 'Mark all notifications as read',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      example: {
        message: 'All notifications marked as read',
        count: 12,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAllAsRead(@CurrentUser('id') userId: string) {
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a specific notification',
  })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  deleteNotification(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.deleteNotification(id, userId);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Get notification settings',
    description: 'Retrieve user notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification settings',
    schema: {
      example: {
        id: 'settings-uuid',
        userId: 'user-uuid',
        emailNotifications: true,
        pushNotifications: true,
        bountyUpdates: true,
        messageNotifications: true,
        forumReplies: true,
        reputationChanges: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-03-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getNotificationSettings(@CurrentUser('id') userId: string) {
    return this.notificationsService.getNotificationSettings(userId);
  }

  @Patch('settings')
  @ApiOperation({
    summary: 'Update notification settings',
    description: 'Update user notification preferences',
  })
  @ApiResponse({
    status: 200,
    description: 'Settings updated successfully',
    schema: {
      example: {
        id: 'settings-uuid',
        userId: 'user-uuid',
        emailNotifications: true,
        pushNotifications: false,
        bountyUpdates: true,
        messageNotifications: true,
        forumReplies: true,
        reputationChanges: false,
        updatedAt: '2024-03-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateNotificationSettings(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateNotificationSettings(userId, dto);
  }

  @Post('fcm-token')
  @ApiOperation({
    summary: 'Register FCM token',
    description:
      'Register a Firebase Cloud Messaging token for push notifications',
  })
  @ApiResponse({
    status: 201,
    description: 'FCM token registered successfully',
    schema: {
      example: {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: 'fcm-token-string',
        deviceType: 'android',
        createdAt: '2024-03-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  registerFcmToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterFcmTokenDto,
  ) {
    return this.notificationsService.registerFcmToken(userId, dto);
  }

  @Delete('fcm-token/:token')
  @ApiOperation({
    summary: 'Remove FCM token',
    description: 'Remove a Firebase Cloud Messaging token',
  })
  @ApiParam({ name: 'token', description: 'FCM token to remove' })
  @ApiResponse({
    status: 204,
    description: 'FCM token removed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  removeFcmToken(
    @Param('token') token: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.removeFcmToken(token, userId);
  }

  @Get('fcm-tokens')
  @ApiOperation({
    summary: 'Get FCM tokens',
    description: 'Retrieve all registered FCM tokens for the user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of FCM tokens',
    schema: {
      example: [
        {
          id: 'token-uuid-1',
          userId: 'user-uuid',
          token: 'fcm-token-string-1',
          deviceType: 'android',
          createdAt: '2024-03-01T12:00:00.000Z',
        },
        {
          id: 'token-uuid-2',
          userId: 'user-uuid',
          token: 'fcm-token-string-2',
          deviceType: 'ios',
          createdAt: '2024-02-15T10:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUserFcmTokens(@CurrentUser('id') userId: string) {
    return this.notificationsService.getUserFcmTokens(userId);
  }
}
