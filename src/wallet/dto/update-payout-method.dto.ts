import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdatePayoutMethodDto {
  @ApiPropertyOptional({
    description: 'User-friendly name for the payout method',
    example: 'My Updated Wallet',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Stellar public key (starts with G and is 56 characters)',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsOptional()
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'Invalid Stellar public key format',
  })
  publicKey?: string;

  @ApiPropertyOptional({
    description: 'Set as default payout method',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
