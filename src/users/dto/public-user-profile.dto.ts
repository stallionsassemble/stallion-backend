import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class PublicUserProfileDto {
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

  @ApiProperty({
    description: 'User role',
    enum: Role,
    example: Role.CONTRIBUTOR,
  })
  role: Role;

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
    description: 'Company name (project owners only)',
    example: 'Acme Corp',
  })
  companyName?: string;

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

  @ApiPropertyOptional({
    description: 'Industry (project owners only)',
    example: 'Technology',
  })
  industry?: string;

  @ApiPropertyOptional({
    description: 'User creation date',
    example: '2023-01-01T00:00:00.000Z',
  })
  createdAt?: Date;
}
