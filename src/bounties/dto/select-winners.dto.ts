import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SelectWinnersDto {
  @ApiProperty({
    description: 'Array of winner user IDs',
    example: ['clx123user1...', 'clx456user2...', 'clx789user3...'],
  })
  @IsArray()
  @IsString({ each: true })
  winners: string[];
}
