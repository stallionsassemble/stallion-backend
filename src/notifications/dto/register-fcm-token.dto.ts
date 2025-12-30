import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegisterFcmTokenDto {
  @ApiProperty({
    description: 'Firebase Cloud Messaging token',
    example: 'fcm-token-string-here',
  })
  @IsString()
  token: string;

  @ApiPropertyOptional({
    description: 'Unique device identifier',
    example: 'device-12345',
  })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({
    description: 'Device platform',
    example: 'android',
  })
  @IsOptional()
  @IsString()
  platform?: string;
}
