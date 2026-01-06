import { ApiPropertyOptional } from '@nestjs/swagger';
import { TxState, TxType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsOptional, Min } from 'class-validator';

export class GetTransactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    enum: TxType,
  })
  @IsOptional()
  @IsEnum(TxType)
  type?: TxType;

  @ApiPropertyOptional({
    description: 'Filter by transaction state',
    enum: TxState,
  })
  @IsOptional()
  @IsEnum(TxState)
  state?: TxState;

  @ApiPropertyOptional({
    description: 'Filter transactions from this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter transactions until this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of transactions to retrieve',
    minimum: 1,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Offset for pagination',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
