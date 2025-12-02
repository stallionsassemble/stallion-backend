import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Encryption utility for sensitive data like TOTP secrets
 * Uses AES-256-GCM for authenticated encryption
 */
export class EncryptionUtil {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;

  /**
   * Get encryption key from environment variable
   * Key must be 32 bytes (64 hex characters) for AES-256
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }

    return Buffer.from(key, 'hex');
  }

  /**
   * Encrypt a string value
   * Returns: iv:authTag:encryptedData (all hex encoded)
   */
  static encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(this.IV_LENGTH);

    const cipher = createCipheriv(this.ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted string
   * Input format: iv:authTag:encryptedData (all hex encoded)
   */
  static decrypt(encryptedData: string): string {
    const key = this.getEncryptionKey();

    // Parse the encrypted data
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate a random encryption key
   * Use this to generate a new ENCRYPTION_KEY for .env
   */
  static generateKey(): string {
    return randomBytes(32).toString('hex');
  }
}
