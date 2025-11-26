import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueService } from './queue.service';
import { DepositReconcilerWorker } from './workers/deposit-reconciler.worker';
import { PayoutWorker } from './workers/payout.worker';
import { WithdrawalWorker } from './workers/withdrawal.worker';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'withdrawal' },
      { name: 'payout' },
      { name: 'deposit-reconciler' },
      { name: 'notification' },
    ),
  ],
  providers: [
    QueueService,
    WithdrawalWorker,
    PayoutWorker,
    DepositReconcilerWorker,
  ],
  exports: [QueueService],
})
export class QueueModule {}
