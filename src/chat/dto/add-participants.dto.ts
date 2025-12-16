import { IsArray, IsString } from 'class-validator';

export class AddParticipantsDto {
  @IsString()
  conversationId: string;

  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
