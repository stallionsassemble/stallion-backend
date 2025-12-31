import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateProjectOwnerProfileDto {
  @ApiPropertyOptional({
    description: 'First name',
    example: 'Jane',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Smith',
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Bio',
    example:
      'Experienced project manager with a focus on blockchain technology',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Username',
    example: 'janesmith',
  })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({
    description: 'Company name',
    example: 'Acme Corp',
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Legal entity name',
    example: 'Acme Corporation Inc.',
  })
  @IsString()
  @IsOptional()
  entityName?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: 'Industry',
    example: 'Technology',
  })
  @IsString()
  @IsOptional()
  industry?: string;

  @ApiPropertyOptional({
    description: 'Company bio',
    example: 'Leading provider of innovative solutions',
  })
  @IsString()
  @IsOptional()
  companyBio?: string;

  @ApiPropertyOptional({
    description: 'Company logo URL',
    example: 'https://example.com/logo.png',
  })
  @IsUrl()
  @IsOptional()
  companyLogo?: string;

  @ApiPropertyOptional({
    description: 'Location',
    example: 'New York, NY',
  })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    description: 'Skills/Technologies',
    type: [String],
    example: ['Blockchain', 'DeFi', 'Smart Contracts'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsUrl()
  @IsOptional()
  profilePicture?: string;

  @ApiPropertyOptional({
    description: 'Social media links',
    example: {
      linkedin: 'https://linkedin.com/company/acme',
      github: 'https://github.com/acme',
      twitter: 'https://twitter.com/acme',
      website: 'https://acme.com',
    },
  })
  @IsOptional()
  socials?: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
    [key: string]: string | undefined;
  };
}
