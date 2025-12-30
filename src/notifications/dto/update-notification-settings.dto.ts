import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable in-app notifications for chat messages',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  chatInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications for chat messages',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  chatEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable in-app notifications for wallet activity',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  walletInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications for wallet activity',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  walletEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable in-app notifications for bounty updates',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  bountyInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications for bounty updates',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  bountyEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable in-app notifications for forum activity',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  forumInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications for forum activity',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  forumEmail?: boolean;

  @ApiPropertyOptional({
    description: 'Enable in-app notifications for system messages',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  systemInApp?: boolean;

  @ApiPropertyOptional({
    description: 'Enable email notifications for system messages',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  systemEmail?: boolean;
}
