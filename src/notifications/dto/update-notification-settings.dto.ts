import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  chatInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  chatEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  walletInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  walletEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  bountyInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  bountyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  forumInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  forumEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  systemInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  systemEmail?: boolean;
}
