import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PostIdParamDto {
  @ApiProperty({
    description: 'Post ID',
    example: 'post-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
