import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class MilestoneDto {
  @ApiProperty({ description: 'Milestone title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Milestone description' })
  @IsString()
  @IsNotEmpty()
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
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Short description of the project' })
  @IsString()
  @IsNotEmpty()
  shortDescription: string;

  @ApiProperty({ description: 'Detailed project description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Project requirements',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requirements?: string[];

  @ApiPropertyOptional({
    description: 'Project deliverables',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  deliverables?: string[];

  @ApiProperty({
    description: 'Required skills',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  skills: string[];

  @ApiPropertyOptional({
    description: 'Project attachments',
    example: [{ filename: 'spec.pdf', url: 'https://...', size: 1024 }],
  })
  @IsOptional()
  attachments?: any;

  @ApiProperty({ description: 'Total reward amount (in smallest unit)' })
  @IsString()
  @IsNotEmpty()
  reward: string;

  @ApiProperty({ description: 'Currency code', example: 'XLM' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'Project deadline' })
  @IsDateString()
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
