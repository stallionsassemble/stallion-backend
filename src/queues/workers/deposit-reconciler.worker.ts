import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalletNotifications } from '../../notifications/helpers/notification-helper';
import { NotificationsService } from '../../notifications/notifications.service';
import { StellarAccountService } from '../../soroban/stellar-account.service';
import { WalletService } from '../../wallet/wallet.service';

interface DepositReconciliationJobData {
  cursor?: string;
  limit?: number;
}

@Injectable()
@Processor('deposit-reconciler')
export class DepositReconcilerWorker extends WorkerHost {
  private readonly logger = new Logger(DepositReconcilerWorker.name);

  constructor(
    private prisma: PrismaService,
    private stellarAccount: StellarAccountService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<DepositReconciliationJobData>): Promise<any> {
    const { cursor, limit = 50 } = job.data;

    this.logger.log(
      `Processing deposit reconciliation for individual wallets (cursor: ${cursor || 'none'}, limit: ${limit})`,
    );

    try {
      const server = this.stellarAccount.getServer();

      const wallets = await this.prisma.wallet.findMany({
        where: {
          isActivated: true,
        },
        include: { users: true },
        take: limit,
      });

      this.logger.log(`Monitoring ${wallets.length} active wallets`);

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      let lastCursor: string | undefined;

      for (const wallet of wallets) {
        try {
          let paymentsBuilder = server
            .payments()
            .forAccount(wallet.publicKey)
            .order('desc')
            .limit(10);

          // Use cursor if provided to continue from last position
          if (cursor) {
            paymentsBuilder = paymentsBuilder.cursor(cursor);
          }

          const paymentsResponse = await paymentsBuilder.call();
          const payments = paymentsResponse.records;

          // Track the latest cursor for next run
          if (payments.length > 0 && !lastCursor) {
            lastCursor = payments[0].paging_token;
          }

          for (const payment of payments) {
            if (
              payment.type !== Horizon.HorizonApi.OperationResponseType.payment
            ) {
              continue;
            }

            const paymentOp =
              payment as Horizon.HorizonApi.PaymentOperationResponse;

            if (paymentOp.to !== wallet.publicKey) {
              continue;
            }

            try {
              const txResponse = await server
                .transactions()
                .transaction(paymentOp.transaction_hash)
                .call();

              const existingTx = await this.prisma.transaction.findFirst({
                where: {
                  externalTxId: txResponse.hash,
                },
              });

              if (existingTx) {
                skippedCount++;
                continue;
              }

              const amount = parseFloat(paymentOp.amount);
              const currency =
                paymentOp.asset_type === 'native'
                  ? 'XLM'
                  : paymentOp.asset_code || 'UNKNOWN';

              await this.walletService.processDeposit(
                txResponse.hash,
                wallet.id,
                amount,
                currency,
              );

              this.logger.log(
                `Processed deposit ${txResponse.hash}: ${amount} ${currency} to wallet ${wallet.publicKey}`,
              );

              if (wallet.users.length > 0) {
                try {
                  for (const user of wallet.users) {
                    await this.notificationsService.sendNotification(
                      WalletNotifications.depositReceived(
                        user.id,
                        amount.toString(),
                        currency,
                      ),
                    );
                  }
                } catch (error) {
                  this.logger.error(
                    `Failed to send notification for deposit ${txResponse.hash}: ${error.message}`,
                  );
                }
              }

              processedCount++;
            } catch (error) {
              this.logger.error(
                `Failed to process payment ${payment.id}: ${error.message}`,
                error.stack,
              );
              errorCount++;
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to check wallet ${wallet.publicKey}: ${error.message}`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Deposit reconciliation completed: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`,
      );

      return {
        success: true,
        processedCount,
        skippedCount,
        errorCount,
        nextCursor: lastCursor,
      };
    } catch (error) {
      this.logger.error(
        `Deposit reconciliation failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
