import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { KmsModule } from '../common/kms/kms.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { SorobanModule } from '../soroban/soroban.module';
import { StellarWalletService } from './stellar-wallet.service';
import { WalletEncryptionService } from './wallet-encryption.service';
import { WalletSigningService } from './wallet-signing.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    PrismaModule,
    SorobanModule,
    KmsModule,
    BullModule.registerQueue({
      name: 'withdrawal',
    }),
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    WalletEncryptionService,
    StellarWalletService,
    WalletSigningService,
  ],
  exports: [WalletService, StellarWalletService, WalletSigningService],
})
export class WalletModule {}
