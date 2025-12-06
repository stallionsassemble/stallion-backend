import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class SelectWinnersDto {
  @ApiProperty({
    description: 'Array of winner wallet memo IDs',
    example: ['memo1', 'memo2', 'memo3'],
  })
  @IsArray()
  @IsString({ each: true })
  winners: string[];
}
