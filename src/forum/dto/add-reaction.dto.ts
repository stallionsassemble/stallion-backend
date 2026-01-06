import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AddForumReactionDto {
  @ApiProperty({
    description: 'ID of the post to react to',
    example: 'post-uuid',
  })
  @IsString()
  postId: string;

  @ApiProperty({
    description: 'Emoji reaction',
    example: '👍',
  })
  @IsString()
  emoji: string;
}
