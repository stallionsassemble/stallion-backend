import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionUtil } from '../utils/encryption.util';

@Injectable()
export class TwoFactorVerificationService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify 2FA for a user using TOTP code
   * Note: For sensitive operations like withdrawals, only TOTP is supported.
   * Passkey verification requires a separate challenge flow and is not suitable for this use case.
   */
  async verify2FA(
    userId: string,
    totpCode?: string,
  ): Promise<{ verified: boolean; method: 'totp' | 'backup' }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if user has TOTP enabled
    const hasTOTP = user.mfaEnabled && user.totpSecret;
    const hasPasskey = user.passkeys && user.passkeys.length > 0;

    if (!hasTOTP && !hasPasskey) {
      throw new UnauthorizedException(
        '2FA is required for this operation. Please set up 2FA in your settings.',
      );
    }

    // For sensitive operations, require TOTP
    if (!hasTOTP) {
      throw new UnauthorizedException(
        'TOTP authentication is required for withdrawals. Please set up TOTP in your settings.',
      );
    }

    if (!totpCode) {
      throw new BadRequestException('TOTP code is required for this operation');
    }

    const decryptedSecret = EncryptionUtil.decrypt(user.totpSecret!);
    const isTotpValid = authenticator.verify({
      token: totpCode,
      secret: decryptedSecret,
    });

    if (isTotpValid) {
      return { verified: true, method: 'totp' };
    }

    // Try backup codes
    const isValidBackup = await this.verifyBackupCode(userId, totpCode);
    if (isValidBackup) {
      return { verified: true, method: 'backup' };
    }

    throw new UnauthorizedException('Invalid 2FA code');
  }

  /**
   * Verify backup code
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
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
