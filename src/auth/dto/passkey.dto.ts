import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize.decorator';

export class RegisterPasskeyDto {
  @ApiPropertyOptional({
    description: 'User-friendly name for the passkey',
    example: 'My iPhone',
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class VerifyPasskeyRegistrationDto {
  @ApiProperty({
    description: 'WebAuthn registration response from client',
  })
  @IsObject()
  @IsNotEmpty()
  response: any;

  @ApiPropertyOptional({
    description: 'User-friendly name for the passkey',
    example: 'My iPhone',
  })
  @IsString()
  @IsOptional()
  name?: string;
}

export class VerifyPasskeyAuthenticationDto {
  @ApiProperty({
    description: 'WebAuthn authentication response from client',
  })
  @IsObject()
  @IsNotEmpty()
  response: any;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;
}

export class DeletePasskeyDto {
  @ApiProperty({
    description: 'Passkey ID to delete',
    example: 'clx123...',
  })
  @IsString()
  @IsNotEmpty()
  passkeyId: string;
}
