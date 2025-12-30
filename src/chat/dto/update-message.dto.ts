import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateMessageDto {
  @ApiProperty({
    description: 'Updated content of the message',
    example: 'Updated message content here',
  })
  @IsString()
  content: string;
}
