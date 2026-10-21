import { ApiPropertyOptional } from '@nestjs/swagger';
import { HackathonStatus, HackathonType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Only return published hackathons still open (deadline in the future)',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  open?: boolean;

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
