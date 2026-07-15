import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SocialProvider } from '@prisma/client';
import { createPublicKey, createVerify } from 'crypto';
import { normalizeEmail } from '../common/utils/normalization.util';
import { EnvConfig } from '../config/env.config';

export interface VerifiedSocialToken {
  provider: SocialProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

interface AppleJwksResponse {
  keys: Array<{
    kty: string;
    kid: string;
    use: string;
    alg: string;
    n: string;
    e: string;
  }>;
}

@Injectable()
export class SocialTokenVerifierService {
  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(
    provider: SocialProvider,
    idToken: string,
  ): Promise<VerifiedSocialToken> {
    if (provider === SocialProvider.GOOGLE) {
      return this.verifyGoogleToken(idToken);
    }

    if (provider === SocialProvider.APPLE) {
      return this.verifyAppleToken(idToken);
    }

    throw new UnauthorizedException('Unsupported social provider');
  }

  private async verifyGoogleToken(
    idToken: string,
  ): Promise<VerifiedSocialToken> {
    let response: Response;
    try {
      response = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      );
    } catch {
      throw new UnauthorizedException('Unable to verify Google ID token');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    const payload = (await response.json()) as Record<string, string>;
    const issuer = payload.iss;
    const audience = payload.aud;
    const expiresAt = Number(payload.exp || 0);
    const subject = payload.sub;

    if (
      issuer !== 'https://accounts.google.com' &&
      issuer !== 'accounts.google.com'
    ) {
      throw new UnauthorizedException('Invalid Google token issuer');
    }

    const googleClientId = this.configService.get<string>(
      EnvConfig.GOOGLE_CLIENT_ID,
    );
    if (googleClientId && audience !== googleClientId) {
      throw new UnauthorizedException('Invalid Google token audience');
    }

    if (!subject) {
      throw new UnauthorizedException('Invalid Google token subject');
    }

    if (!expiresAt || expiresAt * 1000 <= Date.now()) {
      throw new UnauthorizedException('Google ID token has expired');
    }

    return {
      provider: SocialProvider.GOOGLE,
      subject,
      email: payload.email ? normalizeEmail(payload.email) : payload.email,
      emailVerified: this.toBoolean(payload.email_verified),
      fullName: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };
  }

  private async verifyAppleToken(
    idToken: string,
  ): Promise<VerifiedSocialToken> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid Apple ID token');
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    ) as { kid?: string; alg?: string };
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Record<string, string>;

    const subject = payload.sub;
    const issuer = payload.iss;
    const audience = payload.aud;
    const expiresAt = Number(payload.exp || 0);

    if (!subject) {
      throw new UnauthorizedException('Invalid Apple token subject');
    }
    if (issuer !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer');
    }

    const appleClientId = this.configService.get<string>(
      EnvConfig.APPLE_CLIENT_ID,
    );
    if (appleClientId && audience !== appleClientId) {
      throw new UnauthorizedException('Invalid Apple token audience');
    }

    if (!expiresAt || expiresAt * 1000 <= Date.now()) {
      throw new UnauthorizedException('Apple ID token has expired');
    }

    if (header.alg !== 'RS256' || !header.kid) {
      throw new UnauthorizedException('Invalid Apple token header');
    }

    const verified = await this.verifyAppleSignature(
      encodedHeader,
      encodedPayload,
      encodedSignature,
      header.kid,
      header.alg,
    );

    if (!verified) {
      throw new UnauthorizedException('Invalid Apple token signature');
    }

    return {
      provider: SocialProvider.APPLE,
      subject,
      email: payload.email ? normalizeEmail(payload.email) : payload.email,
      emailVerified: this.toBoolean(payload.email_verified),
      fullName: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };
  }

  private async verifyAppleSignature(
    encodedHeader: string,
    encodedPayload: string,
    encodedSignature: string,
    kid: string,
    alg: string,
  ): Promise<boolean> {
    let response: Response;
    try {
      response = await fetch('https://appleid.apple.com/auth/keys');
    } catch {
      throw new UnauthorizedException('Unable to fetch Apple signing keys');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Unable to fetch Apple signing keys');
    }

    const jwks = (await response.json()) as AppleJwksResponse;
    const signingKey = jwks.keys.find(
      (key) => key.kid === kid && key.alg === alg,
    );

    if (!signingKey) {
      throw new UnauthorizedException('Apple signing key not found');
    }

    const publicKey = createPublicKey({
      key: {
        kty: signingKey.kty,
        n: signingKey.n,
        e: signingKey.e,
      },
      format: 'jwk',
    });

    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();

    return verifier.verify(
      publicKey,
      Buffer.from(encodedSignature, 'base64url'),
    );
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  }
}
