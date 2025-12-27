import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CompleteOwnerProfileDto {
  @IsString()
  @MinLength(2)
  @ApiProperty({ example: 'John' })
  firstName: string;

  @IsString()
  @MinLength(2)
  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores',
  })
  @ApiProperty({ example: 'johndoe_company' })
  username: string;

  @IsString()
  @ApiProperty({ example: 'San Francisco, USA' })
  location: string;

  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ example: ['Product Management', 'Business Development'] })
  skills: string[];

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @ApiProperty({ example: 'http://localhost:3000/uploads/images/profile.jpg' })
  profilePicture: string;

  @IsObject()
  @ApiProperty({
    example: {
      linkedin: 'https://linkedin.com/company/acme',
      twitter: 'https://twitter.com/acmecorp',
      website: 'https://acme.com',
    },
  })
  socials: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };

  @IsString()
  @ApiProperty({ example: 'Acme Corporation' })
  companyName: string;

  @IsString()
  @ApiProperty({ example: 'Acme Corp LLC' })
  entityName: string;

  @IsString()
  @ApiProperty({ example: '+1-555-0123' })
  phoneNumber: string;

  @IsString()
  @ApiProperty({ example: 'Technology' })
  industry: string;

  @IsString()
  @MinLength(10)
  @ApiProperty({
    example:
      'Leading provider of innovative software solutions for enterprises.',
  })
  companyBio: string;

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @ApiProperty({
    example: 'http://localhost:3000/uploads/images/company-logo.jpg',
  })
  companyLogo: string;

  @IsBoolean()
  @ApiProperty({ example: true })
  emailNotifications: boolean;
}
