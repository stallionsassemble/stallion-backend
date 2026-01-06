import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CommentIdParamDto {
  @ApiProperty({
    description: 'Comment ID',
    example: 'comment-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
