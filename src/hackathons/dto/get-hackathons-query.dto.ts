import { ApiPropertyOptional } from '@nestjs/swagger';
import { HackathonStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GetHackathonsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by hackathon status',
    enum: HackathonStatus,
  })
  @IsOptional()
  @IsEnum(HackathonStatus)
  status?: HackathonStatus;

  @ApiPropertyOptional({
    description: 'Filter by owner ID',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;
}
