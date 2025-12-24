import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Asset,
  Horizon,
  Keypair,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { StellarWalletService } from './stellar-wallet.service';

@Injectable()
export class WalletSigningService {
  private readonly logger = new Logger(WalletSigningService.name);
  private readonly server: Horizon.Server;
  private readonly networkPassphrase: string;

  constructor(
    private readonly stellarWallet: StellarWalletService,
    private readonly config: ConfigService,
  ) {
    const rpcUrl = this.config.get<string>('SOROBAN_RPC_URL')!;
    const network = this.config.get<string>('SOROBAN_NETWORK')!;

    this.server = new Horizon.Server(rpcUrl, {
      allowHttp: network === 'testnet',
    });

    this.networkPassphrase =
      this.config.get<string>('SOROBAN_NETWORK_PASSPHRASE') ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
  }

  async signAndSubmitPayment(
    walletId: string,
    destination: string,
    amount: string,
    asset: Asset = Asset.native(),
  ): Promise<string> {
    let keypair: Keypair | null = null;

    try {
      keypair = await this.stellarWallet.getDecryptedKeypair(walletId);

      const account = await this.server.loadAccount(keypair.publicKey());

      let txBuilder = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      });

      txBuilder = txBuilder.addOperation(
        Operation.payment({
          destination,
          asset,
          amount: (parseInt(amount) / 10000000).toString(),
        }),
      );

      const tx = txBuilder.setTimeout(30).build();

      tx.sign(keypair);

      const result = await this.server.submitTransaction(tx);

      this.logger.log(
        `Transaction signed and submitted: ${result.hash} from wallet ${walletId}`,
      );

      return result.hash;
    } catch (error) {
      this.logger.error(
        `Failed to sign and submit payment for wallet ${walletId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (keypair) {
        keypair = null;
      }
    }
  }

  async signTransaction(
    walletId: string,
    transaction: Transaction,
  ): Promise<Transaction> {
    let keypair: Keypair | null = null;

    try {
      keypair = await this.stellarWallet.getDecryptedKeypair(walletId);

      transaction.sign(keypair);

      this.logger.log(`Transaction signed for wallet ${walletId}`);

      return transaction;
    } catch (error) {
      this.logger.error(
        `Failed to sign transaction for wallet ${walletId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      if (keypair) {
        keypair = null;
      }
    }
  }

  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);

      const bal = account.balances.find((b) => b.asset_type === 'native');

      if (!bal) return '0';

      return BigInt(Math.floor(parseFloat(bal.balance) * 10000000)).toString();
    } catch (error) {
      this.logger.error(
        `Failed to get account balance for ${publicKey}: ${error.message}`,
      );
      return '0';
    }
  }

  async checkAccountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch {
      return false;
    }
  }
}
