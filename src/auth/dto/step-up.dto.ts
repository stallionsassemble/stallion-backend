import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, Length } from 'class-validator';

export class StepUpTotpDto {
  @ApiProperty({
    description: '6-digit TOTP code from authenticator app, or backup code',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  code: string;
}

export class StepUpPasskeyVerifyDto {
  @ApiProperty({
    description: 'WebAuthn authentication response JSON from browser',
  })
  @IsObject()
  @IsNotEmpty()
  response: any;
}

export class StepUpTokenResponseDto {
  @ApiProperty({
    description: 'Time-limited step-up token for sensitive operations',
    example: '4f2b1c8a9e...',
  })
  stepUpToken: string;

  @ApiProperty({
    description: 'Token validity in seconds',
    example: 300,
  })
  expiresInSeconds: number;
}
