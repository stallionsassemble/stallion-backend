import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReactionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
  })
  @IsOptional()
  @IsString()
  userId?: string;
}
