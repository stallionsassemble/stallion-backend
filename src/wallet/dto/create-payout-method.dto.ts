import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreatePayoutMethodDto {
  @ApiProperty({
    description: 'User-friendly name for the payout method',
    example: 'My Ledger Wallet',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Stellar public key (starts with G and is 56 characters)',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'Invalid Stellar public key format',
  })
  publicKey: string;

  @ApiProperty({
    description: 'Set as default payout method',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
