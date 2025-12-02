import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum } from 'class-validator';

export class RequestVerificationDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsEnum(['CONTRIBUTOR', 'PROJECT_OWNER'])
  @ApiProperty({
    enum: ['CONTRIBUTOR', 'PROJECT_OWNER'],
    example: 'CONTRIBUTOR',
  })
  role: 'CONTRIBUTOR' | 'PROJECT_OWNER';
}
