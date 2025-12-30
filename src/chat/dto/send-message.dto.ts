import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'ID of the conversation to send the message to',
    example: 'conv-uuid',
  })
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: 'Content of the message',
    example: 'Hello everyone! How is the project going?',
  })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    description: 'Type of message',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({
    description: 'Message attachments (files, images, etc.)',
    example: [{ url: 'https://example.com/file.pdf', type: 'document' }],
  })
  @IsOptional()
  attachments?: any;
}
