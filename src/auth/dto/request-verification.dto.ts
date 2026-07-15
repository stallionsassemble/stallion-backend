import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize.decorator';

export class RequestVerificationDto {
  @NormalizeEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsEnum(['CONTRIBUTOR', 'PROJECT_OWNER'])
  @ApiProperty({
    enum: ['CONTRIBUTOR', 'PROJECT_OWNER'],
    example: 'CONTRIBUTOR',
  })
  role: 'CONTRIBUTOR' | 'PROJECT_OWNER';
}
