import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateThreadDto {
  @ApiPropertyOptional({
    description: 'Updated title of the thread',
    example: 'Updated: How to get started with bounties?',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Updated content of the thread',
    example: 'Updated content...',
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description: 'Whether the thread should be locked',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({
    description: 'Updated tags for the thread',
    type: [String],
    example: ['beginner', 'tutorial', 'guide'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
