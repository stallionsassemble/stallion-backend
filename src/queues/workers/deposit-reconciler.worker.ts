import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Horizon } from '@stellar/stellar-sdk';
import { Job } from 'bullmq';
import { PrismaService } from '../../common/prisma/prisma.service';
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
    const { cursor, limit = 100 } = job.data;

    this.logger.log(
      `Processing deposit reconciliation (cursor: ${cursor || 'latest'}, limit: ${limit})`,
    );

    try {
      const masterPublicKey = this.stellarAccount.getMasterPublicKey();
      const server = this.stellarAccount.getServer();

      // 1. Query Stellar for incoming payments
      let paymentsBuilder = server
        .payments()
        .forAccount(masterPublicKey)
        .order('desc')
        .limit(limit);

      if (cursor) {
        paymentsBuilder = paymentsBuilder.cursor(cursor);
      }

      const paymentsResponse = await paymentsBuilder.call();
      const payments = paymentsResponse.records;

      this.logger.log(`Found ${payments.length} payment records`);

      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      // 2. Process each payment
      for (const payment of payments) {
        // Only process payment operations
        if (payment.type !== Horizon.HorizonApi.OperationResponseType.payment) {
          continue;
        }

        const paymentOp =
          payment as Horizon.HorizonApi.PaymentOperationResponse;

        // Skip if payment is from master account (outgoing)
        if (paymentOp.from === masterPublicKey) {
          continue;
        }

        // Skip if payment is not to master account
        if (paymentOp.to !== masterPublicKey) {
          continue;
        }

        try {
          // Get transaction details for memo
          const txResponse = await server
            .transactions()
            .transaction(paymentOp.transaction_hash)
            .call();
          const memo = txResponse.memo;

          if (!memo) {
            this.logger.warn(`Payment ${payment.id} has no memo, skipping`);
            skippedCount++;
            continue;
          }

          // 3. Match memo to wallet
          const wallet = await this.prisma.wallet.findUnique({
            where: { memoId: memo },
            include: { users: true },
          });

          if (!wallet) {
            this.logger.warn(
              `No wallet found for memo ${memo}, skipping payment ${payment.id}`,
            );
            skippedCount++;
            continue;
          }

          // Check if already processed
          const existingTx = await this.prisma.transaction.findFirst({
            where: {
              externalTxId: txResponse.hash,
            },
          });

          if (existingTx) {
            this.logger.debug(
              `Payment ${txResponse.hash} already processed, skipping`,
            );
            skippedCount++;
            continue;
          }

          // 4. Calculate amount (convert from XLM to stroops equivalent)
          const amount = parseFloat(paymentOp.amount);
          const currency =
            paymentOp.asset_type === 'native'
              ? 'XLM'
              : paymentOp.asset_code || 'UNKNOWN';

          // 5. Process deposit
          const transaction = await this.walletService.processDeposit(
            txResponse.hash,
            wallet.id,
            amount,
            currency,
          );

          this.logger.log(
            `Processed deposit ${txResponse.hash}: ${amount} ${currency} to wallet ${wallet.id}`,
          );

          // 6. Send notification to user
          if (wallet.users.length > 0) {
            try {
              for (const user of wallet.users) {
                await this.notificationsService.sendNotification({
                  userId: user.id,
                  type: 'DEPOSIT_RECEIVED',
                  title: 'Deposit Received',
                  message: `You received ${amount} ${currency}`,
                  data: {
                    amount: amount.toString(),
                    currency,
                    transactionId: transaction.id,
                    txHash: txResponse.hash,
                  },
                });
              }
            } catch (error) {
              this.logger.error(
                `Failed to send notification for deposit ${txResponse.hash}: ${error.message}`,
              );
              // Don't fail the entire reconciliation if notification fails
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

      this.logger.log(
        `Deposit reconciliation completed: ${processedCount} processed, ${skippedCount} skipped, ${errorCount} errors`,
      );

      // Return the cursor for the next run
      const nextCursor =
        payments.length > 0
          ? payments[payments.length - 1].paging_token
          : cursor;

      return {
        success: true,
        processedCount,
        skippedCount,
        errorCount,
        nextCursor,
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
