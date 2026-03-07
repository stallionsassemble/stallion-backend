import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queues/queue.module';
import { WalletModule } from '../wallet/wallet.module';
import { DepositReconciliationCron } from './deposit-reconciliation.cron';
import { KeyRotationCron } from './key-rotation.cron';
import { UserSuspensionCron } from './user-suspension.cron';
import { WithdrawalProcessingCron } from './withdrawal-processing.cron';

@Module({
  imports: [ScheduleModule.forRoot(), PrismaModule, WalletModule, QueueModule],
  providers: [
    DepositReconciliationCron,
    KeyRotationCron,
    UserSuspensionCron,
    WithdrawalProcessingCron,
  ],
})
export class CronModule {}
