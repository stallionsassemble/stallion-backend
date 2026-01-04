import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddCommentReactionDto {
  @ApiProperty({
    description: 'Emoji to react with',
    example: '👍',
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10, { message: 'Emoji must be at most 10 characters' })
  emoji: string;
}

export class CommentReactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  emoji: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  commentId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ required: false })
  user?: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
  };
}

export class CommentReactionSummaryDto {
  @ApiProperty()
  emoji: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [String] })
  userIds: string[];

  @ApiProperty()
  hasReacted: boolean;
}
