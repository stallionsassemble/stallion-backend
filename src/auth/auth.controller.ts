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
import { PasskeyService } from 'src/passkey/passkey.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserIdParamDto } from '../users/dto/user-id-param.dto';
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
import { UsernameParamDto } from './dto/username-param.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { VerifyLoginCodeDto } from './dto/verify-login-code.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';

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
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
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
  async checkUsername(@Param() params: UsernameParamDto) {
    return this.authService.checkUsernameAvailability(params.username);
  }

  @Post('signup/request-verification')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Request email verification code for signup',
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

  @Post('signup/verify-code')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify email code for signup',
    description:
      'Verify the 6-digit code sent to email during signup to confirm email ownership',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    schema: {
      example: {
        message: 'Email verified successfully.',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          role: 'CONTRIBUTOR',
          profileCompleted: false,
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
  })
  async verifySignupCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifySignupCode(dto);
  }

  @Post('signup/complete-profile/contributor')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete contributor profile',
    description: 'Complete profile with contributor-specific fields',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile completed successfully',
    schema: {
      example: {
        message: 'Profile completed successfully',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          role: 'CONTRIBUTOR',
          profileCompleted: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Profile already completed or username taken',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async completeContributorProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteContributorProfileDto,
  ) {
    return this.authService.completeContributorProfile(userId, dto);
  }

  @Post('signup/complete-profile/owner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Complete project owner profile',
    description: 'Complete profile with project owner-specific fields',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile completed successfully',
    schema: {
      example: {
        message: 'Profile completed successfully',
        user: {
          id: 'clx123...',
          email: 'user@example.com',
          role: 'PROJECT_OWNER',
          profileCompleted: true,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Profile already completed or username taken',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async completeOwnerProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteOwnerProfileDto,
  ) {
    return this.authService.completeOwnerProfile(userId, dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login - Step 1',
    description:
      'Initiate login by providing email. A verification code will be sent to your email.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent',
    schema: {
      example: {
        message: 'Verification code sent to your email',
        requiresVerification: true,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email);
  }

  @Post('login/verify-code')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Login - Step 2',
    description:
      'Verify email code to complete login. If MFA is enabled, also provide TOTP code.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      example: {
        message: 'Login successful.',
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
    description: 'Invalid verification code or TOTP code',
  })
  async verifyLoginCode(@Body() dto: VerifyLoginCodeDto) {
    return this.authService.verifyLoginCode(dto.email, dto.code, dto.totpCode);
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
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  @Post('setup-mfa/:userId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Setup MFA (Authenticator App)',
    description: 'Generate TOTP secret and QR code for MFA setup',
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
  async setupMfa(@Param() params: UserIdParamDto) {
    return this.authService.setupMfa(params.userId);
  }

  @Post('verify-totp/:userId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify TOTP',
    description: 'Complete MFA setup by verifying TOTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP verified and backup codes generated',
    schema: {
      example: {
        message: 'MFA setup completed successfully',
        backupCodes: ['A1B2C3D4', 'E5F6G7H8', '...'],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid TOTP code' })
  async verifyTotp(
    @Param() params: UserIdParamDto,
    @Body() verifyTotpDto: VerifyTotpDto,
  ) {
    return this.authService.verifyTotpSetup(params.userId, verifyTotpDto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register-options')
  @HttpCode(200)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get passkey registration options',
    description:
      'Generate WebAuthn registration challenge for passkey setup. This endpoint returns the challenge data needed to create a new passkey using the WebAuthn API.',
  })
  @ApiResponse({
    status: 200,
    description: 'Registration options generated successfully',
    schema: {
      example: {
        rp: {
          name: 'Stallion',
          id: 'localhost',
        },
        user: {
          id: 'clx123...',
          name: 'user@example.com',
          displayName: 'user@example.com',
        },
        challenge: 'Y2hhbGxlbmdlXzEyMzQ1Njc4OTA=',
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        timeout: 60000,
        attestation: 'none',
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'preferred',
          residentKey: 'preferred',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async getPasskeyRegistrationOptions(@CurrentUser('id') userId: string) {
    return this.passkeyService.generateRegistrationOptions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register-verify')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Verify passkey registration',
    description:
      'Complete passkey registration by sending the WebAuthn response from the client. This endpoint verifies the registration challenge and stores the new passkey.',
  })
  @ApiResponse({
    status: 201,
    description: 'Passkey registered successfully',
    schema: {
      example: {
        verified: true,
        passkeyId: 'clx123...',
        name: 'My iPhone',
        message: 'Passkey registered successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid passkey response or registration failed',
    schema: {
      example: {
        message: 'Invalid passkey response',
        error: 'Registration verification failed',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async verifyPasskeyRegistration(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPasskeyRegistrationDto,
  ) {
    return this.passkeyService.verifyRegistration(
      userId,
      dto.response,
      dto.name,
    );
  }

  @Post('passkey/auth-options')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get passkey authentication options',
    description:
      'Generate WebAuthn authentication challenge for passkey login. This endpoint returns the challenge data needed to authenticate with an existing passkey using the WebAuthn API.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication options generated successfully',
    schema: {
      example: {
        challenge: 'Y2hhbGxlbmdlXzEyMzQ1Njc4OTA=',
        allowCredentials: [
          {
            id: 'Y3JlZGVudGlhbF9pZF8xMjM0NTY3ODkw',
            type: 'public-key',
            transports: ['internal', 'usb', 'nfc', 'ble'],
          },
        ],
        userVerification: 'preferred',
        timeout: 60000,
        rpId: 'localhost',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'No passkeys found for this email',
    schema: {
      example: {
        message: 'No passkeys found for this email address',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      example: {
        message: 'User not found',
      },
    },
  })
  async getPasskeyAuthenticationOptions(@Body('email') email: string) {
    return this.passkeyService.generateAuthenticationOptions(email);
  }

  @Post('passkey/auth-verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify passkey authentication',
    description:
      'Complete passkey authentication by sending the WebAuthn response from the client. This endpoint verifies the authentication challenge and confirms successful authentication.',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful',
    schema: {
      example: {
        message: 'Passkey authenticated successfully',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid passkey response or authentication failed',
    schema: {
      example: {
        message: 'Invalid passkey response',
        error: 'Authentication verification failed',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid passkey or expired challenge',
    schema: {
      example: {
        message: 'Authentication failed',
        error: 'Invalid passkey or challenge expired',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
    schema: {
      example: {
        message: 'User not found',
      },
    },
  })
  async verifyPasskeyAuthentication(
    @Body() dto: VerifyPasskeyAuthenticationDto,
  ) {
    return this.passkeyService.verifyAuthentication(dto.email, dto.response);
  }
}
