import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PasskeyService } from '../passkey/passkey.service';
import { AuthService } from './auth.service';
import { CompleteContributorProfileDto } from './dto/complete-contributor-profile.dto';
import { CompleteOwnerProfileDto } from './dto/complete-owner-profile.dto';
import { LoginDto } from './dto/login.dto';
import {
  VerifyPasskeyAuthenticationDto,
  VerifyPasskeyRegistrationDto,
} from './dto/passkey.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { type RequestUser } from './interfaces/jwt-payload.interface';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly passkeyService: PasskeyService,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Get user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    schema: {
      example: {
        id: 'clx123...',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'CONTRIBUTOR',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.id);
  }

  @Post('request-verification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request email verification code',
    description:
      'Start registration by requesting a 6-digit verification code sent to email',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
    schema: {
      example: {
        message: 'Verification code sent to your email',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email or role',
  })
  async requestVerification(@Body() dto: RequestVerificationDto) {
    return this.authService.requestVerification(dto);
  }

  @Post('verify-code')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email code',
    description:
      'Verify the 6-digit code sent to email to confirm email ownership',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        userId: 'clx123...',
        message: 'Email verified successfully. Please set up MFA.',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
  })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyCode(dto);
  }

  @Post('setup-mfa/:userId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Setup MFA',
    description:
      'Generate TOTP secret and QR code for MFA setup after email verification',
  })
  @ApiResponse({
    status: 200,
    description: 'MFA setup initiated',
    schema: {
      example: {
        totpSecret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,...',
        message: 'Scan the QR code with your authenticator app',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Email not verified or MFA already set up',
  })
  async setupMfa(@Param('userId') userId: string) {
    return this.authService.setupMfa(userId);
  }

  @Post('verify-totp/:userId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify TOTP and get auth tokens',
    description:
      'Complete MFA setup by verifying TOTP code and receive authentication tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP verified and tokens generated',
    schema: {
      example: {
        message: 'MFA setup completed successfully',
        backupCodes: ['A1B2C3D4', 'E5F6G7H8', '...'],
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          username: null,
          firstName: null,
          lastName: null,
          name: 'user@example.com',
          role: 'CONTRIBUTOR',
          profileCompleted: false,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  async verifyTotp(
    @Param('userId') userId: string,
    @Body() verifyTotpDto: VerifyTotpDto,
  ) {
    return this.authService.verifyTotpSetup(userId, verifyTotpDto.code);
  }

  @Post('complete-profile/contributor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete contributor profile',
    description:
      'Complete profile with contributor-specific fields after MFA setup',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile completed successfully',
    schema: {
      example: {
        message: 'Profile completed successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Profile already completed or username taken',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async completeContributorProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: CompleteContributorProfileDto,
  ) {
    return this.authService.completeContributorProfile(user.id, dto);
  }

  @Post('complete-profile/owner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete project owner profile',
    description:
      'Complete profile with project owner-specific fields after MFA setup',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile completed successfully',
    schema: {
      example: {
        message: 'Profile completed successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Profile already completed or username taken',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async completeOwnerProfile(
    @CurrentUser() user: RequestUser,
    @Body() dto: CompleteOwnerProfileDto,
  ) {
    return this.authService.completeOwnerProfile(user.id, dto);
  }

  @Get('check-username/:username')
  @ApiOperation({
    summary: 'Check username availability',
    description: 'Check if a username is available for registration',
  })
  @ApiResponse({
    status: 200,
    description: 'Username availability checked',
    schema: {
      example: {
        available: true,
      },
    },
  })
  async checkUsername(@Param('username') username: string) {
    return this.authService.checkUsernameAvailability(username);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login with email + TOTP',
    description: 'Authenticate user with email and TOTP code only',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          username: 'johndoe',
          firstName: 'John',
          lastName: 'Doe',
          name: 'John Doe',
          role: 'CONTRIBUTOR',
          profileCompleted: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description:
      'Invalid credentials, MFA not set up, or profile not completed',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.totpCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register-options')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get passkey registration options',
    description: 'Generate WebAuthn registration challenge for passkey setup',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration options generated',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPasskeyRegistrationOptions(@CurrentUser() user: RequestUser) {
    return this.passkeyService.generateRegistrationOptions(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register-verify')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verify passkey registration',
    description: 'Complete passkey registration with WebAuthn response',
  })
  @ApiResponse({
    status: 201,
    description: 'Passkey registered successfully',
    schema: {
      example: {
        verified: true,
        passkeyId: 'clx123...',
        message: 'Passkey registered successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid passkey response' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async verifyPasskeyRegistration(
    @CurrentUser() user: RequestUser,
    @Body() dto: VerifyPasskeyRegistrationDto,
  ) {
    return this.passkeyService.verifyRegistration(
      user.id,
      dto.response,
      dto.name,
    );
  }

  @Post('passkey/auth-options')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get passkey authentication options',
    description: 'Generate WebAuthn authentication challenge for passkey login',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication options generated',
  })
  @ApiResponse({ status: 400, description: 'No passkeys found' })
  async getPasskeyAuthenticationOptions(@Body('email') email: string) {
    return this.passkeyService.generateAuthenticationOptions(email);
  }

  @Post('passkey/auth-verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify passkey authentication',
    description: 'Complete passkey authentication and receive JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          name: 'John Doe',
          role: 'CONTRIBUTOR',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid passkey or challenge' })
  async verifyPasskeyAuthentication(
    @Body() dto: VerifyPasskeyAuthenticationDto,
  ) {
    return this.passkeyService.verifyAuthentication(dto.email, dto.response);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Get new access and refresh tokens using a valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          name: 'John Doe',
          role: 'CONTRIBUTOR',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidate refresh token and logout user',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    schema: {
      example: {
        message: 'Logged out successfully',
      },
    },
  })
  async logout(@CurrentUser() user: RequestUser) {
    return this.authService.logout(user.id);
  }
}
