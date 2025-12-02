import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class ChallengeStorageService {
  private readonly CHALLENGE_PREFIX = 'passkey:challenge:';
  private readonly DEFAULT_TTL = 300; // 5 minutes in seconds

  constructor(private redis: RedisService) {}

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
    await this.redis.set(key, challenge, ttl);
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
      await this.redis.delete(key);
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
    return await this.redis.exists(key);
  }

  /**
   * Delete a challenge manually
   * @param identifier User ID or email
   */
  async deleteChallenge(identifier: string): Promise<void> {
    const key = this.getChallengeKey(identifier);
    await this.redis.delete(key);
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
    return await this.redis.ping();
  }
}
