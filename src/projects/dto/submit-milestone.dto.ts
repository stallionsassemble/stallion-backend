import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitMilestoneDto {
  @ApiProperty({ description: 'Submission note describing the work completed' })
  @IsString()
  @IsNotEmpty()
  submissionNote: string;

  @ApiPropertyOptional({
    description: 'URL to submission (e.g., GitHub PR, demo link)',
  })
  @IsOptional()
  @IsString()
  submissionUrl?: string;
}
