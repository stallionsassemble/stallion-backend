import { ApiPropertyOptional } from '@nestjs/swagger';
import { HackathonSubmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetSubmissionsQueryDto {
  @ApiPropertyOptional({ description: 'Search by project name or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: HackathonSubmissionStatus })
  @IsOptional()
  @IsEnum(HackathonSubmissionStatus)
  status?: HackathonSubmissionStatus;

  @ApiPropertyOptional({ description: 'Sort by recent or score' })
  @IsOptional()
  @IsString()
  sortBy?: 'recent' | 'score';

  @ApiPropertyOptional({ description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
