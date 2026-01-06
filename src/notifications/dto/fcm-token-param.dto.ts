import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FcmTokenParamDto {
  @ApiProperty({
    description: 'FCM token',
    example: 'fcm-token-string',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
