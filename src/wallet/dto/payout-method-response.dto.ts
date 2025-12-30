import { ApiProperty } from '@nestjs/swagger';

export class PayoutMethodResponseDto {
  @ApiProperty({
    description: 'Payout method ID',
    example: 'payout-method-uuid',
  })
  id: string;

  @ApiProperty({
    description: 'User-friendly name for the payout method',
    example: 'My Ledger Wallet',
  })
  name: string;

  @ApiProperty({
    description: 'Stellar public key',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  publicKey: string;

  @ApiProperty({
    description: 'Whether this is the default payout method',
    example: true,
  })
  isDefault: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-03-01T12:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-03-01T12:00:00.000Z',
  })
  updatedAt: Date;
}
