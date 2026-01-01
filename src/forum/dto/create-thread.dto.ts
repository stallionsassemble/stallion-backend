import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateThreadDto {
  @ApiProperty({
    description: 'Title of the thread',
    example: 'How to get started with bounties?',
  })
  @IsString()
  title: string;

  @ApiProperty({
    description: 'URL-friendly slug for the thread',
    example: 'how-to-get-started-with-bounties',
  })
  @IsString()
  slug: string;

  @ApiProperty({
    description: 'ID of the category this thread belongs to',
    example: 'cat-uuid',
  })
  @IsString()
  categoryId: string;

  @ApiProperty({
    description: 'Content of the thread',
    example:
      'I am new here and would like to know how to participate in bounties...',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Tags for the thread',
    type: [String],
    example: ['beginner', 'tutorial'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
