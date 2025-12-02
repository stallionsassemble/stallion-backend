import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { KmsService } from '../common/kms/kms.service';

import { Server as HorizonServer } from '@stellar/stellar-sdk';

/**
 * Stellar Account Service
 * Manages the master account that holds all user funds
 * Uses KMS for secure key management
 */
@Injectable()
export class StellarAccountService implements OnModuleInit {
  private readonly logger = new Logger(StellarAccountService.name);
  private server: InstanceType<typeof HorizonServer>;
  private masterKeypair: Keypair | null = null;
  private readonly networkPassphrase: string;

  constructor(
    private configService: ConfigService,
    private kmsService: KmsService,
  ) {
    const rpcUrl = this.configService.get<string>('SOROBAN_RPC_URL')!;
    const network = this.configService.get<string>('SOROBAN_NETWORK')!;

    this.server = new HorizonServer(rpcUrl, {
      allowHttp: network === 'testnet',
    });

    // Get network passphrase from config or use default
    this.networkPassphrase =
      this.configService.get<string>('SOROBAN_NETWORK_PASSPHRASE') ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
  }

  async onModuleInit() {
    await this.initializeMasterAccount();
  }

  /**
   * Initialize master account from encrypted secret key
   */
  private async initializeMasterAccount() {
    try {
      const encryptedSecretKey = this.configService.get<string>(
        'MASTER_ACCOUNT_SECRET_KEY_ENCRYPTED',
      );

      if (!encryptedSecretKey) {
        this.logger.warn(
          'MASTER_ACCOUNT_SECRET_KEY_ENCRYPTED not set - master account unavailable',
        );
        return;
      }

      // Decrypt the secret key using KMS
      const secretKey = await this.kmsService.decrypt(encryptedSecretKey);
      this.masterKeypair = Keypair.fromSecret(secretKey);

      const publicKey = this.masterKeypair.publicKey();
      this.logger.log(`Master account initialized: ${publicKey}`);

      // Verify account exists on network
      await this.getMasterAccountDetails();
    } catch (error) {
      this.logger.error('Failed to initialize master account', error);
      throw error;
    }
  }

  /**
   * Get master account details from Stellar network
   */
  async getMasterAccountDetails() {
    if (!this.masterKeypair) {
      throw new Error('Master account not initialized');
    }

    try {
      const account = await this.server.loadAccount(
        this.masterKeypair.publicKey(),
      );
      return account;
    } catch (error) {
      this.logger.error('Failed to load master account', error);
      throw new Error('Master account not found on network');
    }
  }

  /**
   * Get master account public key
   */
  getMasterPublicKey(): string {
    if (!this.masterKeypair) {
      throw new Error('Master account not initialized');
    }
    return this.masterKeypair.publicKey();
  }

  /**
   * Get master account keypair (for signing transactions)
   */
  getMasterKeypair(): Keypair {
    if (!this.masterKeypair) {
      throw new Error('Master account not initialized');
    }
    return this.masterKeypair;
  }

  /**
   * Get Stellar server instance
   */
  getServer(): InstanceType<typeof HorizonServer> {
    return this.server;
  }

  /**
   * Get network passphrase
   */
  getNetworkPassphrase(): string {
    return this.networkPassphrase;
  }

  /**
   * Check if user has sent funds to master account with correct memo
   * @param memoId User's wallet memo ID
   * @param expectedAmount Expected amount in stroops
   * @param asset Asset to check (default: native XLM)
   * @returns Transaction hash if found, null otherwise
   */
  async verifyPaymentReceived(
    memoId: string,
    expectedAmount: string,
  ): Promise<string | null> {
    try {
      const masterPublicKey = this.getMasterPublicKey();

      // Get recent payments to master account
      const payments = await this.server
        .payments()
        .forAccount(masterPublicKey)
        .order('desc')
        .limit(100)
        .call();

      // Find payment with matching memo and amount
      for (const payment of payments.records) {
        if (payment.type !== 'payment') continue;

        const txResponse = await payment.transaction();
        const memo = txResponse.memo;

        // Check if memo matches
        if (memo && memo === memoId) {
          // Check if amount matches (convert to stroops)
          const paymentAmount = BigInt(
            Math.floor(parseFloat(payment.amount) * 10000000),
          ).toString();

          if (paymentAmount === expectedAmount) {
            return payment.transaction_hash;
          }
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to verify payment', error);
      return null;
    }
  }

  /**
   * Send payment from master account
   * @param destination Destination public key
   * @param amount Amount in stroops
   * @param asset Asset to send (default: native XLM)
   * @param memo Optional memo
   * @returns Transaction hash
   */
  async sendPayment(
    destination: string,
    amount: string,
    asset: Asset = Asset.native(),
    memo?: string,
  ): Promise<string> {
    try {
      const masterAccount = await this.getMasterAccountDetails();
      const masterKeypair = this.getMasterKeypair();

      // Build transaction
      let txBuilder = new TransactionBuilder(masterAccount, {
        fee: '100000', // 0.01 XLM
        networkPassphrase: this.networkPassphrase,
      });

      // Add payment operation
      txBuilder = txBuilder.addOperation(
        Operation.payment({
          destination,
          asset,
          amount: (parseInt(amount) / 10000000).toString(), // Convert from stroops
        }),
      );

      // Add memo if provided
      if (memo) {
        txBuilder = txBuilder.addMemo(Memo.text(memo));
      }

      // Build and sign transaction
      const transaction = txBuilder.setTimeout(30).build();
      transaction.sign(masterKeypair);

      // Submit transaction
      const result = await this.server.submitTransaction(transaction);

      this.logger.log(`Payment sent: ${result.hash}`);
      return result.hash;
    } catch (error) {
      this.logger.error('Failed to send payment', error);
      throw new Error('Failed to send payment');
    }
  }

  /**
   * Get account balance
   * @param publicKey Account public key
   * @returns Balance in stroops
   */
  async getAccountBalance(publicKey: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(
        (b) => b.asset_type === 'native',
      );

      if (!nativeBalance || nativeBalance.asset_type !== 'native') {
        return '0';
      }

      // Convert to stroops
      return BigInt(
        Math.floor(parseFloat(nativeBalance.balance) * 10000000),
      ).toString();
    } catch (error) {
      this.logger.error('Failed to get account balance', error);
      return '0';
    }
  }
}
