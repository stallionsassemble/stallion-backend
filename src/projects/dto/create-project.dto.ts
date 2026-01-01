import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
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

@ValidatorConstraint({ name: 'projectDeadlineValid', async: false })
export class ProjectDeadlineConstraint implements ValidatorConstraintInterface {
  validate(deadline: string | undefined) {
    if (!deadline) {
      return false;
    }
    const deadlineDate = new Date(deadline);
    const now = new Date();
    return deadlineDate > now;
  }

  defaultMessage() {
    return 'Project deadline must be in the future';
  }
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

export class MilestoneDto {
  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  @Length(3, 100)
  title: string;

  @ApiProperty({ description: 'Milestone description' })
  @IsString()
  @Length(10, 1000)
  description: string;

  @ApiProperty({ description: 'Milestone amount (in smallest unit)' })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({ description: 'Milestone due date' })
  @IsDateString()
  dueDate: string;
}

export class CreateProjectDto {
  @ApiProperty({ description: 'Project title' })
  @IsString()
  @Length(5, 100)
  title: string;

  @ApiProperty({ description: 'Short description of the project' })
  @IsString()
  @Length(10, 200)
  shortDescription: string;

  @ApiProperty({ description: 'Detailed project description' })
  @IsString()
  @Length(10, 10000)
  description: string;

  @ApiPropertyOptional({
    description: 'Project requirements',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 500, { each: true })
  @IsOptional()
  requirements?: string[];

  @ApiPropertyOptional({
    description: 'Project deliverables',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 500, { each: true })
  @IsOptional()
  deliverables?: string[];

  @ApiProperty({
    description: 'Required skills',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  skills: string[];

  @ApiPropertyOptional({
    description: 'Project attachments',
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

  @ApiProperty({ description: 'Total reward amount (in smallest unit)' })
  @IsString()
  @IsNotEmpty()
  reward: string;

  @ApiProperty({ description: 'Currency code', example: 'XLM' })
  @IsString()
  @Length(2, 10)
  currency: string;

  @ApiProperty({ description: 'Project deadline' })
  @IsDateString()
  @Validate(ProjectDeadlineConstraint)
  deadline: string;

  @ApiProperty({
    description: 'Project type',
    enum: ProjectType,
  })
  @IsEnum(ProjectType)
  type: ProjectType;

  @ApiProperty({
    description: 'Number of people needed',
    example: 1,
    default: 1,
  })
  @IsInt()
  @Min(1)
  peopleNeeded: number;

  @ApiPropertyOptional({
    description: 'Milestones (required for GIG projects)',
    type: [MilestoneDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MilestoneDto)
  milestones?: MilestoneDto[];
}
