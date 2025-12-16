import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      '6-digit TOTP code from authenticator app (required if MFA is enabled)',
    example: '123456',
    required: false,
  })
  @IsOptional()
  @IsString()
  totpCode?: string;
}
