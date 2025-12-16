import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  hackathonId: string;

  @IsString()
  trackId: string;

  @IsObject()
  submissionData: Record<string, any>;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  projectUrl?: string;

  @IsOptional()
  @IsString()
  repositoryUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
