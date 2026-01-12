import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { AttachmentItem } from './create-project.dto';

export class SubmitMilestoneDto {
  @ApiProperty({
    description: 'Description of the work completed',
    example: 'Completed the UI design with all requested features',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    description: 'Array of URLs related to the submission',
    example: [
      'https://github.com/user/repo/pull/123',
      'https://demo.example.com',
    ],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsUrl({}, { each: true })
  links: string[];

  @ApiPropertyOptional({
    description: 'Optional attachments',
    type: [AttachmentItem],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentItem)
  attachments?: AttachmentItem[];
}
