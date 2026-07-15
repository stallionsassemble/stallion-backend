import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { NormalizeEmail } from '../../common/decorators/normalize.decorator';

export class VerifyCodeDto {
  @NormalizeEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @Length(6, 6)
  @ApiProperty({ example: '123456', description: '6-digit verification code' })
  code: string;
}
