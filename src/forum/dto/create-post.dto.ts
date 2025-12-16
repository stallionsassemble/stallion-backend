import { IsString } from 'class-validator';

export class CreatePostDto {
  @IsString()
  threadId: string;

  @IsString()
  content: string;
}
