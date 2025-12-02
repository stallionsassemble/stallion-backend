import {
    DecryptCommand,
    EncryptCommand,
    GenerateDataKeyCommand,
    KMSClient,
} from '@aws-sdk/client-kms';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionUtil } from '../utils/encryption.util';

/**
 * KMS Service for secure key management
 * Supports both AWS KMS and local encryption for development
 */
@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);
  private kmsClient: KMSClient | null = null;
  private readonly useKms: boolean;
  private readonly kmsKeyId: string | null;

  constructor(private configService: ConfigService) {
    this.useKms = this.configService.get<string>('NODE_ENV') === 'production';
    this.kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');

    if (this.useKms) {
      if (!this.kmsKeyId) {
        throw new Error('AWS_KMS_KEY_ID is required in production');
      }

      this.kmsClient = new KMSClient({
        region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          )!,
        },
      });

      this.logger.log('KMS initialized with AWS KMS');
    } else {
      this.logger.warn(
        'KMS running in development mode - using local encryption',
      );
    }
  }

  /**
   * Encrypt sensitive data (e.g., private keys)
   * Uses AWS KMS in production, local encryption in development
   */
  async encrypt(plaintext: string): Promise<string> {
    if (this.useKms && this.kmsClient && this.kmsKeyId) {
      try {
        const command = new EncryptCommand({
          KeyId: this.kmsKeyId,
          Plaintext: Buffer.from(plaintext, 'utf-8'),
        });

        const response = await this.kmsClient.send(command);
        return Buffer.from(response.CiphertextBlob!).toString('base64');
      } catch (error) {
        this.logger.error('KMS encryption failed', error);
        throw new Error('Failed to encrypt data with KMS');
      }
    }

    // Development: use local encryption
    return EncryptionUtil.encrypt(plaintext);
  }

  /**
   * Decrypt sensitive data
   * Uses AWS KMS in production, local encryption in development
   */
  async decrypt(ciphertext: string): Promise<string> {
    if (this.useKms && this.kmsClient) {
      try {
        const command = new DecryptCommand({
          CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        });

        const response = await this.kmsClient.send(command);
        return Buffer.from(response.Plaintext!).toString('utf-8');
      } catch (error) {
        this.logger.error('KMS decryption failed', error);
        throw new Error('Failed to decrypt data with KMS');
      }
    }

    // Development: use local encryption
    return EncryptionUtil.decrypt(ciphertext);
  }

  /**
   * Generate a data encryption key
   * Returns both plaintext and encrypted versions
   */
  async generateDataKey(): Promise<{
    plaintext: string;
    encrypted: string;
  }> {
    if (this.useKms && this.kmsClient && this.kmsKeyId) {
      try {
        const command = new GenerateDataKeyCommand({
          KeyId: this.kmsKeyId,
          KeySpec: 'AES_256',
        });

        const response = await this.kmsClient.send(command);

        return {
          plaintext: Buffer.from(response.Plaintext!).toString('hex'),
          encrypted: Buffer.from(response.CiphertextBlob!).toString('base64'),
        };
      } catch (error) {
        this.logger.error('KMS data key generation failed', error);
        throw new Error('Failed to generate data key with KMS');
      }
    }

    // Development: generate random key
    const plaintext = EncryptionUtil.generateKey();
    const encrypted = EncryptionUtil.encrypt(plaintext);

    return { plaintext, encrypted };
  }

  /**
   * Check if KMS is available and properly configured
   */
  isKmsAvailable(): boolean {
    return this.useKms && this.kmsClient !== null && this.kmsKeyId !== null;
  }
}
