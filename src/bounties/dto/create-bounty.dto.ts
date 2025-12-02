import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBountyDto {
  @ApiProperty({
    description: 'Bounty title',
    example: 'Build a responsive landing page',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'Short description of the bounty',
    example: 'Create a modern landing page with React and TailwindCSS',
  })
  @IsString()
  shortDescription: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the bounty requirements',
    example:
      'Full requirements: responsive design, mobile-first, dark mode support...',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Reward amount',
    example: 500,
  })
  @Type(() => Number)
  @IsNumber()
  reward: number;

  @ApiProperty({
    description: 'Reward currency',
    example: 'USDC',
  })
  @IsString()
  rewardCurrency: string;

  @ApiPropertyOptional({
    description: 'Reward distribution configuration',
    example: { first: 70, second: 20, third: 10 },
  })
  @IsObject()
  @IsOptional()
  rewardDistribution?: any;

  @ApiPropertyOptional({
    description:
      'Custom fields that submitters must fill when submitting to this bounty',
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
  @IsObject()
  @IsOptional()
  submissionFields?: any;
}
