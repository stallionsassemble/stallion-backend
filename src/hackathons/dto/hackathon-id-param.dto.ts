import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HackathonIdParamDto {
  @ApiProperty({
    description: 'Hackathon ID',
    example: 'hackathon-uuid',
  })
  @IsString()
  @IsNotEmpty()
  hackathonId: string;
}
