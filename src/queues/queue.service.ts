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

  async addWithdrawalJob(
    transactionId: string,
    destination: string,
    amount: number,
    currency: string,
    walletId: string,
    lockId?: string,
  ) {
    return this.withdrawalQueue.add('process-withdrawal', {
      transactionId,
      destination,
      amount,
      currency,
      walletId,
      lockId,
    });
  }

  async addPayoutJob(
    winnerId: string,
    amount: number,
    currency: string,
    position: number,
    type: 'bounty' | 'hackathon',
    bountyId?: string,
    hackathonId?: string,
  ) {
    return this.payoutQueue.add('process-payout', {
      winnerId,
      amount,
      currency,
      position,
      type,
      bountyId,
      hackathonId,
    });
  }

  async addDepositReconciliationJob(cursor?: string, limit?: number) {
    return this.depositQueue.add('reconcile-deposit', {
      cursor,
      limit,
    });
  }

  async addNotificationJob(userId: string, message: string, type: string) {
    return this.notificationQueue.add('send-notification', {
      userId,
      message,
      type,
    });
  }
}
