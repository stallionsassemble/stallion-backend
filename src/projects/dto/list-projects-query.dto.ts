import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus, ProjectType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListProjectsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by project type',
    enum: ProjectType,
  })
  @IsOptional()
  @IsEnum(ProjectType)
  type?: ProjectType;

  @ApiPropertyOptional({
    description: 'Filter by project status',
    enum: ProjectStatus,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: 'Filter by owner ID',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
