import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  AttachmentItem,
  RewardDistributionItem,
  SubmissionFieldItem,
} from './create-bounty.dto';

@ValidatorConstraint({ name: 'distributionSum', async: false })
export class DistributionSumConstraint implements ValidatorConstraintInterface {
  validate(distribution: RewardDistributionItem[] | undefined) {
    if (!distribution || distribution.length === 0) {
      return true; // Optional field, skip validation if not provided
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
      return true; // Optional field
    }
    const deadline = new Date(submissionDeadline);
    const now = new Date();
    return deadline > now;
  }

  defaultMessage() {
    return 'Submission deadline cannot be in the past';
  }
}

export class UpdateBountyDto {
  @ApiPropertyOptional({
    description: 'Updated bounty title',
    example: 'Build a responsive landing page (Updated)',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated short description of the bounty',
    example: 'Create a modern landing page with React and TailwindCSS',
  })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({
    description: 'Updated detailed description of the bounty requirements',
    example:
      'Full requirements: responsive design, mobile-first, dark mode support...',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated reward distribution configuration',
    example: { first: 70, second: 20, third: 10 },
  })
  @IsOptional()
  rewardDistribution?: any;

  @ApiPropertyOptional({
    description:
      'Updated custom fields that submitters must fill when submitting to this bounty',
    type: [SubmissionFieldItem],
    example: [
      {
        name: 'githubUrl',
        label: 'GitHub Repository URL',
        type: 'url',
        required: true,
      },
      { name: 'demoUrl', label: 'Live Demo URL', type: 'url', required: false },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionFieldItem)
  @IsOptional()
  submissionFields?: SubmissionFieldItem[];

  @ApiPropertyOptional({
    description: 'Updated attachments for the bounty (documents, images, etc.)',
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

  @ApiPropertyOptional({
    description: 'Updated reward distribution by rank',
    example: [
      { rank: 1, percentage: 60 },
      { rank: 2, percentage: 30 },
      { rank: 3, percentage: 10 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardDistributionItem)
  @Validate(DistributionSumConstraint)
  @IsOptional()
  distribution?: RewardDistributionItem[];

  @ApiPropertyOptional({
    description:
      'Updated submission deadline (ISO 8601 format). Cannot be in the past or after judging deadline.',
    example: '2025-01-31T23:59:59Z',
  })
  @IsDateString()
  @Validate(SubmissionDeadlineConstraint)
  @IsOptional()
  submissionDeadline?: string;
}
