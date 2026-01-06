import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class WithdrawDto {
  @ApiProperty({
    description: 'Withdrawal amount',
    example: 100,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'USDC',
  })
  @IsString()
  currency: string;

  @ApiPropertyOptional({
    description:
      'Destination address for withdrawal (takes precedence over payoutMethodId if both provided)',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description:
      'Payout method ID (if not provided and no address, default payout method will be used)',
    example: 'payout-method-uuid',
  })
  @IsOptional()
  @IsString()
  payoutMethodId?: string;
}
