import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UsernameParamDto {
  @ApiProperty({
    description: 'Username to check',
    example: 'johndoe',
  })
  @IsString()
  @IsNotEmpty()
  username: string;
}
