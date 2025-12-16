import { IsString } from 'class-validator';

export class AddReactionDto {
  @IsString()
  postId: string;

  @IsString()
  emoji: string;
}
