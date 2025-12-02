import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KmsModule } from '../common/kms/kms.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { AdminService } from './admin.service';
import { BountyController } from './bounty.controller';
import { BountyService } from './bounty.service';

@Module({
  imports: [ConfigModule, PrismaModule, KmsModule],
  controllers: [BountyController],
  providers: [StellarAccountService, BountyService, AdminService],
  exports: [BountyService, AdminService],
})
export class BountyModule {}
