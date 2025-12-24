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

export class CompleteContributorProfileDto {
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
  @ApiProperty({ example: 'johndoe' })
  username: string;

  @IsString()
  @ApiProperty({ example: 'New York, USA' })
  location: string;

  @IsArray()
  @IsString({ each: true })
  @ApiProperty({ example: ['JavaScript', 'TypeScript', 'React'] })
  skills: string[];

  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @ApiProperty({ example: 'http://localhost:3000/uploads/images/profile.jpg' })
  profilePicture: string;

  @IsObject()
  @ApiProperty({
    example: {
      linkedin: 'https://linkedin.com/in/johndoe',
      github: 'https://github.com/johndoe',
      twitter: 'https://twitter.com/johndoe',
      website: 'https://johndoe.com',
    },
  })
  socials: {
    linkedin?: string;
    github?: string;
    twitter?: string;
    website?: string;
  };

  @IsBoolean()
  @ApiProperty({ example: true })
  emailNotifications: boolean;
}
