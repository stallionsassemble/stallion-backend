import {
  BadRequestException,
  Injectable,
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
import { UsersService } from '../users/users.service';
import { LoginMfaDto } from './dto/login-mfa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const sanitizedUser = sanitizeUser(user);
    return sanitizedUser;
  }

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Generate TOTP secret for MFA (required)
    const totpSecret = authenticator.generateSecret();

    // Encrypt TOTP secret before storing
    const encryptedTotpSecret = EncryptionUtil.encrypt(totpSecret);

    // Generate unique memo ID for wallet
    const memoId = this.generateMemoId();

    // Create user with wallet and encrypted TOTP secret (MFA required, but not verified yet)
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        name: registerDto.name,
        role: registerDto.role || 'CONTRIBUTOR',
        bio: registerDto.bio,
        skills: registerDto.skills || [],
        totpSecret: encryptedTotpSecret,
        totpEnabled: false, // Will be enabled after TOTP verification
        wallet: {
          create: {
            memoId,
            balance: 0,
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    // Generate QR code for TOTP setup
    const otpauth = authenticator.keyuri(user.email, 'Stallion', totpSecret);
    const qrCode = await QRCode.toDataURL(otpauth);

    return {
      userId: user.id,
      totpSecret,
      qrCode,
      message:
        'Registration successful. Please set up your authenticator app to complete registration.',
    };
  }

  async verifyTotpSetup(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.totpSecret) {
      throw new BadRequestException('User not found or TOTP not initialized');
    }

    // Decrypt TOTP secret for verification
    const decryptedTotpSecret = EncryptionUtil.decrypt(user.totpSecret);

    const isValid = authenticator.verify({
      token: code,
      secret: decryptedTotpSecret,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Enable TOTP and generate tokens
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        backupCodes: hashedBackupCodes,
      },
    });

    // Generate access and refresh tokens
    const tokens = await this.generateTokens(updatedUser);

    return {
      message: 'TOTP setup completed successfully',
      backupCodes,
      ...tokens,
    };
  }

  async login(loginDto: LoginMfaDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // TOTP is always required (MFA cannot be disabled)
    if (!user.totpEnabled) {
      throw new UnauthorizedException(
        'MFA setup incomplete. Please complete TOTP verification.',
      );
    }

    // Decrypt TOTP secret for verification
    const decryptedTotpSecret = EncryptionUtil.decrypt(user.totpSecret);

    const isValidTotp = authenticator.verify({
      token: loginDto.totpCode,
      secret: decryptedTotpSecret,
    });

    if (!isValidTotp) {
      // Check backup codes
      const isValidBackup = await this.verifyBackupCode(
        user.id,
        loginDto.totpCode,
      );
      if (!isValidBackup) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
    }

    return this.generateToken(user);
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

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
