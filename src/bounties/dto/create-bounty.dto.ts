import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SubmissionFieldItem {
  @ApiProperty({
    description: 'Field name (used as key)',
    example: 'githubUrl',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Field label (display name)',
    example: 'GitHub Repository URL',
  })
  @IsString()
  label: string;

  @ApiProperty({
    description: 'Field type',
    example: 'url',
    enum: ['text', 'url', 'number', 'textarea'],
  })
  @IsIn(['text', 'url', 'number', 'textarea'])
  type: 'text' | 'url' | 'number' | 'textarea';

  @ApiProperty({ description: 'Whether field is required', example: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({
    description: 'Placeholder text',
    example: 'https://github.com/...',
  })
  @IsString()
  @IsOptional()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Validation rules' })
  @IsObject()
  @IsOptional()
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export class RewardDistributionItem {
  @ApiProperty({ description: 'Rank position', example: 1 })
  @IsNumber()
  rank: number;

  @ApiProperty({ description: 'Percentage of reward', example: 70 })
  @IsNumber()
  percentage: number;
}

export class CreateBountyDto {
  @ApiProperty({
    description: 'Bounty title',
    example: 'Build a responsive landing page',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Short description of the bounty',
    example: 'Create a modern landing page with React and TailwindCSS',
  })
  @IsString()
  shortDescription: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the bounty requirements',
    example:
      'Full requirements: responsive design, mobile-first, dark mode support...',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Reward amount',
    example: 500,
  })
  @Type(() => Number)
  @IsNumber()
  reward: number;

  @ApiProperty({
    description: 'Reward currency',
    example: 'USDC',
  })
  @IsString()
  rewardCurrency: string;

  @ApiPropertyOptional({
    description: 'Reward distribution configuration',
    example: { first: 70, second: 20, third: 10 },
  })
  @IsObject()
  @IsOptional()
  rewardDistribution?: any;

  @ApiPropertyOptional({
    description:
      'Custom fields that submitters must fill when submitting to this bounty',
    type: [SubmissionFieldItem],
    example: [
      {
        name: 'githubUrl',
        label: 'GitHub Repository URL',
        type: 'url',
        required: true,
      },
      { name: 'demoUrl', label: 'Live Demo URL', type: 'url', required: false },
      {
        name: 'description',
        label: 'Solution Description',
        type: 'text',
        required: true,
      },
      {
        name: 'estimatedHours',
        label: 'Hours Spent',
        type: 'number',
        required: false,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionFieldItem)
  @IsOptional()
  submissionFields?: SubmissionFieldItem[];

  @ApiProperty({
    description: 'Reward distribution by rank',
    example: [
      { rank: 1, percentage: 70 },
      { rank: 2, percentage: 20 },
      { rank: 3, percentage: 10 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardDistributionItem)
  distribution: RewardDistributionItem[];

  @ApiProperty({
    description: 'Submission deadline (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  submissionDeadline: string;

  @ApiProperty({
    description: 'Judging deadline (ISO 8601 format)',
    example: '2025-01-15T23:59:59Z',
  })
  @IsDateString()
  judgingDeadline: string;
}
