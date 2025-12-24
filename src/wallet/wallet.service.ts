import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TxState, TxType } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateIdempotencyKey } from '../common/utils/idempotency.util';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { StellarWalletService } from './stellar-wallet.service';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private stellarWallet: StellarWalletService,
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

  async getAvailableBalance(walletId: string): Promise<number> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Fetch balance from Stellar network
    const onChainBalance = await this.stellarAccount.getAccountBalance(
      wallet.publicKey,
    );

    if (onChainBalance === null) {
      return 0;
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

    const pendingAmount = Number(pendingTransactions._sum.amount || 0);
    const balance = parseFloat(onChainBalance);
    const available = balance - pendingAmount;

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
   * Get wallet balance with available balance
   */
  async getWalletBalance(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Fetch balance from Stellar network
    const onChainBalance = await this.stellarAccount.getAccountBalance(
      wallet.publicKey,
    );

    if (onChainBalance === null) {
      throw new NotFoundException(
        'Wallet not found on Stellar network. Please fund your wallet first.',
      );
    }

    // Calculate available balance (on-chain balance minus pending transactions)
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

    const pendingAmount = Number(pendingTransactions._sum.amount || 0);
    const availableBalance = Math.max(
      0,
      parseFloat(onChainBalance) - pendingAmount,
    );

    return {
      balance: parseFloat(onChainBalance),
      availableBalance,
      currency: 'XLM', // Default to XLM for now
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
        'Send XLM or supported tokens directly to this address to fund your wallet',
      activated: wallet.isActivated,
    };
  }
}
