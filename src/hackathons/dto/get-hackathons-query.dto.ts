import { ApiPropertyOptional } from '@nestjs/swagger';
import { HackathonStatus, HackathonType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetHackathonsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by hackathon status',
    enum: HackathonStatus,
  })
  @IsOptional()
  @IsEnum(HackathonStatus)
  status?: HackathonStatus;

  @ApiPropertyOptional({ description: 'Search term for title or description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by hackathon type',
    enum: HackathonType,
  })
  @IsOptional()
  @IsEnum(HackathonType)
  type?: HackathonType;

  @ApiPropertyOptional({ description: 'Filter by specific tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by company ID' })
  @IsOptional()
  @IsString()
  companyId?: string;

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
