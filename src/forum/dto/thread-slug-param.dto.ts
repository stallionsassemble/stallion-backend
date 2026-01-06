import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ThreadSlugParamDto {
  @ApiProperty({
    description: 'Thread slug',
    example: 'how-to-get-started',
  })
  @IsString()
  @IsNotEmpty()
  slug: string;
}
