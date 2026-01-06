import { ApiProperty } from '@nestjs/swagger';

export class ContributorStatsDto {
  @ApiProperty({
    description: 'Total earnings from bounties and projects',
    example: '15000.50',
  })
  totalEarnings: string;

  @ApiProperty({
    description:
      'Percentage difference in earnings compared to last month (positive or negative)',
    example: 25.5,
  })
  earningsPercentageChange: number;

  @ApiProperty({
    description: 'Number of active bounties the user is participating in',
    example: 5,
  })
  activeBounties: number;

  @ApiProperty({
    description: 'Number of completed bounties',
    example: 12,
  })
  completedBounties: number;
}

export class ProjectOwnerStatsDto {
  @ApiProperty({
    description: 'Total number of bounties created by the user',
    example: 20,
  })
  totalBountiesCreated: number;

  @ApiProperty({
    description: 'Total amount paid out to contributors',
    example: '50000.75',
  })
  totalPaidOut: string;

  @ApiProperty({
    description:
      'Percentage difference in total paid out compared to last month (positive or negative)',
    example: -10.2,
  })
  paidOutPercentageChange: number;

  @ApiProperty({
    description:
      'Total pending payments for milestones awaiting approval on projects with winners',
    example: '5000.00',
  })
  pendingPayments: string;
}
