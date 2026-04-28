import { ApiProperty } from '@nestjs/swagger';
import { HackathonSubmissionStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewSubmissionDto {
  @ApiProperty({ enum: HackathonSubmissionStatus })
  @IsEnum(HackathonSubmissionStatus)
  status: HackathonSubmissionStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  feedback?: string;
}
