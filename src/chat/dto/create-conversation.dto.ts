import { ConversationType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsArray()
  @IsString({ each: true })
  participantIds: string[];

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
