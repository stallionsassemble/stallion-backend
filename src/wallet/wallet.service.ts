import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TxState, TxType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateIdempotencyKey } from '../common/utils/idempotency.util';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

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

  async createWithdrawal(walletId: string, amount: number, currency: string) {
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
        amount,
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
          metadata: { lockId: lock.id } as Prisma.InputJsonValue,
        },
      });

      this.logger.log(
        `Created withdrawal transaction ${transaction.id} with lock ${lock.id}`,
      );

      // TODO: Queue withdrawal job in BullMQ
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

  async createLedgerLock(walletId: string, reason: string, amount: number) {
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
}
