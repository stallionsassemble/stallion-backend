import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterFcmTokenDto } from './dto/register-fcm-token.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationsService.getNotifications(
      req.user.userId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.userId);
  }

  @Put(':id/read')
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @Put('read-all')
  markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @Delete(':id')
  deleteNotification(@Param('id') id: string, @Request() req) {
    return this.notificationsService.deleteNotification(id, req.user.userId);
  }

  @Get('settings')
  getNotificationSettings(@Request() req) {
    return this.notificationsService.getNotificationSettings(req.user.userId);
  }

  @Put('settings')
  updateNotificationSettings(
    @Request() req,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationsService.updateNotificationSettings(
      req.user.userId,
      dto,
    );
  }

  @Post('fcm-token')
  registerFcmToken(@Request() req, @Body() dto: RegisterFcmTokenDto) {
    return this.notificationsService.registerFcmToken(req.user.userId, dto);
  }

  @Delete('fcm-token/:token')
  removeFcmToken(@Param('token') token: string, @Request() req) {
    return this.notificationsService.removeFcmToken(token, req.user.userId);
  }

  @Get('fcm-tokens')
  getUserFcmTokens(@Request() req) {
    return this.notificationsService.getUserFcmTokens(req.user.userId);
  }
}
