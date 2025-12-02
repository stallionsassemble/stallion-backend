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
import { LoginMfaDto } from './dto/login-mfa.dto';
import {
  VerifyPasskeyAuthenticationDto,
  VerifyPasskeyRegistrationDto,
} from './dto/passkey.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { RequestUser } from './interfaces/jwt-payload.interface';

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

  @Post('register')
  @ApiOperation({
    summary: 'Register new user',
    description:
      'Create a new user account and receive TOTP QR code for MFA setup',
  })
  @ApiResponse({
    status: 201,
    description: 'Registration successful',
    schema: {
      example: {
        userId: 'clx123...',
        email: 'user@example.com',
        totpSecret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,...',
        message:
          'Registration successful. Please set up your authenticator app to complete registration.',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'User already exists or invalid data',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('verify-totp/:userId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify TOTP setup',
    description:
      'Complete MFA setup by verifying TOTP code from authenticator app',
  })
  @ApiResponse({
    status: 200,
    description: 'TOTP setup completed and tokens generated',
    schema: {
      example: {
        message: 'TOTP setup completed successfully',
        backupCodes: ['A1B2C3D4', 'E5F6G7H8', '...'],
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
  @ApiResponse({ status: 400, description: 'Invalid TOTP code' })
  async verifyTotpSetup(
    @Param('userId') userId: string,
    @Body() verifyTotpDto: VerifyTotpDto,
  ) {
    return this.authService.verifyTotpSetup(userId, verifyTotpDto.code);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email, password, and TOTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
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
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or TOTP code required',
  })
  async login(@Body() loginDto: LoginMfaDto) {
    return this.authService.login(loginDto);
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
