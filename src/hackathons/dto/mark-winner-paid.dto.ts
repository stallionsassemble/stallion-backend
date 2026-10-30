import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class MarkWinnerPaidDto {
  @ApiProperty({
    required: false,
    description: 'Stellar transaction hash of the prize payment',
  })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  txHash?: string;

  @ApiProperty({
    required: false,
    description:
      'Payment reference or note, e.g. a bank transfer ID when the prize was not paid on Stellar',
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  note?: string;
}
