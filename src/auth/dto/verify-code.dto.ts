import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyCodeDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @Length(6, 6)
  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  code: string;
}
