import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class TrackFieldDefinition {
  @IsString()
  name: string;

  @IsString()
  type: string; // 'text', 'url', 'file', 'textarea', etc.

  @IsString()
  label: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

class CreateTrackDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  prizePool: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMinSize(1)
  rewardDistribution: number[]; // Percentages for each position

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackFieldDefinition)
  submissionFields?: TrackFieldDefinition[];

  @IsOptional()
  @IsInt()
  @Min(1)
  maxSubmissions?: number;

  @IsOptional()
  @IsBoolean()
  isMainTrack?: boolean;
}

export class CreateHackathonDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  description: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsString()
  currency?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTrackDto)
  @ArrayMinSize(1)
  tracks: CreateTrackDto[];
}
