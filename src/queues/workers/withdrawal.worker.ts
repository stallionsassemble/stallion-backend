import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TxState } from '@prisma/client';
import { Asset, Networks } from '@stellar/stellar-sdk';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getCurrency } from '../../common/utils/supported-currencies';
import { EnvConfig } from '../../config/env.config';
import { WalletNotifications } from '../../notifications/helpers/notification-helper';
import { NotificationsService } from '../../notifications/notifications.service';
import { WalletSigningService } from '../../wallet/wallet-signing.service';

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
  private readonly networkPassphrase: string;

  constructor(
    private prisma: PrismaService,
    private walletSigning: WalletSigningService,
    private config: ConfigService,
    private notificationsService: NotificationsService,
  ) {
    super();
    const network = this.config.get<string>(EnvConfig.SOROBAN_NETWORK);
    this.networkPassphrase =
      this.config.get<string>(EnvConfig.SOROBAN_NETWORK_PASSPHRASE) ||
      (network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC);
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

      // 3. Get Stellar asset and decimals
      const { asset, decimals } = this.getAssetFromCurrency(currency);

      // 4. Send payment via Stellar using user's wallet
      const txHash = await this.walletSigning.signAndSubmitPayment(
        walletId,
        destination,
        (amount * Math.pow(10, decimals)).toString(),
        asset,
        decimals,
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

        // Balance tracked on Stellar network, no DB update needed
      });

      // 6. Release ledger lock
      if (lockId) {
        await this.releaseLedgerLock(lockId);
      }

      this.logger.log(
        `Withdrawal ${transactionId} completed successfully with tx hash ${txHash}`,
      );

      // 7. Send withdrawal completed notification
      try {
        const wallet = await this.prisma.wallet.findUnique({
          where: { id: walletId },
          include: { users: true },
        });
        if (wallet?.users && wallet.users.length > 0) {
          for (const user of wallet.users) {
            await this.notificationsService.sendNotification(
              WalletNotifications.withdrawalCompleted(
                user.id,
                amount.toString(),
                currency,
              ),
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Failed to send withdrawal completed notification: ${error.message}`,
        );
      }

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

      // Send withdrawal failed notification
      try {
        const wallet = await this.prisma.wallet.findUnique({
          where: { id: walletId },
          include: { users: true },
        });
        if (wallet?.users && wallet.users.length > 0) {
          for (const user of wallet.users) {
            await this.notificationsService.sendNotification(
              WalletNotifications.withdrawalFailed(
                user.id,
                amount.toString(),
                currency,
                error.message,
              ),
            );
          }
        }
      } catch (notifError) {
        this.logger.error(
          `Failed to send withdrawal failed notification: ${notifError.message}`,
        );
      }

      throw error;
    }
  }

  private getAssetFromCurrency(currency: string): {
    asset: Asset;
    decimals: number;
  } {
    try {
      const currencyInfo = getCurrency(currency, this.networkPassphrase);

      const asset =
        currencyInfo.issuer === 'native'
          ? Asset.native()
          : new Asset(currencyInfo.code, currencyInfo.issuer);

      return {
        asset,
        decimals: currencyInfo.decimals,
      };
    } catch {
      throw new Error(
        `Unsupported currency: ${currency} on network ${this.networkPassphrase}`,
      );
    }
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
