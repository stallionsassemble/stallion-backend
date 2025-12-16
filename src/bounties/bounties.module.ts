import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KmsModule } from '../common/kms/kms.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReputationModule } from '../reputation/reputation.module';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { WalletModule } from '../wallet/wallet.module';
import { AdminService } from './admin.service';
import { BountyController } from './bounties.controller';
import { BountiesService } from './bounties.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    KmsModule,
    WalletModule,
    ReputationModule,
  ],
  controllers: [BountyController],
  providers: [StellarAccountService, BountiesService, AdminService],
  exports: [BountiesService, AdminService],
})
export class BountiesModule {}
