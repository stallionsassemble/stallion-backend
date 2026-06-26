import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';


@Injectable()
export class DepositReconciliationCron {
  private readonly logger = new Logger(DepositReconciliationCron.name);

  constructor(@InjectQueue('deposit-reconciler') private depositQueue: Queue) {}

  /**
   * Deposit reconciliation is intentionally NOT scheduled automatically.
   * Polling every active wallet on Horizon consumes too much rate-limit budget.
   * Syncing now happens on-demand: when a user fetches their balance/transactions
   * or manually presses "Sync" in the UI.
   *
   * If you need to trigger a bulk reconciliation manually, call this method
   * directly or enqueue the job via an admin endpoint.
   */
  // @Cron(CronExpression.EVERY_5_MINUTES)
  async handleDepositReconciliation() {
    this.logger.log('Running deposit reconciliation cron job');

    try {
      await this.depositQueue.add(
        'reconcile-deposit',
        {
          limit: 50,
        },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      this.logger.log('Deposit reconciliation job queued successfully');
    } catch (error) {
      this.logger.error(
        `Failed to queue deposit reconciliation: ${error.message}`,
        error.stack,
      );
    }
  }
}
