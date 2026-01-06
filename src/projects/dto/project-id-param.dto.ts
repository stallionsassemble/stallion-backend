import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ProjectIdParamDto {
  @ApiProperty({
    description: 'Project ID',
    example: 'project-uuid',
  })
  @IsString()
  @IsNotEmpty()
  id: string;
}
