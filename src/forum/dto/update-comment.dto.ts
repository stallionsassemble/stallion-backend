import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateCommentDto {
  @ApiProperty({
    description: 'Updated content of the comment',
    example: 'Updated comment content...',
  })
  @IsString()
  content: string;
}
