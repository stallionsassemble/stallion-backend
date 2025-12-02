import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class ChallengeStorageService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;
  private readonly CHALLENGE_PREFIX = 'passkey:challenge:';
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds
  private readonly logger = new Logger(ChallengeStorageService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const redisHost = this.configService.get<string>('REDIS_HOST', 'localhost');
    const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
    const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

    this.redis = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Store a challenge with automatic expiration
   * @param identifier User ID or email
   * @param challenge The WebAuthn challenge string
   * @param ttl Time to live in seconds (default: 5 minutes)
   */
  async setChallenge(
    identifier: string,
    challenge: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    const key = this.getChallengeKey(identifier);
    await this.redis.setex(key, ttl, challenge);
  }

  /**
   * Retrieve and delete a challenge (single-use)
   * @param identifier User ID or email
   * @returns The challenge string or null if not found/expired
   */
  async getAndDeleteChallenge(identifier: string): Promise<string | null> {
    const key = this.getChallengeKey(identifier);
    const challenge = await this.redis.get(key);

    if (challenge) {
      // Delete the challenge after retrieval (single-use)
      await this.redis.del(key);
    }

    return challenge;
  }

  /**
   * Check if a challenge exists without deleting it
   * @param identifier User ID or email
   * @returns True if challenge exists
   */
  async hasChallenge(identifier: string): Promise<boolean> {
    const key = this.getChallengeKey(identifier);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * Delete a challenge manually
   * @param identifier User ID or email
   */
  async deleteChallenge(identifier: string): Promise<void> {
    const key = this.getChallengeKey(identifier);
    await this.redis.del(key);
  }

  /**
   * Get remaining TTL for a challenge
   * @param identifier User ID or email
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getChallengeTTL(identifier: string): Promise<number> {
    const key = this.getChallengeKey(identifier);
    return await this.redis.ttl(key);
  }

  /**
   * Generate the Redis key for a challenge
   */
  private getChallengeKey(identifier: string): string {
    return `${this.CHALLENGE_PREFIX}${identifier}`;
  }

  /**
   * Health check for Redis connection
   */
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis health check failed', error);
      return false;
    }
  }
}
