import { ApiProperty } from '@nestjs/swagger';

export class BountyWinnerDto {
  @ApiProperty({
    description: 'User ID of the winner',
    example: 'user-uuid-123',
  })
  userId: string;

  @ApiProperty({
    description: 'Username of the winner',
    example: 'john_doe',
    nullable: true,
  })
  username: string | null;

  @ApiProperty({
    description: 'First name of the winner',
    example: 'John',
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    description: 'Last name of the winner',
    example: 'Doe',
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'Wallet public key',
    example: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  })
  publicKey: string;

  @ApiProperty({
    description:
      'Position/rank of the winner (1 = first place, 2 = second, etc.)',
    example: 1,
  })
  position: number;

  @ApiProperty({
    description: 'Amount won by this winner',
    example: 500,
  })
  amountWon: number;

  @ApiProperty({
    description: 'Currency of the reward',
    example: 'XLM',
  })
  currency: string;

  @ApiProperty({
    description: 'Percentage of total reward',
    example: 50,
  })
  percentage: number;

  @ApiProperty({
    description: 'Timestamp when the winner was awarded',
    example: '2024-03-01T12:00:00.000Z',
    nullable: true,
  })
  awardedAt: Date | null;
}

export class BountyWinnersResponseDto {
  @ApiProperty({
    description: 'List of winners with their details',
    type: [BountyWinnerDto],
  })
  winners: BountyWinnerDto[];

  @ApiProperty({
    description: 'Total reward amount',
    example: 1000,
  })
  totalReward: number;

  @ApiProperty({
    description: 'Reward currency',
    example: 'XLM',
  })
  currency: string;

  @ApiProperty({
    description: 'Bounty title',
    example: 'Build a DeFi Dashboard',
  })
  bountyTitle: string;

  @ApiProperty({
    description: 'Bounty ID',
    example: 'bounty-uuid-123',
  })
  bountyId: string;
}

export class SelectWinnersResponseDto extends BountyWinnersResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Winners selected successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Transaction hash from the blockchain',
    example: 'abc123def456...',
  })
  transactionHash: string;
}
