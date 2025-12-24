import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Asset,
  Horizon,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { KmsService } from '../common/kms/kms.service';

/**
 * Stellar Account Service
 * -----------------------------------------------
 * - Master private key NEVER leaves Vault
 * - This service only knows the PUBLIC KEY
 * - All signatures are produced via Vault Transit Engine (ECDSA-P256)
 * - Transactions are built → hashed → signed → submitted
 */
@Injectable()
export class StellarAccountService implements OnModuleInit {
  private readonly logger = new Logger(StellarAccountService.name);
  private server: Horizon.Server;
  private masterPublicKey: string;
  private readonly networkPassphrase: string;

  constructor(
    private configService: ConfigService,
    private kmsService: KmsService,
  ) {
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;

    this.server = new Horizon.Server(rpcUrl, {
      allowHttp: network === 'testnet',
    });

    this.networkPassphrase =
      this.configService.get<string>('SOROBAN_NETWORK_PASSPHRASE') ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);

    // Only public key is stored in env
    this.masterPublicKey = this.configService.get<string>('MASTER_PUBLIC_KEY')!;
  }

  async onModuleInit() {
    await this.verifyMasterAccount();
  }

  /**
   * Verify that master account exists on Stellar network
   */
  private async verifyMasterAccount() {
    try {
      const account = await this.server.loadAccount(this.masterPublicKey);
      this.logger.log(
        `Master account verified: ${this.masterPublicKey} (seq=${account.sequence})`,
      );
    } catch (error) {
      this.logger.error('Master account verification failed', error);
      // TODO: Handle this error
      // throw new Error('Master account not found on Stellar network.');
    }
  }

  /**
   * Build, hash, send to Vault Transit, attach signature, submit tx
   */
  async signTransactionWithVault(tx: Transaction): Promise<Transaction> {
    // Encode transaction as XDR
    const txHash = tx.hash(); // raw 32-byte buffer

    // Base64 encode hash for vault
    const txHashB64 = Buffer.from(txHash).toString('base64');

    // Ask Vault to sign
    const vaultSignature = await this.kmsService.sign(txHashB64);

    // vault:v1:<base64sig>
    const base64Sig = vaultSignature.split(':').pop();

    const signatureBytes = Buffer.from(base64Sig!, 'base64');

    // Attach signature to transaction
    tx.addSignature(this.masterPublicKey, signatureBytes.toString('base64'));

    return tx;
  }

  getMasterPublicKey(): string {
    return this.masterPublicKey;
  }

  getServer(): Horizon.Server {
    return this.server;
  }

  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  // Removed verifyPaymentReceived - no longer needed with individual wallet architecture

  /**
   * Send payment (Vault signs the transaction)
   */
  async sendPayment(
    destination: string,
    amount: string,
    asset: Asset = Asset.native(),
  ): Promise<string> {
    try {
      const account = await this.server.loadAccount(this.masterPublicKey);

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

      // Sign using Vault Transit Engine
      const signedTx = await this.signTransactionWithVault(tx);

      const result = await this.server.submitTransaction(signedTx);

      this.logger.log(`Payment sent: ${result.hash}`);
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to send payment', error);
      throw new Error('Failed to send payment');
    }
  }

  /**
   * Get account balance (returns stroops)
   */
  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);

      const bal = account.balances.find((b) => b.asset_type === 'native');

      if (!bal) return '0';

      return BigInt(Math.floor(parseFloat(bal.balance) * 10000000)).toString();
    } catch (error) {
      this.logger.error('Failed to get account balance', error);
      return '0';
    }
  }
}
