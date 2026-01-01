import { MessageType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  ValidateNested,
} from 'class-validator';

class MessageAttachment {
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @IsString()
  @IsNotEmpty()
  @Max(100)
  type: string; // e.g., 'image/png', 'application/pdf'

  @IsString()
  @IsOptional()
  @Max(255)
  name?: string;

  @IsOptional()
  size?: number;
}

export class SendMessageWsDto {
  @IsString()
  @IsOptional()
  identifier?: string;

  @IsString()
  @IsNotEmpty()
  recipientId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10000)
  content: string;

  @IsString()
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.TEXT;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachment)
  attachments?: MessageAttachment[];

  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}

export class UpdateMessageWsDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 10000)
  content: string;
}

export class DeleteMessageWsDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class MarkAsReadWsDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsOptional()
  messageId?: string;
}

export class MarkMessagesAsReadWsDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  messageIds: string[];
}

export class TypingWsDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsBoolean()
  isTyping: boolean;
}

export class GetOnlineStatusWsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  userIds: string[];
}
