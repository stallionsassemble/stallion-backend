import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SorobanModule } from '../soroban/soroban.module';
import { PayoutMethodsController } from './payout-methods.controller';
import { PayoutMethodsService } from './payout-methods.service';
import { StellarWalletService } from './stellar-wallet.service';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletSigningService } from './wallet-signing.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    PrismaModule,
    SorobanModule,
    BullModule.registerQueue({
      name: 'withdrawal',
    }),
  ],
  controllers: [WalletController, PayoutMethodsController],
  providers: [
    WalletService,
    WalletEncryptionService,
    StellarWalletService,
    WalletSigningService,
    PayoutMethodsService,
  ],
  exports: [
    WalletService,
    StellarWalletService,
    WalletSigningService,
    PayoutMethodsService,
  ],
})
export class WalletModule {}
