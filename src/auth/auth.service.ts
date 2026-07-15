import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, SocialProvider, User, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { SanitizedUser, sanitizeUser } from 'src/common/utils/user.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';
import { EnvConfig } from '../config/env.config';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { WalletService } from '../wallet/wallet.service';
import { CompleteContributorProfileDto } from './dto/complete-contributor-profile.dto';
import { CompleteOwnerProfileDto } from './dto/complete-owner-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { SocialAuthDto } from './dto/social-auth.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { SocialTokenVerifierService } from './social-token-verifier.service';
import { VerificationCodeStorageService } from './verification-code-storage.service';

@Injectable()
export class AuthService {
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private verificationCodeStorage: VerificationCodeStorageService,
    private walletService: WalletService,
    private configService: ConfigService,
    private socialTokenVerifier: SocialTokenVerifierService,
  ) {
    this.refreshTokenSecret = this.configService.getOrThrow<string>(
      EnvConfig.REFRESH_TOKEN_SECRET,
    );
    this.accessTokenExpiresIn =
      this.configService.get<string>(EnvConfig.ACCESS_TOKEN_EXPIRES_IN) ||
      '15m';
    this.refreshTokenExpiresIn =
      this.configService.get<string>(EnvConfig.REFRESH_TOKEN_EXPIRES_IN) ||
      '7d';
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        wallet: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.ensureAccountCanAuthenticate(user);

    const sanitizedUser = sanitizeUser(user);
    return sanitizedUser;
  }

  async validateUser(email: string): Promise<User | null> {
    return this.usersService.findByEmail(email);
  }

  async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn as any,
    });

    const refreshTokenPayload = {
      sub: user.id,
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.refreshTokenSecret,
      expiresIn: this.refreshTokenExpiresIn as any,
    });

    // Hash and store refresh token
    const hashedRefreshToken = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedRefreshToken,
        lastActiveAt: new Date(),
      },
    });

    const fullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        ...(user.profileCompleted && {
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          name: fullName,
        }),
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: this.refreshTokenSecret,
      });

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.ensureAccountCanAuthenticate(user);

      // Verify the refresh token matches the stored hash
      const isValidRefreshToken = await argon2.verify(
        user.refreshToken,
        refreshTokenDto.refreshToken,
      );

      if (!isValidRefreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(userId: string) {
    // Clear refresh token
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Request email verification code
   */
  async requestVerification(
    dto: RequestVerificationDto,
  ): Promise<{ message: string }> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in Redis with 10-minute TTL
    await this.verificationCodeStorage.setVerificationCode(
      dto.email,
      code,
      600, // 10 minutes
    );

    if (existingUser) {
      await this.ensureAccountCanAuthenticate(existingUser);
      // Update existing user's role if changed
      await this.prisma.user.update({
        where: { email: dto.email },
        data: {
          role: dto.role,
        },
      });
    } else {
      // Create barebone user
      await this.prisma.user.create({
        data: {
          email: dto.email,
          role: dto.role,
          emailVerified: false,
        },
      });
    }

    // Send verification email
    await this.emailService.sendVerificationCode(dto.email, code, 'signup');

    return { message: 'Verification code sent to your email' };
  }

  /**
   * Verify email code for signup
   */
  async verifySignupCode(
    dto: VerifyCodeDto,
  ): Promise<
    Awaited<ReturnType<typeof this.generateTokens>> & { message: string }
  > {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { wallet: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or code');
    }

    // Verify code from Redis (will delete if valid)
    const isValid = await this.verificationCodeStorage.verifyAndDeleteCode(
      dto.email,
      dto.code,
    );

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // Mark email as verified
    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
        },
      });
    }

    return {
      ...(await this.generateTokens(user)),
      message: 'Email verified successfully.',
    };
  }

  /**
   * Authenticate with social ID token (Google or Apple)
   */
  async socialAuth(dto: SocialAuthDto): Promise<
    Awaited<ReturnType<typeof this.generateTokens>> & {
      message: string;
      provider: SocialProvider;
      isNewUser: boolean;
    }
  > {
    const verifiedToken = await this.socialTokenVerifier.verifyIdToken(
      dto.provider,
      dto.idToken,
    );

    const linkedSocialAccount = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerSubject: {
          provider: verifiedToken.provider,
          providerSubject: verifiedToken.subject,
        },
      },
      include: {
        user: true,
      },
    });

    let isNewUser = false;
    let user: User | null = linkedSocialAccount?.user ?? null;

    if (!user && verifiedToken.email) {
      user = await this.prisma.user.findUnique({
        where: { email: verifiedToken.email.toLowerCase() },
      });
    }

    if (!user) {
      if (!dto.role) {
        throw new BadRequestException(
          'Role is required for first-time social signup',
        );
      }

      if (!verifiedToken.email) {
        throw new BadRequestException(
          'Email is required from social provider for first-time signup',
        );
      }

      user = await this.prisma.user.create({
        data: {
          email: verifiedToken.email.toLowerCase(),
          role: dto.role,
          emailVerified: true,
          profileCompleted: false,
          status: UserStatus.ACTIVE,
          lastActiveAt: new Date(),
        },
      });
      isNewUser = true;
    }

    await this.ensureAccountCanAuthenticate(user);

    if (!linkedSocialAccount) {
      await this.prisma.socialAccount.create({
        data: {
          provider: verifiedToken.provider,
          providerSubject: verifiedToken.subject,
          email: (verifiedToken.email || user.email).toLowerCase(),
          userId: user.id,
        },
      });
    }

    // Ensure social-authenticated users are treated as verified.
    if (!user.emailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, lastActiveAt: new Date() },
      });
    }

    return {
      ...(await this.generateTokens(user)),
      message: 'Social authentication successful.',
      provider: dto.provider,
      isNewUser,
    };
  }

  /**
   * Verify email code for login (with optional TOTP for MFA users)
   */
  async verifyLoginCode(
    email: string,
    code: string,
    totpCode?: string,
  ): Promise<
    Awaited<ReturnType<typeof this.generateTokens>> & { message: string }
  > {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or code');
    }

    await this.ensureAccountCanAuthenticate(user);

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Verify email code from Redis
    const isValid = await this.verificationCodeStorage.verifyCode(email, code);

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    // If user has MFA enabled, verify TOTP
    if (user.mfaEnabled && user.totpSecret) {
      if (!totpCode) {
        throw new UnauthorizedException('MFA code required');
      }

      // Verify TOTP
      const decryptedSecret = EncryptionUtil.decrypt(user.totpSecret);
      const isTotpValid = authenticator.verify({
        token: totpCode,
        secret: decryptedSecret,
      });

      if (!isTotpValid) {
        // Try backup codes
        const isValidBackup = await this.verifyBackupCode(user.id, totpCode);
        if (!isValidBackup) {
          throw new UnauthorizedException('Invalid TOTP code');
        }
      }
    }

    // Delete verification code
    await this.verificationCodeStorage.deleteVerificationCode(email);

    return {
      ...(await this.generateTokens(user)),
      message: 'Login successful.',
    };
  }

  /**
   * Setup MFA
   */
  async setupMfa(userId: string): Promise<{
    totpSecret: string;
    qrCode: string;
    message: string;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.ensureAccountCanAuthenticate(user);

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA already set up');
    }

    // Generate TOTP secret
    const totpSecret = authenticator.generateSecret();
    const encryptedTotpSecret = EncryptionUtil.encrypt(totpSecret);

    // Store the secret as PENDING only. It is not treated as an active MFA
    // secret (and MFA is not enforced) until the user proves ownership by
    // verifying a code in verifyTotpSetup.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingTotpSecret: encryptedTotpSecret,
      },
    });

    // Generate QR code
    const otpauth = authenticator.keyuri(user.email, 'Stallion', totpSecret);
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
      totpSecret,
      qrCode,
      message: 'Scan the QR code with your authenticator app',
    };
  }

  /**
   * Verify TOTP setup and return tokens
   */
  async verifyTotpSetup(
    userId: string,
    totpCode: string,
  ): Promise<{
    message: string;
    backupCodes: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.pendingTotpSecret) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureAccountCanAuthenticate(user);

    // Decrypt and verify against the PENDING secret
    const decryptedSecret = EncryptionUtil.decrypt(user.pendingTotpSecret);
    const isValid = authenticator.verify({
      token: totpCode,
      secret: decryptedSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => argon2.hash(code)),
    );

    // Promote the pending secret to the active secret and enable MFA in one
    // step, so totpSecret is only ever populated on a verified account.
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: user.pendingTotpSecret,
        pendingTotpSecret: null,
        mfaEnabled: true,
        backupCodes: hashedBackupCodes,
      },
      include: {
        wallet: true,
      },
    });

    return {
      message: 'MFA setup completed successfully',
      backupCodes,
    };
  }

  /**
   * Disable MFA for a user (self-service).
   * Requires the current TOTP code as confirmation to prevent accidental/malicious disablement.
   */
  async disableMfa(
    userId: string,
    totpCode: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.mfaEnabled || !user.totpSecret) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    // Verify the TOTP code before disabling
    const decryptedSecret = EncryptionUtil.decrypt(user.totpSecret);
    const isValid = authenticator.verify({
      token: totpCode,
      secret: decryptedSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        totpSecret: null,
        pendingTotpSecret: null,
        backupCodes: [],
      },
    });

    return { message: '2FA disabled successfully' };
  }

  /**
   * Complete contributor profile
   */
  async completeContributorProfile(
    userId: string,
    dto: CompleteContributorProfileDto,
  ): Promise<{ message: string; user: SanitizedUser }> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.CONTRIBUTOR) {
      throw new BadRequestException('User is not a contributor');
    }

    if (user.profileCompleted) {
      throw new BadRequestException('Profile already completed');
    }

    // Check username availability
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Username already taken');
      }
    }

    // Create individual Stellar wallet for user
    const { walletId } = await this.walletService.createWallet();

    // Update user profile and link wallet
    user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        location: dto.location,
        skills: dto.skills,
        profilePicture: dto.profilePicture,
        socials: dto.socials,
        gender: dto.gender,
        emailNotifications: dto.emailNotifications,
        profileCompleted: true,
        walletId,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      `${dto.firstName} ${dto.lastName}`,
      'CONTRIBUTOR',
    );

    return {
      message: 'Profile completed successfully',
      user: sanitizeUser(user),
    };
  }

  /**
   * Complete project owner profile
   */
  async completeOwnerProfile(
    userId: string,
    dto: CompleteOwnerProfileDto,
  ): Promise<{ message: string; user: SanitizedUser }> {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.PROJECT_OWNER) {
      throw new BadRequestException('User is not a project owner');
    }

    if (user.profileCompleted) {
      throw new BadRequestException('Profile already completed');
    }

    // Check username availability
    if (dto.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (existing && existing.id !== userId) {
        throw new BadRequestException('Username already taken');
      }
    }

    // Create individual Stellar wallet for user
    const { walletId } = await this.walletService.createWallet();

    // Update user profile and link wallet
    user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        location: dto.location,
        skills: dto.skills,
        profilePicture: dto.profilePicture,
        socials: dto.socials,
        companyName: dto.companyName,
        entityName: dto.entityName,
        phoneNumber: dto.phoneNumber,
        industry: dto.industry,
        companyBio: dto.companyBio,
        companyLogo: dto.companyLogo,
        gender: dto.gender,
        emailNotifications: dto.emailNotifications,
        profileCompleted: true,
        walletId,
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      `${dto.firstName} ${dto.lastName}`,
      'PROJECT_OWNER',
    );

    return {
      message: 'Profile completed successfully',
      user: sanitizeUser(user),
    };
  }

  /**
   * Check username availability
   */
  async checkUsernameAvailability(
    username: string,
  ): Promise<{ available: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { username },
    });

    return { available: !existing };
  }

  /**
   * Login with email + optional TOTP
   */
  async login(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.ensureAccountCanAuthenticate(user);

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    // Send verification code via email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.verificationCodeStorage.setVerificationCode(email, code);
    await this.emailService.sendVerificationCode(email, code, 'login');

    return {
      message: 'Verification code sent to your email',
      mfaEnabled: user.mfaEnabled,
    };
  }

  private async ensureAccountCanAuthenticate(user: {
    id: string;
    status: UserStatus;
    suspendedUntil: Date | null;
  }): Promise<void> {
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException('This account has been banned');
    }

    if (user.status === UserStatus.SUSPENDED) {
      if (user.suspendedUntil && user.suspendedUntil <= new Date()) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.ACTIVE,
            suspendedUntil: null,
            suspensionReason: null,
          },
        });
        return;
      }

      throw new ForbiddenException('This account is currently suspended');
    }
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.backupCodes.length) {
      return false;
    }

    for (let i = 0; i < user.backupCodes.length; i++) {
      const isMatch = await argon2.verify(user.backupCodes[i], code);
      if (isMatch) {
        // Remove used backup code
        const updatedCodes = [...user.backupCodes];
        updatedCodes.splice(i, 1);
        await this.prisma.user.update({
          where: { id: userId },
          data: { backupCodes: updatedCodes },
        });
        return true;
      }
    }

    return false;
  }
}
