import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ApplicationIdParamDto {
  @ApiProperty({
    description: 'Application ID',
    example: 'application-uuid',
  })
  @IsString()
  @IsNotEmpty()
  applicationId: string;
}
