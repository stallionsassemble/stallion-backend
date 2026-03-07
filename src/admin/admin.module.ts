import { Module } from '@nestjs/common';
import { BountiesModule } from 'src/bounties/bounties.module';
import { PrismaModule } from 'src/common/prisma/prisma.module';
import { PlatformSettingsService } from 'src/common/services/platform-settings.service';
import { TwoFactorVerificationService } from 'src/common/services/two-factor-verification.service';
import { EmailModule } from 'src/email/email.module';
import { HackathonsModule } from 'src/hackathons/hackathons.module';
import { PasskeyModule } from 'src/passkey/passkey.module';
import { ProjectsModule } from 'src/projects/projects.module';
import { WalletModule } from 'src/wallet/wallet.module';
import { AdminController } from './admin.controller';
import { AdminStepUpService } from './admin-step-up.service';
import { AdminService } from './admin.service';
import { AdminStepUpGuard } from './guards/admin-step-up.guard';
import { PayoutBackfillService } from './payout-backfill.service';

@Module({
  imports: [
    PrismaModule,
    WalletModule,
    PasskeyModule,
    EmailModule,
    BountiesModule,
    ProjectsModule,
    HackathonsModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminStepUpService,
    AdminStepUpGuard,
    PlatformSettingsService,
    TwoFactorVerificationService,
    PayoutBackfillService,
  ],
  exports: [AdminService, AdminStepUpService],
})
export class AdminModule {}
