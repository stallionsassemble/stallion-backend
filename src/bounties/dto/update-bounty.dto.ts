import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Length,
  Validate,
  ValidateNested,
} from 'class-validator';
import {
  AttachmentItem,
  DistributionSumConstraint,
  RewardDistributionItem,
  SubmissionDeadlineConstraint,
  SubmissionFieldItem,
} from './create-bounty.dto';

export class UpdateBountyDto {
  @ApiPropertyOptional({
    description: 'Updated bounty title',
    example: 'Build a responsive landing page (Updated)',
  })
  @IsString()
  @Length(5, 100)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated short description of the bounty',
    example: 'Create a modern landing page with React and TailwindCSS',
  })
  @IsString()
  @Length(10, 200)
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({
    description: 'Updated detailed description of the bounty requirements',
    example:
      'Full requirements: responsive design, mobile-first, dark mode support...',
  })
  @IsString()
  @Length(10, 10000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Updated required skills for the bounty',
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
