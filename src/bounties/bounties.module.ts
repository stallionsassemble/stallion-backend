import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivitiesModule } from '../activities/activities.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { QueueModule } from '../queues/queue.module';
import { ReputationModule } from '../reputation/reputation.module';
import { SorobanModule } from '../soroban/soroban.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { BountyController } from './bounties.controller';
import { BountiesService } from './bounties.service';
import { BountyContractService } from './bounty-contract.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    WalletModule,
    ReputationModule,
    SorobanModule,
    QueueModule,
    ActivitiesModule,
  ],
  controllers: [BountyController],
  providers: [BountiesService, AdminService, BountyContractService],
  exports: [BountiesService, AdminService],
})
export class BountiesModule {}
