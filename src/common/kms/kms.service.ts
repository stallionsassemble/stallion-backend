import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { EncryptionUtil } from '../utils/encryption.util';

@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);

  private readonly useVault: boolean;
  private readonly vaultAddr: string;
  private readonly vaultToken: string;
  private readonly transitKeyName: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.useVault = this.config.get('NODE_ENV') === 'production';
    this.vaultAddr = this.config.get('VAULT_ADDR') || '';
    this.vaultToken = this.config.get('VAULT_TOKEN') || '';
    this.transitKeyName =
      this.config.get('VAULT_TRANSIT_KEY') || 'stallion-key';

    if (this.useVault) {
      if (!this.vaultAddr || !this.vaultToken) {
        throw new Error(
          'VAULT_ADDR and VAULT_TOKEN are required in production',
        );
      }
      this.logger.log(
        `Vault KMS active using transit key: ${this.transitKeyName}`,
      );
    } else {
      this.logger.warn('KMS running in development mode (local encryption)');
    }
  }

  private headers() {
    return { 'X-Vault-Token': this.vaultToken };
  }

  // -----------------------------------------------------
  // ENCRYPT using Vault Transit
  // -----------------------------------------------------
  async encrypt(plaintext: string): Promise<string> {
    if (!this.useVault) return EncryptionUtil.encrypt(plaintext);

    const url = `${this.vaultAddr}/v1/transit/encrypt/${this.transitKeyName}`;

    const payload = {
      plaintext: Buffer.from(plaintext, 'utf8').toString('base64'),
    };

    const response = await firstValueFrom(
      this.http.post(url, payload, { headers: this.headers() }),
    );

    return response.data.data.ciphertext;
  }

  // -----------------------------------------------------
  // DECRYPT using Vault Transit
  // -----------------------------------------------------
  async decrypt(ciphertext: string): Promise<string> {
    if (!this.useVault) return EncryptionUtil.decrypt(ciphertext);

    const url = `${this.vaultAddr}/v1/transit/decrypt/${this.transitKeyName}`;

    const response = await firstValueFrom(
      this.http.post(url, { ciphertext }, { headers: this.headers() }),
    );

    return Buffer.from(response.data.data.plaintext, 'base64').toString('utf8');
  }

  // -----------------------------------------------------
  // SIGN (for Stellar/Soroban) using Vault Transit
  // -----------------------------------------------------
  async sign(hashXdrBase64: string): Promise<string> {
    if (!this.useVault) {
      throw new Error(
        'Signing requires Vault Transit Engine. Not available in development mode',
      );
    }

    const url = `${this.vaultAddr}/v1/transit/sign/${this.transitKeyName}`;

    const payload = {
      input: hashXdrBase64,
      signature_algorithm: 'ecdsa-p256',
    };

    const response = await firstValueFrom(
      this.http.post(url, payload, { headers: this.headers() }),
    );

    return response.data.data.signature; // vault:v1:<signature>
  }

  // -----------------------------------------------------
  // Generate a data key using Vault Transit
  // -----------------------------------------------------
  async generateDataKey(): Promise<{ plaintext: string; encrypted: string }> {
    if (!this.useVault) {
      const plaintext = EncryptionUtil.generateKey();
      const encrypted = EncryptionUtil.encrypt(plaintext);
      return { plaintext, encrypted };
    }

    const url = `${this.vaultAddr}/v1/transit/datakey/plaintext/${this.transitKeyName}`;

    const response = await firstValueFrom(
      this.http.post(url, {}, { headers: this.headers() }),
    );

    return {
      plaintext: Buffer.from(response.data.data.plaintext, 'base64').toString(
        'utf8',
      ),
      encrypted: response.data.data.ciphertext,
    };
  }

  isKmsAvailable(): boolean {
    return this.useVault;
  }
}
