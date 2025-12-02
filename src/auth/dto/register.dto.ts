import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'SecureP@ssw0rd',
    minLength: 8,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'User role (ADMIN cannot be selected)',
    enum: ['CONTRIBUTOR', 'PROJECT_OWNER'],
    example: 'CONTRIBUTOR',
  })
  @IsEnum(['CONTRIBUTOR', 'PROJECT_OWNER'])
  @IsOptional()
  role?: 'CONTRIBUTOR' | 'PROJECT_OWNER';

  @ApiPropertyOptional({
    description: 'User biography',
    example: 'Full-stack developer with 5 years of experience',
  })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiPropertyOptional({
    description: 'User skills',
    type: [String],
    example: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];
}
