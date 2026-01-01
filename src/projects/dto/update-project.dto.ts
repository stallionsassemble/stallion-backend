import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttachmentItem {
  @ApiPropertyOptional({
    description: 'Original filename',
    example: 'requirements.pdf',
  })
  @IsString()
  @MaxLength(255)
  filename: string;

  @ApiPropertyOptional({
    description: 'File URL',
    example: 'http://localhost:3000/uploads/documents/1234567890-abc123.pdf',
  })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 102400 })
  @IsNumber()
  @IsPositive()
  size: number;

  @ApiPropertyOptional({
    description: 'File MIME type',
    example: 'application/pdf',
  })
  @IsString()
  @MaxLength(100)
  mimetype: string;
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone title' })
  @IsString()
  @Length(3, 100)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsString()
  @Length(10, 1000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Milestone amount (in smallest unit)' })
  @IsString()
  @IsOptional()
  amount?: string;

  @ApiPropertyOptional({ description: 'Milestone due date' })
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project title' })
  @IsString()
  @Length(5, 100)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Short description of the project' })
  @IsString()
  @Length(10, 200)
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({ description: 'Detailed project description' })
  @IsString()
  @Length(10, 10000)
  @IsOptional()
  description?: string;

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

  @ApiPropertyOptional({
    description: 'Required skills',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  @IsOptional()
  skills?: string[];

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

  @ApiPropertyOptional({ description: 'Project deadline' })
  @IsDateString()
  @IsOptional()
  deadline?: string;

  @ApiPropertyOptional({
    description: 'Number of people needed',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  peopleNeeded?: number;

  @ApiPropertyOptional({
    description: 'Milestones (for GIG projects)',
    type: [UpdateMilestoneDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMilestoneDto)
  milestones?: UpdateMilestoneDto[];
}
