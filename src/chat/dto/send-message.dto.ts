import { MessageType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsString()
  conversationId: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  attachments?: any;
}
