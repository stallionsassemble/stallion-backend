import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyIdParamDto {
  @ApiProperty({
    description: 'Reply ID',
    example: 'reply-uuid',
  })
  @IsString()
  @IsNotEmpty()
  replyId: string;
}
