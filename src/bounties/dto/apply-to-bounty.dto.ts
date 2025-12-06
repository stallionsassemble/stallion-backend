import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class ApplyToBountyDto {
  @ApiProperty({
    description: 'Link to the submission',
    example: 'https://github.com/user/repo',
  })
  @IsString()
  submissionLink: string;

  @ApiProperty({
    description: 'Dynamic submission fields based on bounty requirements',
    example: {
      githubRepo: 'https://github.com/user/repo',
      liveDemo: 'https://demo.example.com',
      estimatedHours: 40,
    },
    required: false,
  })
  @IsObject()
  @IsOptional()
  submissionData?: Record<string, any>;
}
