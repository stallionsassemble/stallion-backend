import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchThreadsQueryDto {
  @ApiProperty({
    description: 'Search query',
    example: 'bounties',
  })
  @IsString()
  @IsNotEmpty()
  q: string;

  @ApiPropertyOptional({
    description: 'Filter by category ID',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;
}
