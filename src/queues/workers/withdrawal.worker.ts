import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { TxState } from '@prisma/client';
import { Asset } from '@stellar/stellar-sdk';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StellarAccountService } from '../../soroban/stellar-account.service';
import { SUPPORTED_STELLAR_ASSETS } from '../../wallet/assets.config';

interface WithdrawalJobData {
  transactionId: string;
  destination: string;
  amount: number;
  currency: string;
  walletId: string;
  lockId?: string;
}

@Injectable()
@Processor('withdrawal')
export class WithdrawalWorker extends WorkerHost {
  private readonly logger = new Logger(WithdrawalWorker.name);

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
  ) {
    super();
  }

  async process(job: Job<WithdrawalJobData>): Promise<any> {
    const { transactionId, destination, amount, currency, walletId, lockId } =
      job.data;

    this.logger.log(
      `Processing withdrawal ${transactionId}: ${amount} ${currency} to ${destination}`,
    );

    try {
      // 1. Verify transaction exists and is pending
      const transaction = await this.prisma.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (transaction.state !== TxState.PENDING) {
        this.logger.warn(
          `Transaction ${transactionId} is not pending (state: ${transaction.state})`,
        );
        return { success: false, reason: 'Transaction not pending' };
      }

      // 2. Verify wallet balance
      const wallet = await this.prisma.wallet.findUnique({
        where: { id: walletId },
      });

      if (!wallet) {
        throw new Error(`Wallet ${walletId} not found`);
      }

      if (Number(wallet.balance) < amount) {
        throw new Error(
          `Insufficient balance: ${wallet.balance.toString()} < ${amount}`,
        );
      }

      // 3. Get Stellar asset
      const asset = this.getAssetFromCurrency(currency);

      // 4. Send payment via Stellar
      const txHash = await this.stellarAccount.sendPayment(
        destination,
        (amount * 10000000).toString(), // Convert to stroops
        asset,
      );

      this.logger.log(
        `Stellar payment sent for withdrawal ${transactionId}: ${txHash}`,
      );

      // 5. Update transaction state and deduct balance atomically
      await this.prisma.$transaction(async (tx) => {
        // Mark transaction as completed
        await tx.transaction.update({
          where: { id: transactionId },
          data: {
            state: TxState.COMPLETED,
            externalTxId: txHash,
          },
        });

        // Deduct from wallet balance
        await tx.wallet.update({
          where: { id: walletId },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });
      });

      // 6. Release ledger lock
      if (lockId) {
        await this.releaseLedgerLock(lockId);
      }

      this.logger.log(
        `Withdrawal ${transactionId} completed successfully with tx hash ${txHash}`,
      );

      return {
        success: true,
        transactionId,
        txHash,
      };
    } catch (error) {
      this.logger.error(
        `Withdrawal ${transactionId} failed: ${error.message}`,
        error.stack,
      );

      // Mark transaction as failed
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          state: TxState.FAILED,
          metadata: {
            error: error.message,
            failedAt: new Date().toISOString(),
          },
        },
      });

      // Release lock on failure
      if (job.data.lockId) {
        await this.releaseLedgerLock(job.data.lockId);
      }

      throw error;
    }
  }

  private getAssetFromCurrency(currency: string): Asset {
    const assetConfig = SUPPORTED_STELLAR_ASSETS[currency];

    if (!assetConfig) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    if (assetConfig.issuer === 'native') {
      return Asset.native();
    }

    return new Asset(assetConfig.code, assetConfig.issuer);
  }

  private async releaseLedgerLock(lockId: string) {
    try {
      await this.prisma.ledgerLock.delete({
        where: { id: lockId },
      });
      this.logger.log(`Released ledger lock ${lockId}`);
    } catch (error) {
      this.logger.warn(`Failed to release lock ${lockId}: ${error.message}`);
    }
  }
}
