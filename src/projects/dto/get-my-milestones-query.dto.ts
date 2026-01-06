import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GetMyMilestonesQueryDto {
  @ApiPropertyOptional({
    description: 'Filter milestones by project ID',
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}
