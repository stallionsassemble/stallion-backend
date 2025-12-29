import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from 'src/email/email.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PointsModule } from 'src/points/points.module';
import { SorobanModule } from 'src/soroban/soroban.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { EnvConfig } from '../config/env.config';
import { DepositReconcilerWorker } from './workers/deposit-reconciler.worker';
import { EmailWorker } from './workers/email.worker';
import { WithdrawalWorker } from './workers/withdrawal.worker';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => WalletModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => EmailModule),
    SorobanModule,
    PointsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async () => ({
        connection: {
          host: EnvConfig.REDIS_HOST,
          port: EnvConfig.REDIS_PORT,
        },
      }),
    }),
    BullModule.registerQueue(
      {
        name: 'withdrawal',
      },
      {
        name: 'deposit-reconciler',
      },
      {
        name: 'email',
      },
    ),
  ],
  providers: [WithdrawalWorker, DepositReconcilerWorker, EmailWorker],
  exports: [BullModule],
})
export class QueueModule {}
