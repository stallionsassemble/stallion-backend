import { ApiProperty } from '@nestjs/swagger';

export class ContributorParticipationDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid-123',
  })
  id: string;

  @ApiProperty({
    description: 'Username',
    example: 'johndoe',
  })
  username: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
    nullable: true,
  })
  firstName: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    nullable: true,
  })
  lastName: string;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
    nullable: true,
  })
  profilePicture: string;

  @ApiProperty({
    description: 'User bio',
    example: 'Full-stack developer with 5 years of experience',
    nullable: true,
  })
  bio: string;

  @ApiProperty({
    description: 'User location',
    example: 'New York, USA',
    nullable: true,
  })
  location: string;

  @ApiProperty({
    description: 'User skills',
    example: ['JavaScript', 'TypeScript', 'React'],
    type: [String],
  })
  skills: string[];

  @ApiProperty({
    description: 'Number of bounties the contributor has participated in',
    example: 5,
  })
  totalBountiesParticipated: number;

  @ApiProperty({
    description: 'Number of projects the contributor has participated in',
    example: 3,
  })
  totalProjectsParticipated: number;

  @ApiProperty({
    description: 'Total amount earned by the contributor',
    example: '2000',
  })
  totalEarned: string;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}
