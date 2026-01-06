import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CategorySlugParamDto {
  @ApiProperty({
    description: 'Category slug',
    example: 'general-discussion',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
