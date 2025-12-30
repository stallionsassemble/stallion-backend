import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateBountyApplicationDto {
  @ApiPropertyOptional({
    description: 'Link to the submission',
    example: 'https://github.com/user/repo',
  })
  @IsString()
  @IsOptional()
  submissionLink?: string;

  @ApiPropertyOptional({
    description: 'Dynamic submission fields based on bounty requirements',
    example: {
      githubRepo: 'https://github.com/user/repo',
      liveDemo: 'https://demo.example.com',
      estimatedHours: 40,
    },
  })
  @IsObject()
  @IsOptional()
  submissionData?: Record<string, any>;
}
