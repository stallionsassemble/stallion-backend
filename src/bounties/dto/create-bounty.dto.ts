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
  IsPositive,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'distributionSum', async: false })
export class DistributionSumConstraint implements ValidatorConstraintInterface {
  validate(distribution: RewardDistributionItem[] | undefined) {
    if (!distribution || distribution.length === 0) {
      return false;
    }
    const total = distribution.reduce((sum, item) => sum + item.percentage, 0);
    return total === 100;
  }

  defaultMessage() {
    return 'Distribution percentages must sum to 100';
  }
}

@ValidatorConstraint({ name: 'submissionDeadlineValid', async: false })
export class SubmissionDeadlineConstraint
  implements ValidatorConstraintInterface
{
  validate(submissionDeadline: string | undefined) {
    if (!submissionDeadline) {
      return false;
    }
    const deadline = new Date(submissionDeadline);
    const now = new Date();
    return deadline > now;
  }

  defaultMessage() {
    return 'Submission deadline must be in the future';
  }
}

@ValidatorConstraint({ name: 'judgingDeadlineValid', async: false })
export class JudgingDeadlineConstraint implements ValidatorConstraintInterface {
  validate(judgingDeadline: string | undefined, args: any) {
    if (!judgingDeadline) {
      return false;
    }
    const judging = new Date(judgingDeadline);
    const submission = new Date(args.object.submissionDeadline);
    return judging > submission;
  }

  defaultMessage() {
    return 'Judging deadline must be after submission deadline';
  }
}

export class SubmissionFieldItem {
  @ApiProperty({
    description: 'Field name (used as key)',
    example: 'githubUrl',
  })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({
    description: 'Field label (display name)',
    example: 'GitHub Repository URL',
  })
  @IsString()
  @Length(1, 100)
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
  @MaxLength(200)
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
  @IsPositive()
  @Min(1)
  rank: number;

  @ApiProperty({ description: 'Percentage of reward', example: 70 })
  @IsNumber()
  @IsPositive()
  @Min(1)
  percentage: number;
}

export class AttachmentItem {
  @ApiProperty({
    description: 'Original filename',
    example: 'requirements.pdf',
  })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiProperty({
    description: 'File URL',
    example: 'http://localhost:3000/uploads/documents/1234567890-abc123.pdf',
  })
  @IsUrl()
  url: string;

  @ApiProperty({ description: 'File size in bytes', example: 102400 })
  @IsNumber()
  @IsPositive()
  size: number;

  @ApiProperty({
    description: 'File MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @MaxLength(100)
  mimetype: string;
}

export class CreateBountyDto {
  @ApiProperty({
    description: 'Bounty title',
    example: 'Build a responsive landing page',
  })
  @IsString()
  @Length(5, 100)
  title: string;

  @ApiProperty({
    description: 'Short description of the bounty',
    example: 'Create a modern landing page with React and TailwindCSS',
  })
  @IsString()
  @Length(10, 200)
  shortDescription: string;

  @ApiProperty({
    description: 'Detailed description of the bounty requirements',
    example:
      'Full requirements: responsive design, mobile-first, dark mode support...',
  })
  @IsString()
  @Length(10, 10000)
  @IsOptional()
  description: string;

  @ApiProperty({
    description: 'Reward amount',
    example: 500,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @Min(1)
  reward: number;

  @ApiProperty({
    description: 'Reward currency',
    example: 'USDC',
  })
  @IsString()
  @Length(2, 10)
  rewardCurrency: string;

  @ApiPropertyOptional({
    description: 'Required skills for the bounty',
    type: [String],
    example: ['React', 'TypeScript', 'TailwindCSS', 'Web3'],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  @IsOptional()
  skills?: string[];

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

  @ApiPropertyOptional({
    description: 'Attachments for the bounty (documents, images, etc.)',
    type: [AttachmentItem],
    example: [
      {
        filename: 'requirements.pdf',
        url: 'http://localhost:3000/uploads/documents/1234567890-abc123.pdf',
        size: 102400,
        mimetype: 'application/pdf',
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentItem)
  @IsOptional()
  attachments?: AttachmentItem[];

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
  @Validate(DistributionSumConstraint)
  distribution: RewardDistributionItem[];

  @ApiProperty({
    description: 'Submission deadline (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsDateString()
  @Validate(SubmissionDeadlineConstraint)
  submissionDeadline: string;

  @ApiProperty({
    description: 'Judging deadline (ISO 8601 format)',
    example: '2025-01-15T23:59:59Z',
  })
  @IsDateString()
  @Validate(JudgingDeadlineConstraint)
  judgingDeadline: string;
}
