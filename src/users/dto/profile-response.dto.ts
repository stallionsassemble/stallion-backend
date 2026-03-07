import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Role, UserStatus } from '@prisma/client';

export class ProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid-123',
  })
  id: string;

  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'Username',
    example: 'johndoe',
  })
  username?: string;

  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Bio',
    example:
      'Full-stack developer passionate about web3 and decentralized applications',
  })
  bio?: string;

  @ApiPropertyOptional({
    description: 'Location',
    example: 'San Francisco, CA',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'Skills',
    type: [String],
    example: ['JavaScript', 'TypeScript', 'React'],
  })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Social media links',
    example: {
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
    },
  })
  socials?: object;

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.CONTRIBUTOR,
  })
  role: Role;

  @ApiProperty({
    description: 'User account status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @ApiProperty({
    description: 'Gender',
    enum: Gender,
    example: Gender.UNSPECIFIED,
  })
  gender: Gender;

  @ApiPropertyOptional({
    description: 'Company name (project owners only)',
    example: 'Acme Corp',
  })
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Legal entity name (project owners only)',
    example: 'Acme Corporation Inc.',
  })
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Phone number (project owners only)',
    example: '+1234567890',
  })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Industry (project owners only)',
    example: 'Technology',
  })
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company bio (project owners only)',
    example: 'Leading provider of innovative solutions',
  })
  companyBio?: string;

  @ApiPropertyOptional({
    description: 'Company logo URL (project owners only)',
    example: 'https://example.com/logo.png',
  })
  companyLogo?: string;

  @ApiProperty({
    description: 'Email notifications enabled',
    example: true,
  })
  emailNotifications: boolean;

  @ApiProperty({
    description: 'Profile completion status',
    example: true,
  })
  profileCompleted: boolean;

  @ApiProperty({
    description: 'Email verified status',
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'MFA enabled status',
    example: false,
  })
  mfaEnabled: boolean;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-15T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Last active timestamp',
    example: '2024-01-15T00:00:00.000Z',
  })
  lastActiveAt?: Date;
}
