import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class VerificationCodeStorageService {
  private readonly CODE_PREFIX = 'auth:verification:';
  private readonly DEFAULT_TTL = 600; // 10 minutes in seconds
  private readonly logger = new Logger(VerificationCodeStorageService.name);

  constructor(private redis: RedisService) {}

  /**
   * Store a verification code with automatic expiration
   * @param email User email
   * @param code 6-digit verification code
   * @param ttl Time to live in seconds (default: 10 minutes)
   */
  async setVerificationCode(
    email: string,
    code: string,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<void> {
    const key = this.getCodeKey(email);
    await this.redis.set(key, code, ttl);
    this.logger.log(`Verification code stored for ${email} with TTL ${ttl}s`);
  }

  /**
   * Retrieve a verification code without deleting it
   * @param email User email
   * @returns The verification code or null if not found/expired
   */
  async getVerificationCode(email: string): Promise<string | null> {
    const key = this.getCodeKey(email);
    return await this.redis.get(key);
  }

  /**
   * Verify a code
   * @param email User email
   * @param code Code to verify
   * @returns True if code is valid
   */
  async verifyCode(email: string, code: string): Promise<boolean> {
    const storedCode = await this.getVerificationCode(email);

    if (!storedCode) {
      this.logger.warn(`No verification code found for ${email}`);
      return false;
    }

    if (storedCode !== code) {
      this.logger.warn(`Invalid verification code for ${email}`);
      return false;
    }

    return true;
  }

  /**
   * Verify and delete a code (single-use)
   * @param email User email
   * @param code Code to verify
   * @returns True if code is valid
   */
  async verifyAndDeleteCode(email: string, code: string): Promise<boolean> {
    const storedCode = await this.getVerificationCode(email);

    if (!storedCode) {
      this.logger.warn(`No verification code found for ${email}`);
      return false;
    }

    if (storedCode !== code) {
      this.logger.warn(`Invalid verification code for ${email}`);
      return false;
    }

    // Delete the code after successful verification (single-use)
    await this.deleteVerificationCode(email);
    this.logger.log(`Verification code verified and deleted for ${email}`);
    return true;
  }

  /**
   * Check if a verification code exists
   * @param email User email
   * @returns True if code exists
   */
  async hasVerificationCode(email: string): Promise<boolean> {
    const key = this.getCodeKey(email);
    return await this.redis.exists(key);
  }

  /**
   * Delete a verification code manually
   * @param email User email
   */
  async deleteVerificationCode(email: string): Promise<void> {
    const key = this.getCodeKey(email);
    await this.redis.delete(key);
  }

  /**
   * Get remaining TTL for a verification code
   * @param email User email
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getCodeTTL(email: string): Promise<number> {
    const key = this.getCodeKey(email);
    return await this.redis.ttl(key);
  }

  /**
   * Generate the Redis key for a verification code
   */
  private getCodeKey(email: string): string {
    return `${this.CODE_PREFIX}${email.toLowerCase()}`;
  }

  /**
   * Health check for Redis connection
   */
  async isHealthy(): Promise<boolean> {
    return await this.redis.ping();
  }
}
