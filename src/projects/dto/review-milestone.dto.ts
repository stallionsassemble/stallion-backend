import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewMilestoneDto {
  @ApiProperty({ description: 'Whether to approve the milestone' })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({
    description: 'Review note (required for approval)',
  })
  @IsOptional()
  @IsString()
  reviewNote?: string;

  @ApiPropertyOptional({
    description: 'Revision note (required if requesting revision)',
  })
  @IsOptional()
  @IsString()
  revisionNote?: string;
}
