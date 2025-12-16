import { IsOptional, IsString } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
