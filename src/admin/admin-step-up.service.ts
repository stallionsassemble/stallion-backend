import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { RedisService } from 'src/common/redis/redis.service';
import { EnvConfig } from 'src/config/env.config';

@Injectable()
export class AdminStepUpService {
  private readonly keyPrefix = 'admin:step-up:';

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async issueStepUpToken(userId: string) {
    const token = randomBytes(24).toString('hex');
    const ttlSeconds =
      this.configService.get<number>(EnvConfig.ADMIN_STEP_UP_TTL_SECONDS) ||
      600;

    await this.redis.set(this.getKey(userId), token, ttlSeconds);

    return {
      token,
      expiresInSeconds: ttlSeconds,
    };
  }

  async verifyStepUpToken(userId: string, token?: string): Promise<boolean> {
    if (!token) return false;
    const savedToken = await this.redis.get(this.getKey(userId));
    if (!savedToken) return false;
    return savedToken === token;
  }

  async assertStepUpToken(userId: string, token?: string): Promise<void> {
    const valid = await this.verifyStepUpToken(userId, token);
    if (!valid) {
      throw new ForbiddenException(
        'Step-up verification required for this operation',
      );
    }
  }

  private getKey(userId: string): string {
    return `${this.keyPrefix}${userId}`;
  }
}
