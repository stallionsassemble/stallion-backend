import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Name of the category',
    example: 'General Discussion',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'URL-friendly slug for the category',
    example: 'general-discussion',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    description: 'Description of the category',
    example: 'General topics and discussions',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Icon emoji for the category',
    example: '💬',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    description: 'Whether the category is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
