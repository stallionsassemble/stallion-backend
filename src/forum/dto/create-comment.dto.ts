import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: 'Content of the comment',
    example: 'This is a great post!',
  })
  @IsString()
  content: string;

  @ApiProperty({
    description: 'ID of the post this comment belongs to',
    example: 'post-uuid',
  })
  @IsString()
  postId: string;

  @ApiPropertyOptional({
    description: 'ID of the parent comment if this is a reply',
    example: 'comment-uuid',
  })
  @IsOptional()
  @IsString()
  parentId?: string;
}
