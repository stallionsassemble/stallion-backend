import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';

@Injectable()
export class DepositReconciliationCron {
  private readonly logger = new Logger(DepositReconciliationCron.name);

  constructor(@InjectQueue('deposit-reconciler') private depositQueue: Queue) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
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
