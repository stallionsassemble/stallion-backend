import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  submissionLink: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, type: Object, example: { title: 'link' } })
  @IsOptional()
  @IsObject()
  submissionData?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  projectUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  hackathonId?: string;
}
