import { ApiProperty } from '@nestjs/swagger';
import { Role, SocialProvider } from '@prisma/client';

class SocialAuthUserDto {
  @ApiProperty({ example: 'cm3abc123xyz' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: Role, example: Role.CONTRIBUTOR })
  role: Role;

  @ApiProperty({ example: false })
  profileCompleted: boolean;
}

export class SocialAuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  accessToken: string;

  @ApiProperty({ example: 'eyJhbGciOi...' })
  refreshToken: string;

  @ApiProperty({ type: SocialAuthUserDto })
  user: SocialAuthUserDto;

  @ApiProperty({ example: 'Social authentication successful.' })
  message: string;

  @ApiProperty({ enum: SocialProvider, example: SocialProvider.GOOGLE })
  provider: SocialProvider;

  @ApiProperty({ example: true })
  isNewUser: boolean;
}
