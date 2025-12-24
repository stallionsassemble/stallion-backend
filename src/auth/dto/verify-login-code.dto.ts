import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

export class VerifyLoginCodeDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @Length(6, 6)
  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  code: string;

  @IsOptional()
  @IsString()
  @Length(6, 6)
  @ApiProperty({
    example: '123456',
    description: '6-digit TOTP code (required if MFA is enabled)',
    required: false,
  })
  totpCode?: string;
}
