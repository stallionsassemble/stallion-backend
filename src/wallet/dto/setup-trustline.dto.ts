import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetupTrustlineDto {
  @ApiProperty({
    description: 'Currency code for which to establish trustline',
    example: 'USDC',
    enum: ['USDC', 'EURC'],
  })
  @IsString()
  currencyCode: string;
}
