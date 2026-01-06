import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HackathonIdentifierParamDto {
  @ApiProperty({
    description: 'Hackathon ID or slug',
    example: 'hackathon-uuid',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
