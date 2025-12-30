import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdatePostDto {
  @ApiProperty({
    description: 'Updated content of the post',
    example: 'Updated post content...',
  })
  @IsString()
  content: string;
}
