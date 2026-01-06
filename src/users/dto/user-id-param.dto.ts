import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class UserIdParamDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
