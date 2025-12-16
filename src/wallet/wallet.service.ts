import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TxState, TxType } from '@prisma/client';
import { Asset } from '@stellar/stellar-sdk';
import { getSupportedCurrencies } from 'src/bounties/utils/supported-currencies';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateIdempotencyKey } from '../common/utils/idempotency.util';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { SUPPORTED_STELLAR_ASSETS } from './assets.config';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly masterAccountAddress: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private stellarAccount: StellarAccountService,
  ) {
    this.masterAccountAddress = this.configService.get<string>(
      'MASTER_ACCOUNT_PUBLIC_KEY',
    )!;
  }

  async getWalletByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user || !user.wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return user.wallet;
  }

  async getTransactions(walletId: string) {
    return this.prisma.transaction.findMany({
      where: { walletId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWithdrawal(
    walletId: string,
    amount: number,
    currency: string,
    destination: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      // Check available balance
      const availableBalance = await this.getAvailableBalance(walletId);
      if (availableBalance < amount) {
        throw new BadRequestException('Insufficient available balance');
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

      // Process withdrawal immediately (in production, queue this in BullMQ)
      await this.processWithdrawal(
        transaction.id,
        destination,
        amount,
        currency,
      );

      return transaction;
    });
  }

  async createWallet(memoId: string) {
    return this.prisma.wallet.create({
      data: {
        memoId,
        balance: 0,
      },
    });
  }

  async getAvailableBalance(walletId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Calculate pending withdrawals and payouts
    const pendingTransactions = await this.prisma.transaction.aggregate({
      where: {
        walletId,
        state: TxState.PENDING,
        type: {
          in: [TxType.WITHDRAWAL, TxType.PAYOUT],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const pendingAmount = pendingTransactions._sum.amount || 0;
    const balance = Number(wallet.balance);
    const available = balance - Number(pendingAmount);

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

      // Update wallet balance atomically
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // Mark transaction as completed
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
      // Create payout transaction
      const transaction = await tx.transaction.create({
        data: {
          walletId,
          type: TxType.PAYOUT,
          amount,
          currency,
          state: TxState.PENDING,
          idempotencyKey: generateIdempotencyKey(),
          note: `Bounty reward - Position ${position}`,
          metadata: {
            bountyId,
            position,
          } as Prisma.InputJsonValue,
        },
      });

      // Update wallet balance atomically
      await tx.wallet.update({
        where: { id: walletId },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // Mark transaction as completed
      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          state: TxState.COMPLETED,
        },
      });

      this.logger.log(
        `Processed payout to wallet ${walletId}: ${amount} ${currency} for bounty ${bountyId}`,
      );

      return transaction;
    });
  }

  /**
   * Get wallet balance with available balance
   */
  async getWalletBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const availableBalance = await this.getAvailableBalance(walletId);

    return {
      balance: Number(wallet.balance),
      availableBalance,
      currency: 'XLM', // Default to XLM for now
    };
  }

  /**
   * Get wallet by memo ID
   */
  async getWalletByMemoId(memoId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { memoId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return wallet;
  }

  /**
   * Get deposit address for funding wallet
   */
  async getDepositAddress(memoId: string) {
    return {
      address: this.masterAccountAddress,
      memo: memoId,
      memoType: 'text',
      instructions:
        'Send XLM or supported tokens to this address with the memo to credit your wallet',
    };
  }

  /**
   * Map currency code to Stellar Asset
   */
  private getAssetFromCurrency(currency: string): Asset {
    const assetConfig = SUPPORTED_STELLAR_ASSETS[currency];

    if (!assetConfig) {
      throw new BadRequestException(
        `Unsupported currency: ${currency}. Supported currencies: ${getSupportedCurrencies()
          .map((c) => c.code)
          .join(', ')}`,
      );
    }

    if (assetConfig.issuer === 'native') {
      return Asset.native();
    }

    return new Asset(assetConfig.code, assetConfig.issuer);
  }

  /**
   * Process withdrawal by sending funds via Stellar
   */
  private async processWithdrawal(
    transactionId: string,
    destination: string,
    amount: number,
    currency: string,
  ) {
    try {
      const asset = this.getAssetFromCurrency(currency);
      const txHash = await this.stellarAccount.sendPayment(
        destination,
        amount.toString(),
        asset,
      );

      // Update transaction state
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          state: TxState.COMPLETED,
          externalTxId: txHash,
        },
      });

      // Deduct from wallet balance
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (transaction) {
        await this.prisma.wallet.update({
          where: { id: transaction.walletId },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // Release lock
        const metadata = transaction.metadata as { lockId?: string };
        if (metadata?.lockId) {
          await this.releaseLedgerLock(metadata.lockId);
        }
      }

      this.logger.log(
        `Withdrawal ${transactionId} completed with tx hash ${txHash}`,
      );
    } catch (error) {
      // Mark transaction as failed
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          state: TxState.FAILED,
        },
      });

      this.logger.error(`Withdrawal ${transactionId} failed: ${error}`, error);
      throw error;
    }
  }
}
