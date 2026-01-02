import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TxState, TxType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateIdempotencyKey } from '../common/utils/idempotency.util';
import { EnvConfig } from '../config/env.config';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { StellarWalletService } from './stellar-wallet.service';
import { hasTrustline, setupTrustline } from './utils/trustline.util';
import { WalletSigningService } from './wallet-signing.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private stellarWallet: StellarWalletService,
    private walletSigning: WalletSigningService,
    private configService: ConfigService,
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

    // Sync wallet with blockchain before returning
    await this.syncWallet(user.wallet.id);

    // Fetch updated wallet data after sync
    const updatedWallet = await this.prisma.wallet.findUnique({
      where: { id: user.wallet.id },
    });

    return updatedWallet!;
  }

  async getTransactions(walletId: string) {
    // Sync wallet with blockchain before fetching transactions
    await this.syncWallet(walletId);

    return this.prisma.transaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWithdrawal(
    walletId: string,
    amount: number,
    currency: string,
    payoutMethodId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
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

      // Resolve destination from payout method
      let destination: string;
      if (payoutMethodId) {
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

      // Queue withdrawal for processing outside the transaction
      await this.queueWithdrawal(
        transaction.id,
        destination,
        amount,
        currency,
        walletId,
        lock.id,
      );

      return transaction;
    });
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
    walletId: string,
    amount: number,
    currency: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Check for duplicate using externalTxId
      const existing = await tx.transaction.findFirst({
        where: {
          externalTxId,
          type: TxType.DEPOSIT,
        },
      });

      if (existing) {
        this.logger.warn(`Duplicate deposit detected: ${externalTxId}`);
        return existing;
      }

      // Create deposit transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TxType.DEPOSIT,
          amount,
          currency,
          state: TxState.PENDING,
          externalTxId,
          idempotencyKey: generateIdempotencyKey(),
        },
      });

      // Mark transaction as completed (balance tracked on Stellar network)
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          state: TxState.COMPLETED,
        },
      });

      this.logger.log(
        `Processed deposit ${externalTxId}: ${amount} ${currency} to wallet ${walletId}`,
      );

      return transaction;
    });
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
   * Process payout to winner wallet
   * Used when bounty winners are selected
   */
  async processPayout(
    walletId: string,
    amount: number,
    currency: string,
    bountyId: string,
    position: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Create payout transaction (balance tracked on Stellar network)
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TxType.PAYOUT,
          amount,
          currency,
          state: TxState.COMPLETED,
          idempotencyKey: generateIdempotencyKey(),
          note: `Bounty reward - Position ${position}`,
          metadata: {
            bountyId,
            position,
          } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Processed payout to wallet ${walletId}: ${amount} ${currency} for bounty ${bountyId}`,
      );

      return transaction;
    });
  }

  /**
   * Get wallet balance with available balance for all assets
   */
  async getWalletBalance(walletId: string) {
    // Sync wallet with blockchain first
    await this.syncWallet(walletId);

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
            data: { isActivated: false },
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
        // Check if transaction already exists in database
        const existing = await this.prisma.transaction.findFirst({
          where: {
            externalTxId: txRecord.id,
          },
        });

        if (existing) {
          continue; // Skip already synced transactions
        }

        // Load transaction details to get operations
        const tx = await this.stellarAccount
          .getServer()
          .transactions()
          .transaction(txRecord.id)
          .call();
        const operations = await tx.operations();

        // Process each operation
        for (const op of operations.records) {
          const opType = op.type as string;
          if (opType === 'payment' || opType === 'create_account') {
            const isIncoming = (op as any).to === publicKey;
            const amount = parseFloat(
              (op as any).amount || (op as any).starting_balance || '0',
            );

            // Determine currency from operation
            let currency = 'XLM';
            if (opType === 'payment' && (op as any).asset_type !== 'native') {
              currency = (op as any).asset_code || 'UNKNOWN';
            }

            if (amount > 0) {
              // Create transaction record
              await this.prisma.transaction.create({
                data: {
                  walletId,
                  type: isIncoming ? TxType.DEPOSIT : TxType.WITHDRAWAL,
                  amount: amount,
                  currency,
                  state: TxState.COMPLETED,
                  externalTxId: txRecord.id,
                  idempotencyKey: generateIdempotencyKey(),
                  note: `Synced from blockchain - ${op.type}`,
                  metadata: {
                    syncedAt: new Date().toISOString(),
                    operationType: op.type,
                    txHash: txRecord.hash,
                    asset_type: (op as any).asset_type,
                    asset_code: (op as any).asset_code,
                    asset_issuer: (op as any).asset_issuer,
                  } as Prisma.InputJsonValue,
                },
              });

              syncedCount++;
              this.logger.log(
                `Synced ${op.type} transaction: ${amount} ${currency} (${isIncoming ? 'incoming' : 'outgoing'})`,
              );
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

    const networkPassphrase = this.configService.getOrThrow<string>(
      EnvConfig.SOROBAN_NETWORK_PASSPHRASE,
    );

    try {
      const result = await setupTrustline(
        walletId,
        wallet.publicKey,
        currencyCode,
        networkPassphrase,
        this.stellarAccount.getServer(),
        this.walletSigning,
      );

      if (result === 'exists') {
        return {
          success: true,
          message: `Trustline for ${currencyCode} already exists`,
        };
      }

      return {
        success: true,
        txHash: result,
        message: `Trustline for ${currencyCode} established successfully`,
      };
    } catch (error) {
      this.logger.error(
        `Failed to setup trustline for wallet ${walletId} and currency ${currencyCode}`,
        error,
      );
      throw error;
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
}
