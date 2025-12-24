import { Injectable, Logger } from '@nestjs/common';
import { Keypair } from '@stellar/stellar-sdk';
import { PrismaService } from '../common/prisma/prisma.service';
import { WalletEncryptionService } from './wallet-encryption.service';

@Injectable()
export class StellarWalletService {
  private readonly logger = new Logger(StellarWalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEncryption: WalletEncryptionService,
  ) {}

  async createWallet(): Promise<{
    walletId: string;
    publicKey: string;
  }> {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const privateKey = keypair.secret();

    const { encryptedPrivateKey, encryptedDataKey } =
      await this.walletEncryption.encryptPrivateKey(privateKey);

    const wallet = await this.prisma.wallet.create({
      data: {
        publicKey,
        encryptedPrivateKey,
        encryptedDataKey,
        isActivated: false,
      },
    });

    this.logger.log(`Created new Stellar wallet: ${publicKey}`);

    return {
      walletId: wallet.id,
      publicKey: wallet.publicKey,
    };
  }

  async getWalletById(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return wallet;
  }

  async getWalletByPublicKey(publicKey: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { publicKey },
    });

    if (!wallet) {
      throw new Error(`Wallet with public key ${publicKey} not found`);
    }

    return wallet;
  }

  async activateWallet(walletId: string): Promise<void> {
    await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isActivated: true },
    });

    this.logger.log(`Wallet ${walletId} activated`);
  }

  async getDecryptedKeypair(walletId: string): Promise<Keypair> {
    const wallet = await this.getWalletById(walletId);

    const privateKey = await this.walletEncryption.decryptPrivateKey(
      wallet.encryptedPrivateKey,
      wallet.encryptedDataKey,
    );

    const keypair = Keypair.fromSecret(privateKey);

    this.logger.log(
      `Decrypted keypair for wallet ${walletId} (transient operation)`,
    );

    return keypair;
  }

  async rotateWalletKeys(walletId: string): Promise<void> {
    const wallet = await this.getWalletById(walletId);

    const { encryptedPrivateKey, encryptedDataKey } =
      await this.walletEncryption.rotateDataKey(
        wallet.encryptedPrivateKey,
        wallet.encryptedDataKey,
      );

    await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        encryptedPrivateKey,
        encryptedDataKey,
      },
    });

    this.logger.log(`Rotated encryption keys for wallet ${walletId}`);
  }
}
