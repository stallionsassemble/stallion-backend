import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GetAllSubmissionsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by submission type',
    enum: ['bounty', 'project', 'all'],
    example: 'all',
  })
  @IsOptional()
  @IsString()
  type?: 'bounty' | 'project' | 'all' = 'all';

  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'PENDING',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Search by title',
    example: 'DeFi',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: ['createdAt', 'updatedAt', 'title'],
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'updatedAt' | 'title' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class BountySubmissionItemDto {
  @ApiProperty({ description: 'Submission type', example: 'bounty' })
  type: 'bounty';

  @ApiProperty({ description: 'Submission ID' })
  id: string;

  @ApiProperty({ description: 'Submission link' })
  submissionLink: string;

  @ApiProperty({ description: 'Submission status' })
  status: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Bounty information' })
  bounty: {
    id: string;
    title: string;
    shortDescription: string;
    reward: string;
    rewardCurrency: string;
    status: string;
    submissionDeadline: Date;
  };
}

export class ProjectApplicationItemDto {
  @ApiProperty({ description: 'Submission type', example: 'project' })
  type: 'project';

  @ApiProperty({ description: 'Application ID' })
  id: string;

  @ApiProperty({ description: 'Cover letter' })
  coverLetter: string;

  @ApiProperty({ description: 'Application status' })
  status: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updatedAt: Date;

  @ApiProperty({ description: 'Project information' })
  project: {
    id: string;
    title: string;
    shortDescription: string;
    reward: string;
    currency: string;
    status: string;
    deadline: Date;
    type: string;
  };
}

export class PaginatedAllSubmissionsDto {
  @ApiProperty({
    description: 'Array of submissions (bounty and project)',
    type: 'array',
  })
  data: (BountySubmissionItemDto | ProjectApplicationItemDto)[];

  @ApiProperty({ description: 'Total number of submissions' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;
}
