import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { EnvConfig } from '../../config/env.config';

/**
 * General-purpose step-up authentication service.
 *
 * Issues time-limited tokens after the user proves their identity through any
 * supported second-factor method (TOTP or WebAuthn passkey). Sensitive
 * endpoints (e.g. wallet withdrawals) validate the token instead of accepting
 * inline TOTP codes, decoupling "how you prove identity" from "what action you
 * perform".
 *
 * This is the user-facing equivalent of `AdminStepUpService` (which uses a
 * separate Redis key prefix for admin operations).
 */
@Injectable()
export class StepUpService {
  private readonly keyPrefix = 'step-up:';

  /** Default TTL: 5 minutes */
  private readonly defaultTtlSeconds = 300;

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Issue a step-up token for the given user.
   *
   * Store it in Redis with the configured (or default) TTL.
   */
  async issueToken(
    userId: string,
  ): Promise<{ stepUpToken: string; expiresInSeconds: number }> {
    const token = randomBytes(24).toString('hex');
    const ttlSeconds =
      this.configService.get<number>(EnvConfig.STEP_UP_TTL_SECONDS) ||
      this.defaultTtlSeconds;

    await this.redis.set(this.getKey(userId), token, ttlSeconds);

    return {
      stepUpToken: token,
      expiresInSeconds: ttlSeconds,
    };
  }

  /**
   * Verify that the supplied token matches the one stored for this user.
   * Does NOT consume the token (time-window approach).
   */
  async verifyToken(userId: string, token?: string): Promise<boolean> {
    if (!token) return false;
    const savedToken = await this.redis.get(this.getKey(userId));
    if (!savedToken) return false;
    return savedToken === token;
  }

  /**
   * Assert that the user has a valid step-up token.
   * Throws `ForbiddenException` if the token is missing, expired, or invalid.
   */
  async assertToken(userId: string, token?: string): Promise<void> {
    const valid = await this.verifyToken(userId, token);
    if (!valid) {
      throw new ForbiddenException(
        'Step-up verification required for this operation. Please verify your identity using your authenticator app or passkey.',
      );
    }
  }

  /**
   * Revoke any existing step-up token for this user.
   */
  async revokeToken(userId: string): Promise<void> {
    await this.redis.delete(this.getKey(userId));
  }

  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }
}
