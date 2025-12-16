import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from 'src/queues/queue.module';
import { KmsModule } from '../common/kms/kms.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { StellarAccountService } from '../soroban/stellar-account.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => QueueModule),
    ConfigModule,
    KmsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, StellarAccountService],
  exports: [WalletService],
})
export class WalletModule {}
