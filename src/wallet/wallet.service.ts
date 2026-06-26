import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TxState, TxType } from '@prisma/client';
import * as StellarSdk from '@stellar/stellar-sdk';
import { Horizon } from '@stellar/stellar-sdk';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { PlatformSettingsService } from '../common/services/platform-settings.service';
import { generateIdempotencyKey } from '../common/utils/idempotency.util';
import {
  getIssuerAddress,
  getSupportedCurrencies,
  type SupportedCurrency,
} from '../common/utils/supported-currencies';
import { EnvConfig } from '../config/env.config';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { StellarWalletService } from './stellar-wallet.service';
import { ensureTrustline, hasTrustline } from './utils/trustline.util';
import { WalletSigningService } from './wallet-signing.service';

/**
 * How long (ms) to wait before re-syncing a wallet with the Stellar network.
 * Requests that arrive within this window return cached DB data instead of
 * hitting Horizon again. Manual syncs (force=true) always bypass this.
 * Default: 2 minutes.
 */
const SYNC_COOLDOWN_MS = 2 * 60 * 1000;

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private stellarWallet: StellarWalletService,
    private walletSigning: WalletSigningService,
    private configService: ConfigService,
    private platformSettingsService: PlatformSettingsService,
    @InjectQueue('withdrawal') private withdrawalQueue: Queue,
  ) {}

  async getWalletByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    this.logger.log(
      `Retrieved wallet for user ${userId}: walletId=${user.wallet.id}, publicKey=${user.wallet.publicKey}`,
    );

    return user.wallet;
  }

  async getTransactions(walletId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: { walletId },
    });

    // Sort by metadata.created_at if it exists, otherwise by transaction.createdAt
    return transactions.sort((a, b) => {
      const aMetadata = a.metadata as any;
      const bMetadata = b.metadata as any;

      const aDate = aMetadata?.created_at
        ? new Date(aMetadata.created_at)
        : a.createdAt;
      const bDate = bMetadata?.created_at
        ? new Date(bMetadata.created_at)
        : b.createdAt;

      return bDate.getTime() - aDate.getTime(); // Descending order (newest first)
    });
  }

  async createWithdrawal(
    walletId: string,
    amount: number,
    currency: string,
    payoutMethodId?: string,
    address?: string,
  ) {
    const transaction = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        include: { users: true },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      if (!wallet.users || wallet.users.length === 0) {
        throw new NotFoundException('No user associated with this wallet');
      }

      const userId = wallet.users[0].id;

      // Resolve destination: address takes precedence over payout method
      let destination: string;
      if (address) {
        // Use provided address directly
        destination = address;
      } else if (payoutMethodId) {
        // Use specified payout method
        const payoutMethod = await tx.payoutMethod.findFirst({
          where: {
            id: payoutMethodId,
            userId,
          },
        });

        if (!payoutMethod) {
          throw new NotFoundException('Payout method not found');
        }

        destination = payoutMethod.publicKey;
      } else {
        // Use default payout method
        const defaultPayoutMethod = await tx.payoutMethod.findFirst({
          where: {
            userId,
            isDefault: true,
          },
        });

        if (!defaultPayoutMethod) {
          throw new NotFoundException(
            'No default payout method found. Please add a payout method first.',
          );
        }

        destination = defaultPayoutMethod.publicKey;
      }

      // Check available balance for the specific currency
      const availableBalance = await this.getAvailableBalance(
        walletId,
        currency,
      );
      if (availableBalance < amount) {
        throw new BadRequestException(
          `Insufficient available ${currency} balance. Available: ${availableBalance}, Required: ${amount}`,
        );
      }

      // Create ledger lock to reserve funds
      const lock = await this.createLedgerLock(
        walletId,
        `Withdrawal of ${amount} ${currency}`,
      );

      // Create pending withdrawal transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TxType.WITHDRAWAL,
          amount,
          currency,
          state: TxState.PENDING,
          idempotencyKey: generateIdempotencyKey(),
          metadata: {
            lockId: lock.id,
            destination,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Created withdrawal transaction ${transaction.id} with lock ${lock.id}`,
      );

      return transaction;
    });

    // Queue withdrawal for processing AFTER the transaction is committed
    const metadata = transaction.metadata as Prisma.JsonObject;
    await this.queueWithdrawal(
      transaction.id,
      metadata.destination as string,
      Number(transaction.amount),
      transaction.currency,
      transaction.walletId,
      metadata.lockId as string,
    );

    return transaction;
  }

  async queueWithdrawal(
    transactionId: string,
    destination: string,
    amount: number,
    currency: string,
    walletId: string,
    lockId?: string,
  ) {
    // Queue withdrawal for processing
    await this.withdrawalQueue.add('process-withdrawal', {
      transactionId,
      destination,
      amount,
      currency,
      walletId,
      lockId,
    });

    this.logger.log(`Queued withdrawal ${transactionId} for processing`);

    return { transactionId, queued: true };
  }

  async createWallet() {
    return this.stellarWallet.createWallet();
  }

  async getAvailableBalance(
    walletId: string,
    currency: string = 'XLM',
  ): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Fetch all balances from Stellar network
    const allBalances = await this.stellarAccount.getAllAccountBalances(
      wallet.publicKey,
    );

    if (!allBalances || allBalances.length === 0) {
      return 0;
    }

    // Find balance for the specified currency
    let onChainBalance = 0;
    if (currency.toUpperCase() === 'XLM') {
      const nativeBalance = allBalances.find((b) => b.asset_type === 'native');
      onChainBalance = nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    } else {
      // For other assets, match by asset_code
      const assetBalance = allBalances.find(
        (b) => b.asset_code?.toUpperCase() === currency.toUpperCase(),
      );
      onChainBalance = assetBalance ? parseFloat(assetBalance.balance) : 0;
    }

    // Calculate pending withdrawals and payouts for this currency
    const pendingTransactions = await this.prisma.transaction.aggregate({
      where: {
        walletId,
        currency,
        state: TxState.PENDING,
        type: {
          in: [TxType.WITHDRAWAL, TxType.PAYOUT],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const pendingAmount = Number(pendingTransactions._sum.amount || 0);
    const available = onChainBalance - pendingAmount;

    return Math.max(0, available);
  }

  async createLedgerLock(walletId: string, reason: string) {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute TTL

    return this.prisma.ledgerLock.create({
      data: {
        walletId,
        reason,
        expiresAt,
      },
    });
  }

  async releaseLedgerLock(lockId: string) {
    try {
      await this.prisma.ledgerLock.delete({
        where: { id: lockId },
      });
      this.logger.log(`Released ledger lock ${lockId}`);
    } catch (error) {
      this.logger.warn(`Failed to release lock ${lockId}: ${error}`);
    }
  }

  async processDeposit(
    externalTxId: string,
    operationId: string,
    walletId: string,
    amount: number,
    currency: string,
  ) {
    // Check for duplicate using operationId or legacy externalTxId
    const existingTxs = await this.prisma.transaction.findMany({
      where: {
        externalTxId,
        type: TxType.DEPOSIT,
      },
    });

    const isProcessed = existingTxs.some(
      (tx) =>
        tx.idempotencyKey === operationId ||
        (tx.idempotencyKey && tx.idempotencyKey.length === 32),
    );

    if (isProcessed) {
      this.logger.warn(
        `Duplicate deposit detected for operation: ${operationId}`,
      );
      return existingTxs[0];
    }

    try {
      // Create deposit transaction directly in COMPLETED state
      const transaction = await this.prisma.transaction.create({
        data: {
          walletId,
          type: TxType.DEPOSIT,
          amount,
          currency,
          state: TxState.COMPLETED,
          externalTxId,
          idempotencyKey: operationId,
        },
      });

      this.logger.log(
        `Processed deposit ${externalTxId} (op ${operationId}): ${amount} ${currency} to wallet ${walletId}`,
      );

      return transaction;
    } catch (error: any) {
      if (error.code === 'P2002') {
        this.logger.warn(
          `Race condition: Duplicate deposit rejected by unique constraint: ${operationId}`,
        );
        return this.prisma.transaction.findUnique({
          where: { idempotencyKey: operationId },
        });
      }
      throw error;
    }
  }

  async cleanupExpiredLocks() {
    const result = await this.prisma.ledgerLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired ledger locks`);
    }

    return result.count;
  }

  /**
   * Get wallet balance with available balance for all assets
   */
  async getWalletBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    this.logger.log(
      `Getting balance for wallet ${walletId} with public key: ${wallet.publicKey}`,
    );

    // Fetch all balances from Stellar network
    const allBalances = await this.stellarAccount.getAllAccountBalances(
      wallet.publicKey,
    );

    if (!allBalances || allBalances.length === 0) {
      throw new NotFoundException(
        'Wallet not found on Stellar network. Please fund your wallet first.',
      );
    }

    // Process each balance and calculate available amounts
    const balances = await Promise.all(
      allBalances.map(async (bal) => {
        const currency =
          bal.asset_type === 'native' ? 'XLM' : bal.asset_code || 'UNKNOWN';
        const balance = parseFloat(bal.balance);

        // Calculate pending transactions for this currency
        const pendingTransactions = await this.prisma.transaction.aggregate({
          where: {
            walletId,
            currency,
            state: TxState.PENDING,
            type: {
              in: [TxType.WITHDRAWAL, TxType.PAYOUT],
            },
          },
          _sum: {
            amount: true,
          },
        });

        const pendingAmount = Number(pendingTransactions._sum.amount || 0);
        const availableBalance = Math.max(0, balance - pendingAmount);

        return {
          currency,
          balance,
          availableBalance,
          asset_type: bal.asset_type,
          asset_code: bal.asset_code,
          asset_issuer: bal.asset_issuer,
        };
      }),
    );

    return {
      balances,
      totalAssets: balances.length,
    };
  }

  /**
   * Get wallet by public key
   */
  async getWalletByPublicKey(publicKey: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { publicKey },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Get deposit address for funding wallet
   */
  async getDepositAddress(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      address: wallet.publicKey,
      instructions:
        'Send XLM or any supported token (USDC, EURC, etc.) directly to this address to fund your wallet. Make sure you have established trustlines for non-native assets.',
      activated: wallet.isActivated,
    };
  }

  /**
   * Sync wallet with blockchain state
   * - Check activation status
   * - Fetch and sync recent transactions
   */
  /**
   * Sync wallet with Stellar, but only if the wallet hasn't been synced
   * within the cooldown window. Pass force=true to always sync regardless
   * (used by the manual "Sync" endpoint).
   */
  async syncWalletIfStale(
    walletId: string,
    force = false,
  ): Promise<{
    synced: boolean;
    activated: boolean;
    transactionsSynced: number;
    skipped?: boolean;
  }> {
    if (!force) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: walletId },
        select: { lastSyncedAt: true },
      });

      if (wallet?.lastSyncedAt) {
        const age = Date.now() - wallet.lastSyncedAt.getTime();
        if (age < SYNC_COOLDOWN_MS) {
          this.logger.log(
            `Wallet ${walletId} synced ${Math.round(age / 1000)}s ago — skipping (cooldown: ${SYNC_COOLDOWN_MS / 1000}s)`,
          );
          return {
            synced: false,
            activated: true,
            transactionsSynced: 0,
            skipped: true,
          };
        }
      }
    }

    return this.syncWallet(walletId);
  }

  async syncWallet(walletId: string): Promise<{
    synced: boolean;
    activated: boolean;
    transactionsSynced: number;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    this.logger.log(
      `Syncing wallet ${walletId} (${wallet.publicKey}) with blockchain`,
    );

    try {
      // Check if account exists on blockchain
      await this.stellarAccount.getServer().loadAccount(wallet.publicKey);

      // Account exists, so it's activated
      if (!wallet.isActivated) {
        await this.prisma.wallet.update({
          where: { id: walletId },
          data: { isActivated: true },
        });
        this.logger.log(`Wallet ${walletId} marked as activated`);
      }

      // Fetch recent transactions from blockchain
      const transactionsSynced = await this.syncTransactionsFromBlockchain(
        walletId,
        wallet.publicKey,
      );

      // Stamp the sync time so cooldown checks work correctly
      await this.prisma.wallet.update({
        where: { id: walletId },
        data: { lastSyncedAt: new Date() },
      });

      return {
        synced: true,
        activated: true,
        transactionsSynced,
      };
    } catch (error: any) {
      // Account not found on blockchain (404 error)
      if (
        error.response?.status === 404 ||
        error.message?.includes('Not Found')
      ) {
        this.logger.warn(`Wallet ${walletId} not yet activated on blockchain`);

        // Ensure database reflects non-activated state
        if (wallet.isActivated) {
          await this.prisma.wallet.update({
            where: { id: walletId },
            data: { isActivated: false, lastSyncedAt: new Date() },
          });
        } else {
          // Still stamp sync time even if not yet activated
          await this.prisma.wallet.update({
            where: { id: walletId },
            data: { lastSyncedAt: new Date() },
          });
        }

        return {
          synced: true,
          activated: false,
          transactionsSynced: 0,
        };
      }

      // Other errors
      this.logger.error(`Failed to sync wallet ${walletId}`, error);
      throw new BadRequestException('Failed to sync wallet with blockchain');
    }
  }

  /**
   * Sync transactions from blockchain to database
   */
  private async syncTransactionsFromBlockchain(
    walletId: string,
    publicKey: string,
  ): Promise<number> {
    try {
      // Fetch recent transactions (limit to last 50)
      const txRecords = await this.stellarAccount
        .getServer()
        .transactions()
        .forAccount(publicKey)
        .order('desc')
        .limit(50)
        .call();

      let syncedCount = 0;

      for (const txRecord of txRecords.records) {
        // Load transaction details to get operations
        const tx = await this.stellarAccount
          .getServer()
          .transactions()
          .transaction(txRecord.id)
          .call();
        const operations = await tx.operations();

        // Check for legacy single-sync transactions to avoid duplicate parsing
        const existingTxs = await this.prisma.transaction.findMany({
          where: {
            externalTxId: txRecord.id,
          },
          select: { idempotencyKey: true },
        });

        // Process each operation
        for (const op of operations.records) {
          // Verify idempotency per operation
          const isProcessed = existingTxs.some(
            (dbTx) =>
              dbTx.idempotencyKey === op.id ||
              (dbTx.idempotencyKey && dbTx.idempotencyKey.length === 32),
          );

          if (isProcessed) {
            continue; // Skip already synced operations
          }

          const opType = op.type;
          if (opType === Horizon.HorizonApi.OperationResponseType.payment) {
            // Handle payment operations
            const paymentOp = op as Horizon.HorizonApi.PaymentOperationResponse;
            const isIncoming = paymentOp.to === publicKey;
            const amount = parseFloat(paymentOp.amount);

            // Determine currency from operation
            let currency = 'XLM';
            if (paymentOp.asset_type !== 'native') {
              currency = paymentOp.asset_code || 'UNKNOWN';
            }

            if (amount > 0) {
              try {
                // Create transaction record
                await this.prisma.transaction.create({
                  data: {
                    walletId,
                    type: isIncoming ? TxType.DEPOSIT : TxType.WITHDRAWAL,
                    amount: amount,
                    currency,
                    state: TxState.COMPLETED,
                    externalTxId: txRecord.id,
                    idempotencyKey: op.id,
                    note: `Synced from blockchain - ${op.type}`,
                    metadata: {
                      syncedAt: new Date().toISOString(),
                      operationType: op.type,
                      txHash: txRecord.hash,
                      asset_type: paymentOp.asset_type,
                      asset_code: paymentOp.asset_code,
                      asset_issuer: paymentOp.asset_issuer,
                      created_at: paymentOp.created_at,
                    } as Prisma.InputJsonValue,
                  },
                });

                syncedCount++;
                this.logger.log(
                  `Synced ${op.type} transaction: ${amount} ${currency} (${isIncoming ? 'incoming' : 'outgoing'})`,
                );
              } catch (error: any) {
                if (error.code === 'P2002') {
                  this.logger.warn(
                    `Race condition ignored during sync for operation: ${op.id}`,
                  );
                } else {
                  throw error;
                }
              }
            }
          } else if (
            opType === Horizon.HorizonApi.OperationResponseType.createAccount
          ) {
            // Handle create_account operations
            const createAccountOp =
              op as Horizon.HorizonApi.CreateAccountOperationResponse;
            // If the account being created is our wallet, it's incoming (we received the funding)
            const isIncoming = createAccountOp.account === publicKey;
            const amount = parseFloat(createAccountOp.starting_balance);
            const currency = 'XLM';

            if (amount > 0) {
              try {
                // Create transaction record
                await this.prisma.transaction.create({
                  data: {
                    walletId,
                    type: isIncoming ? TxType.DEPOSIT : TxType.WITHDRAWAL,
                    amount: amount,
                    currency,
                    state: TxState.COMPLETED,
                    externalTxId: txRecord.id,
                    idempotencyKey: op.id,
                    note: `Synced from blockchain - ${op.type}`,
                    metadata: {
                      syncedAt: new Date().toISOString(),
                      operationType: op.type,
                      txHash: txRecord.hash,
                      created_at: createAccountOp.created_at,
                    } as Prisma.InputJsonValue,
                  },
                });

                syncedCount++;
                this.logger.log(
                  `Synced ${op.type} transaction: ${amount} ${currency} (${isIncoming ? 'incoming' : 'outgoing'})`,
                );
              } catch (error: any) {
                if (error.code === 'P2002') {
                  this.logger.warn(
                    `Race condition ignored during sync for operation: ${op.id}`,
                  );
                } else {
                  throw error;
                }
              }
            }
          }
        }
      }

      this.logger.log(
        `Synced ${syncedCount} transactions for wallet ${walletId}`,
      );
      return syncedCount;
    } catch (error) {
      this.logger.error(
        `Failed to sync transactions for wallet ${walletId}`,
        error,
      );
      return 0;
    }
  }

  /**
   * Setup trustline for a specific currency
   */
  async setupTrustlineForCurrency(
    walletId: string,
    currencyCode: string,
    userId: string,
  ): Promise<{
    success: boolean;
    txHash?: string;
    message: string;
    funded?: boolean;
    fundingTxHash?: string;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );

    // Determine if we should automatically fund the wallet
    let fundingWalletId: string | undefined;

    // Only contributors get automatic funding
    if (user.role === 'CONTRIBUTOR') {
      fundingWalletId =
        await this.platformSettingsService.resolveFundingWalletId();
      if (!fundingWalletId) {
        this.logger.warn(
          'FUNDING_WALLET_ID not configured, contributor wallet will not be auto-funded',
        );
      }
    }

    try {
      const result = await ensureTrustline(
        walletId,
        wallet.publicKey,
        currencyCode,
        networkPassphrase,
        this.stellarAccount.getServer(),
        this.walletSigning,
        this.stellarWallet,
        fundingWalletId,
      );

      if (result.exists) {
        return {
          success: true,
          message: `Trustline for ${currencyCode} already exists`,
        };
      }

      return {
        success: true,
        txHash: result.txHash,
        message: `Trustline for ${currencyCode} established successfully`,
        funded: result.funded,
        fundingTxHash: result.fundingTxHash,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to setup trustline for wallet ${walletId} and currency ${currencyCode}`,
        error,
      );

      // If error is about funding and user is not a contributor (or funding failed), provide helpful message
      if (
        error instanceof BadRequestException &&
        error.message.includes('needs') &&
        error.message.includes('XLM to create trustline')
      ) {
        // This comes from ensureTrustline when funding is required but not provided
        throw new BadRequestException(
          `Your wallet requires additional XLM (approx. 2.5 XLM) to activate and establish this trustline. Please deposit XLM to your wallet address: ${wallet.publicKey}`,
        );
      }

      throw error;
    }
  }

  /**
   * Remove trustline for a specific currency
   */
  async removeTrustline(
    walletId: string,
    currencyCode: string,
  ): Promise<{
    success: boolean;
    txHash?: string;
    message: string;
  }> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    if (!wallet.isActivated) {
      throw new BadRequestException('Wallet is not activated');
    }

    // Check balance is zero for the currency
    const balance = await this.getWalletBalance(walletId);
    const assetBalance = balance.balances.find(
      (b) => b.asset_code === currencyCode,
    );
    if (assetBalance && parseFloat(assetBalance.balance.toString()) > 0) {
      throw new BadRequestException(
        `Cannot remove trustline: ${currencyCode} balance must be zero`,
      );
    }

    const networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );

    try {
      // Use Stellar SDK to remove trustline
      const server = this.stellarAccount.getServer();
      const sourceAccount = await server.loadAccount(wallet.publicKey);

      const issuer = getIssuerAddress(currencyCode, networkPassphrase);
      const asset =
        issuer === 'native'
          ? StellarSdk.Asset.native()
          : new StellarSdk.Asset(currencyCode, issuer);

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.changeTrust({
            asset,
            limit: '0', // Setting limit to 0 removes the trustline
          }),
        )
        .setTimeout(30)
        .build();

      const signedTx = await this.walletSigning.signTransaction(
        walletId,
        transaction,
      );
      const result = await server.submitTransaction(signedTx);

      return {
        success: true,
        txHash: result.hash,
        message: `Trustline for ${currencyCode} removed successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to remove trustline for wallet ${walletId} and currency ${currencyCode}`,
        error,
      );
      throw new BadRequestException(
        `Failed to remove trustline: ${error.message}`,
      );
    }
  }

  /**
   * Check if wallet has trustline for a specific currency
   */
  async checkTrustline(
    walletId: string,
    currencyCode: string,
  ): Promise<boolean> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );

    return hasTrustline(
      wallet.publicKey,
      currencyCode,
      networkPassphrase,
      this.stellarAccount.getServer(),
    );
  }

  /**
   * Get supported currencies
   * Returns list of supported currencies with their token addresses for the current network
   */
  getSupportedCurrencies(): SupportedCurrency[] {
    const networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );
    return getSupportedCurrencies(networkPassphrase);
  }
}
