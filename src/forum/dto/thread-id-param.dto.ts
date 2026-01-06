import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ThreadIdParamDto {
  @ApiProperty({
    description: 'Thread ID',
    example: 'thread-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
