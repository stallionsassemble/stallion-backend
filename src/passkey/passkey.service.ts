import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnvConfig } from '../config/env.config';
import { ChallengeStorageService } from './challenge-storage.service';

@Injectable()
export class PasskeyService {
  private rpName = 'Stallion';
  private rpID: string;
  private origin: string;

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private configService: ConfigService,
    private challengeStorage: ChallengeStorageService,
  ) {
    this.rpID = this.configService.get<string>(EnvConfig.RP_ID) || 'localhost';
    this.origin =
      this.configService.get<string>(EnvConfig.ORIGIN) ||
      'http://localhost:3000';
  }

  async generateRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: user.firstName || user.email,
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store challenge temporarily (auto-expires after 5 minutes)
    await this.challengeStorage.setChallenge(userId, options.challenge, 300);

    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
    name?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const expectedChallenge =
      await this.challengeStorage.getAndDeleteChallenge(userId);
    if (!expectedChallenge) {
      throw new BadRequestException(
        'Challenge not found or expired. Please try again.',
      );
    }

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new BadRequestException('Passkey verification failed');
      }

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      // Store passkey
      const passkey = await this.prisma.passkey.create({
        data: {
          userId,
          credentialId: Buffer.from(credential.id).toString('base64'),
          publicKey: Buffer.from(credential.publicKey).toString('base64'),
          counter: BigInt(credential.counter),
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: response.response.transports || [],
          name: name || 'Unnamed Device',
        },
      });

      // Challenge already deleted by getAndDeleteChallenge

      return {
        verified: true,
        passkeyId: passkey.id,
        message: 'Passkey registered successfully',
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to verify passkey registration: ${error.message}`,
      );
    }
  }

  async generateAuthenticationOptions(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passkeys: true },
    });

    if (!user || !user.passkeys.length) {
      throw new BadRequestException('No passkeys found for this user');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: user.passkeys.map((passkey) => ({
        id: passkey.credentialId,
        transports: passkey.transports as AuthenticatorTransport[],
      })),
      userVerification: 'preferred',
    });

    // Store challenge (auto-expires after 5 minutes)
    await this.challengeStorage.setChallenge(email, options.challenge, 300);

    return options;
  }

  async verifyAuthentication(
    email: string,
    response: AuthenticationResponseJSON,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { passkeys: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const expectedChallenge =
      await this.challengeStorage.getAndDeleteChallenge(email);
    if (!expectedChallenge) {
      throw new UnauthorizedException(
        'Challenge not found or expired. Please try again.',
      );
    }

    // Find the passkey that was used
    const passkey = user.passkeys.find(
      (p) => p.credentialId === response.rawId,
    );

    if (!passkey) {
      throw new UnauthorizedException('Passkey not found');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: Buffer.from(passkey.publicKey, 'base64'),
          counter: Number(passkey.counter),
        },
      });

      if (!verification.verified) {
        throw new UnauthorizedException('Passkey verification failed');
      }

      // Update counter and last used
      await this.prisma.passkey.update({
        where: { id: passkey.id },
        data: {
          counter: BigInt(verification.authenticationInfo.newCounter),
          lastUsedAt: new Date(),
        },
      });

      // Challenge already deleted by getAndDeleteChallenge

      // Generate JWT token
      return this.authService.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException(
        `Failed to verify passkey authentication: ${error.message}`,
      );
    }
  }

  async getUserPasskeys(userId: string) {
    return this.prisma.passkey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        deviceType: true,
        backedUp: true,
        transports: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePasskeyName(userId: string, passkeyId: string, name: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: {
        id: passkeyId,
        userId,
      },
    });

    if (!passkey) {
      throw new BadRequestException('Passkey not found');
    }

    return this.prisma.passkey.update({
      where: { id: passkeyId },
      data: { name },
      select: {
        id: true,
        name: true,
        deviceType: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async deletePasskey(userId: string, passkeyId: string) {
    const passkey = await this.prisma.passkey.findFirst({
      where: {
        id: passkeyId,
        userId,
      },
    });

    if (!passkey) {
      throw new BadRequestException('Passkey not found');
    }

    // Check if user has at least one other authentication method
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passkeys: true },
    });

    if (user && user.passkeys.length === 1 && !user.mfaEnabled) {
      throw new BadRequestException(
        'Cannot delete last passkey without TOTP enabled. Enable TOTP first.',
      );
    }

    await this.prisma.passkey.delete({
      where: { id: passkeyId },
    });

    return { message: 'Passkey deleted successfully' };
  }
}
