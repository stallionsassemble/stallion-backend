import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AttachmentItem } from 'src/bounties/dto';

export class ApplyToProjectDto {
  @ApiProperty({
    description: 'Cover letter explaining interest and qualifications',
  })
  @IsString()
  @IsNotEmpty()
  coverLetter: string;

  @ApiPropertyOptional({
    description:
      'Estimated completion time in days (required for GIG projects)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedCompletionTime?: number;

  @ApiPropertyOptional({
    description: 'Portfolio links',
    type: [String],
    example: ['https://github.com/user/project', 'https://portfolio.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  portfolioLinks?: string[];

  @ApiPropertyOptional({
    description: 'Application attachments',
    example: [{ filename: 'resume.pdf', url: 'https://...', size: 1024 }],
  })
  @IsOptional()
  attachments?: AttachmentItem[];
}
