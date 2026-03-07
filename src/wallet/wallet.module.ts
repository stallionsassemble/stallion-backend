import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PlatformSettingsService } from '../common/services/platform-settings.service';
import { TwoFactorVerificationService } from '../common/services/two-factor-verification.service';
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
    ConfigModule,
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
    PlatformSettingsService,
    PayoutMethodsService,
    TwoFactorVerificationService,
  ],
  exports: [
    WalletService,
    StellarWalletService,
    WalletSigningService,
    PayoutMethodsService,
    TwoFactorVerificationService,
  ],
})
export class WalletModule {}
