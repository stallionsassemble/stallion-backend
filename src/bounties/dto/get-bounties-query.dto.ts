import { ApiPropertyOptional } from '@nestjs/swagger';
import { Bounty, BountyStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum BountySortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  REWARD = 'reward',
  SUBMISSION_DEADLINE = 'submissionDeadline',
  JUDGING_DEADLINE = 'judgingDeadline',
  TITLE = 'title',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetBountiesQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: BountySortField,
    default: BountySortField.CREATED_AT,
    example: BountySortField.CREATED_AT,
  })
  @IsOptional()
  @IsEnum(BountySortField)
  sortBy?: BountySortField = BountySortField.CREATED_AT;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: SortOrder.DESC,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({
    description: 'Filter by bounty status',
    enum: BountyStatus,
    example: BountyStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(BountyStatus)
  status?: BountyStatus;

  @ApiPropertyOptional({
    description: 'Filter by reward currency',
    example: 'USDC',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Filter by skills (comma-separated or array)',
    type: [String],
    example: 'React,TypeScript,Web3',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean);
    }
    return Array.isArray(value) ? value : [];
  })
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Search in title and description',
    example: 'DeFi dashboard',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by owner ID',
    example: 'user-uuid-123',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Minimum reward amount',
    example: '1000000000',
  })
  @IsOptional()
  @IsString()
  minReward?: string;

  @ApiPropertyOptional({
    description: 'Maximum reward amount',
    example: '10000000000',
  })
  @IsOptional()
  @IsString()
  maxReward?: string;
}

export class PaginatedBountiesResponseDto {
  @ApiPropertyOptional({
    description: 'List of bounties',
    type: 'array',
  })
  data: Bounty[];

  @ApiPropertyOptional({
    description: 'Pagination metadata',
    example: {
      total: 100,
      page: 1,
      limit: 10,
      totalPages: 10,
      hasNextPage: true,
      hasPreviousPage: false,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
