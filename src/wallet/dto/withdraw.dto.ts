import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Min } from 'class-validator';

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
}
