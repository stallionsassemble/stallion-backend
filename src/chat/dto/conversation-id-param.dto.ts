import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ConversationIdParamDto {
  @ApiProperty({
    description: 'Conversation ID',
    example: 'conversation-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
