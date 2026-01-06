import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchMessagesQueryDto {
  @ApiProperty({
    description: 'Search query',
    example: 'hello',
  })
  @IsString()
  @IsNotEmpty()
  q: string;
}
