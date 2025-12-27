import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { EncryptionUtil } from '../common/utils/encryption.util';

@Injectable()
export class WalletEncryptionService {
  private readonly logger = new Logger(WalletEncryptionService.name);
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly KEY_LENGTH = 32;

  constructor() {}

  async encryptPrivateKey(
    privateKey: string,
  ): Promise<{ encryptedPrivateKey: string; encryptedDataKey: string }> {
    // Generate a random data encryption key
    const dataKeyPlaintext = EncryptionUtil.generateKey();
    const dataKeyEncrypted = EncryptionUtil.encrypt(dataKeyPlaintext);

    const dekBuffer = Buffer.from(dataKeyPlaintext, 'hex');
    const iv = randomBytes(this.IV_LENGTH);

    const cipher = createCipheriv(this.ALGORITHM, dekBuffer, iv);

    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    const encryptedPrivateKey = `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;

    this.logger.log('Private key encrypted with envelope encryption');

    return {
      encryptedPrivateKey,
      encryptedDataKey: dataKeyEncrypted,
    };
  }

  async decryptPrivateKey(
    encryptedPrivateKey: string,
    encryptedDataKey: string,
  ): Promise<string> {
    const dekPlaintext = EncryptionUtil.decrypt(encryptedDataKey);

    const dekBuffer = Buffer.from(dekPlaintext, 'hex');

    const parts = encryptedPrivateKey.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted private key format');
    }

    const [ivHex, authTagHex, encrypted] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(this.ALGORITHM, dekBuffer, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    this.logger.log('Private key decrypted transiently for signing');

    return decrypted;
  }

  async rotateDataKey(
    encryptedPrivateKey: string,
    oldEncryptedDataKey: string,
  ): Promise<{ encryptedPrivateKey: string; encryptedDataKey: string }> {
    const privateKey = await this.decryptPrivateKey(
      encryptedPrivateKey,
      oldEncryptedDataKey,
    );

    const result = await this.encryptPrivateKey(privateKey);

    this.logger.log('Data key rotated successfully');

    return result;
  }
}
