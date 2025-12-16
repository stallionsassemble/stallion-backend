import { HackathonStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateHackathonDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  allowMultipleTrackSubmissions?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubmissionsPerUser?: number;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsString()
  rules?: string;

  @IsOptional()
  prizes?: any;

  @IsOptional()
  @IsEnum(HackathonStatus)
  status?: HackathonStatus;
}
