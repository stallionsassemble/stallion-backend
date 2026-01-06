import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetSubmissionsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by track ID',
  })
  @IsOptional()
  @IsString()
  trackId?: string;
}
