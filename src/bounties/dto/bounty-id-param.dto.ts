import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class BountyIdParamDto {
  @ApiProperty({
    description: 'Bounty ID',
    example: 'bounty-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
