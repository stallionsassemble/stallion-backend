import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { sanitizeUser } from 'src/common/utils/user.util';
import { PrismaService } from '../common/prisma/prisma.service';
import { EncryptionUtil } from '../common/utils/encryption.util';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { CompleteContributorProfileDto } from './dto/complete-contributor-profile.dto';
import { CompleteOwnerProfileDto } from './dto/complete-owner-profile.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestVerificationDto } from './dto/request-verification.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { VerificationCodeStorageService } from './verification-code-storage.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private verificationCodeStorage: VerificationCodeStorageService,
  ) {}

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

    const sanitizedUser = sanitizeUser(user);
    return sanitizedUser;
  }

  async validateUser(email: string): Promise<User | null> {
    return this.usersService.findByEmail(email);
  }

  generateToken(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const fullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        name: fullName,
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  async generateTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m', // Short-lived access token
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d', // Long-lived refresh token
    });

    // Hash and store refresh token
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    const fullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        name: fullName,
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  async refreshTokens(refreshTokenDto: RefreshTokenDto) {
    try {
      // Verify the refresh token
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken);

      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Verify the refresh token matches the stored hash
      const isValidRefreshToken = await bcrypt.compare(
        refreshTokenDto.refreshToken,
        user.refreshToken,
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
    await this.emailService.sendVerificationCode(dto.email, code);

    return { message: 'Verification code sent to your email' };
  }

  /**
   * Verify email signup code
   */
  async verifyCode(
    dto: VerifyCodeDto,
  ): Promise<{ userId: string; message: string }> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
      },
    });

    return {
      userId: user.id,
      message: 'Email verified successfully. Please set up MFA.',
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

    if (!user || !user.emailVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    if (user.totpEnabled) {
      throw new BadRequestException('MFA already set up');
    }

    // Generate TOTP secret
    const totpSecret = authenticator.generateSecret();
    const encryptedTotpSecret = EncryptionUtil.encrypt(totpSecret);

    // Update user
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedTotpSecret,
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
    access_token: string;
    refresh_token: string;
    user: any;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.totpSecret) {
      throw new NotFoundException('User or TOTP secret not found');
    }

    // Decrypt and verify TOTP
    const decryptedSecret = EncryptionUtil.decrypt(user.totpSecret);
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
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Enable TOTP
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        backupCodes: hashedBackupCodes,
      },
      include: {
        wallet: true,
      },
    });

    // Generate auth tokens
    const tokens = await this.generateTokens(updatedUser);

    return {
      message: 'MFA setup completed successfully',
      backupCodes,
      ...tokens,
    };
  }

  /**
   * Complete contributor profile
   */
  async completeContributorProfile(
    userId: string,
    dto: CompleteContributorProfileDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
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

    // Generate wallet memo ID
    const memoId = this.generateMemoId();

    // Update user profile and create wallet
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        location: dto.location,
        skills: dto.skills,
        profilePicture: dto.profilePicture,
        socials: dto.socials,
        emailNotifications: dto.emailNotifications,
        profileCompleted: true,
        wallet: {
          create: {
            memoId,
            balance: 0,
          },
        },
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      `${dto.firstName} ${dto.lastName}`,
    );

    return { message: 'Profile completed successfully' };
  }

  /**
   * Complete project owner profile
   */
  async completeOwnerProfile(
    userId: string,
    dto: CompleteOwnerProfileDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
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

    // Generate wallet memo ID
    const memoId = this.generateMemoId();

    // Update user profile and create wallet
    await this.prisma.user.update({
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
        emailNotifications: dto.emailNotifications,
        profileCompleted: true,
        wallet: {
          create: {
            memoId,
            balance: 0,
          },
        },
      },
    });

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      user.email,
      `${dto.firstName} ${dto.lastName}`,
    );

    return { message: 'Profile completed successfully' };
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
   * Login with email + TOTP
   */
  async login(email: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { wallet: true },
    });

    if (!user || !user.emailVerified) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('MFA not set up');
    }

    if (!user.profileCompleted) {
      throw new UnauthorizedException('Please complete your profile first');
    }

    // Verify TOTP
    const decryptedSecret = EncryptionUtil.decrypt(user.totpSecret);
    const isValid = authenticator.verify({
      token: totpCode,
      secret: decryptedSecret,
    });

    if (!isValid) {
      // Try backup codes
      const isValidBackup = await this.verifyBackupCode(user.id, totpCode);
      if (!isValidBackup) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    return this.generateTokens(user);
  }

  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private generateMemoId(): string {
    // Generate a unique 8-character alphanumeric memo ID
    return randomBytes(4).toString('hex').toUpperCase();
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
      const isMatch = await bcrypt.compare(code, user.backupCodes[i]);
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
