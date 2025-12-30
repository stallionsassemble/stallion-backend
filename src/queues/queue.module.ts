import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvConfig } from '../config/env.config';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PointsModule } from '../points/points.module';
import { ReputationModule } from '../reputation/reputation.module';
import { SorobanModule } from '../soroban/soroban.module';
import { WalletModule } from '../wallet/wallet.module';
import { BountyWinnerWorker } from './workers/bounty-winner.worker';
import { DepositReconcilerWorker } from './workers/deposit-reconciler.worker';
import { EmailWorker } from './workers/email.worker';
import { WithdrawalWorker } from './workers/withdrawal.worker';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => WalletModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => EmailModule),
    forwardRef(() => ReputationModule),
    SorobanModule,
    PointsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>(EnvConfig.REDIS_HOST) || 'localhost',
          port: configService.get<number>(EnvConfig.REDIS_PORT) || 6379,
        },
      }),
      inject: [ConfigService],
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
      {
        name: 'bounty-winner',
      },
    ),
  ],
  providers: [
    WithdrawalWorker,
    DepositReconcilerWorker,
    EmailWorker,
    BountyWinnerWorker,
  ],
  exports: [BullModule],
})
export class QueueModule {}
