import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    description: 'Type of conversation',
    enum: ConversationType,
    example: ConversationType.GROUP,
  })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiProperty({
    description: 'Array of user IDs to add as participants',
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2', 'user-uuid-3'],
  })
  @IsArray()
  @IsString({ each: true })
  participantIds: string[];

  @ApiPropertyOptional({
    description: 'Name of the conversation (required for group chats)',
    example: 'Project Discussion',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Avatar URL for the conversation',
    example: 'https://example.com/avatar.jpg',
  })
  @IsOptional()
  @IsString()
  avatar?: string;
}
