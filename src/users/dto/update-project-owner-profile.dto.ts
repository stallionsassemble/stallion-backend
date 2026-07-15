import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { NormalizePhone } from '../../common/decorators/normalize.decorator';

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
    description:
      'Phone number. Accepts international format (+2349012345678) or a local ' +
      'number, in which case `country` is used to resolve it. Stored as E.164.',
    example: '+2349012345678',
  })
  @IsOptional()
  @NormalizePhone()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'ISO 3166-1 alpha-2 country code (used to normalize the phone number)',
    example: 'NG',
  })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

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
      twitter: 'https://x.com/acme',
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

  @ApiPropertyOptional({
    description: 'Gender',
    enum: Gender,
    example: Gender.UNSPECIFIED,
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;
}
