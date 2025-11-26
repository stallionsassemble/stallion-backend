import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('withdrawal') private withdrawalQueue: Queue,
    @InjectQueue('payout') private payoutQueue: Queue,
    @InjectQueue('deposit-reconciler') private depositQueue: Queue,
    @InjectQueue('notification') private notificationQueue: Queue,
  ) {}

  async addWithdrawalJob(transactionId: string, data: Record<string, unknown>) {
    return this.withdrawalQueue.add('process-withdrawal', {
      transactionId,
      ...data,
    });
  }

  async addPayoutJob(bountyId: string, winnerId: string, amount: number) {
    return this.payoutQueue.add('process-payout', {
      bountyId,
      winnerId,
      amount,
    });
  }

  async addDepositReconciliationJob(data: Record<string, unknown>) {
    return this.depositQueue.add('reconcile-deposit', data);
  }

  async addNotificationJob(userId: string, message: string, type: string) {
    return this.notificationQueue.add('send-notification', {
      userId,
      message,
      type,
    });
  }
}
