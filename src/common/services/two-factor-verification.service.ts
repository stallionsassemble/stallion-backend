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
import { hasAny2FA, hasTOTP } from '../utils/mfa.util';

@Injectable()
export class TwoFactorVerificationService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Verify TOTP/backup code for a user during 2FA or step-up authentication.
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

    if (!hasAny2FA(user)) {
      throw new UnauthorizedException(
        '2FA is required for this operation. Please set up an authenticator app or passkey in your settings.',
      );
    }

    if (!hasTOTP(user)) {
      throw new UnauthorizedException(
        'Authenticator app (TOTP) is not configured for this account. Please use your passkey or set up an authenticator app.',
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
