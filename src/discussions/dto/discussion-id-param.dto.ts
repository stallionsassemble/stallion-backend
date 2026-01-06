import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DiscussionIdParamDto {
  @ApiProperty({
    description: 'Discussion ID',
    example: 'discussion-uuid',
  })
  @IsString()
  @IsNotEmpty()
  discussionId: string;
}
