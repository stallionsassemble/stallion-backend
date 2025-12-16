import { NotificationType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsObject()
  data?: any;

  @IsOptional()
  sendInApp?: boolean;

  @IsOptional()
  sendEmail?: boolean;

  @IsOptional()
  sendPush?: boolean;
}
