import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReputationModule } from '../reputation/reputation.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { BountyController } from './bounties.controller';
import { BountiesService } from './bounties.service';

@Module({
  imports: [ConfigModule, PrismaModule, WalletModule, ReputationModule],
  controllers: [BountyController],
  providers: [BountiesService, AdminService],
  exports: [BountiesService, AdminService],
})
export class BountiesModule {}
