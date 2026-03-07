import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, SocialProvider } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class SocialAuthDto {
  @ApiProperty({
    enum: SocialProvider,
    example: SocialProvider.GOOGLE,
  })
  @IsEnum(SocialProvider)
  provider: SocialProvider;

  @ApiProperty({
    description: 'Provider-issued ID token',
  })
  @IsString()
  idToken: string;

  @ApiPropertyOptional({
    description: 'Required only for first-time social signup',
    enum: [Role.CONTRIBUTOR, Role.PROJECT_OWNER],
  })
  @IsOptional()
  @IsIn([Role.CONTRIBUTOR, Role.PROJECT_OWNER])
  role?: Role;
}
