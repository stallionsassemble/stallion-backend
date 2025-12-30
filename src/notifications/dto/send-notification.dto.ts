import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export class SendNotificationDto {
  @ApiProperty({
    description: 'ID of the user to send notification to',
    example: 'user-uuid',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.BOUNTY_COMPLETED,
  })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({
    description: 'Title of the notification',
    example: 'Bounty Completed',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Message content of the notification',
    example: 'Your bounty has been completed successfully',
  })
  @IsString()
  message: string;

  @ApiPropertyOptional({
    description: 'Additional data payload for the notification',
    example: { bountyId: 'bounty-uuid', amount: 1000 },
  })
  @IsOptional()
  @IsObject()
  data?: any;

  @ApiPropertyOptional({
    description: 'Send as in-app notification',
    example: true,
  })
  @IsOptional()
  sendInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Send as email notification',
    example: false,
  })
  @IsOptional()
  sendEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Send as push notification',
    example: true,
  })
  @IsOptional()
  sendPush?: boolean;
}
