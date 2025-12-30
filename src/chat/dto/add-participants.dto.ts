import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class AddParticipantsDto {
  @ApiProperty({
    description: 'ID of the conversation to add participants to',
    example: 'conv-uuid',
  })
  @IsString()
  conversationId: string;

  @ApiProperty({
    description: 'Array of user IDs to add as participants',
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2'],
  })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
