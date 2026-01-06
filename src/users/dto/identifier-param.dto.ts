import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class IdentifierParamDto {
  @ApiProperty({
    description: 'Username or user ID',
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
