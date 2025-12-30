import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: 'ID of the thread to post in',
    example: 'thread-uuid',
  })
  @IsString()
  threadId: string;

  @ApiProperty({
    description: 'Content of the post',
    example: 'This is my reply to the thread...',
  })
  @IsString()
  content: string;
}
