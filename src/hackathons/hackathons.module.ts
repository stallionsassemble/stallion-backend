import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReputationModule } from '../reputation/reputation.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';

import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';
import { HackathonSubmissionsService } from './services/hackathon-submissions.service';
import { HackathonJudgingService } from './services/hackathon-judging.service';
import { HackathonTeamsService } from './services/hackathon-teams.service';
import { HackathonApplicationsService } from './services/hackathon-applications.service';
import { HackathonContractService } from './services/hackathon-contract.service';
import { HackathonSchedulingService } from './services/hackathon-scheduling.service';
import { AdminStepUpService } from '../admin/admin-step-up.service';
import { AdminStepUpGuard } from '../admin/guards/admin-step-up.guard';
import { AdminJudgingStepUpGuard } from './guards/admin-judging-step-up.guard';

@Module({
  imports: [
    PrismaModule,
    ReputationModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    WalletModule,
    EmailModule,
  ],
  controllers: [HackathonsController],
  providers: [
    HackathonsService,
    HackathonSubmissionsService,
    HackathonJudgingService,
    HackathonTeamsService,
    HackathonApplicationsService,
    HackathonContractService,
    HackathonSchedulingService,
    // Admins judging a hackathon go through the same 2FA step-up as the rest of the admin area.
    AdminStepUpService,
    AdminStepUpGuard,
    AdminJudgingStepUpGuard,
  ],
  exports: [HackathonsService, HackathonApplicationsService],
})
export class HackathonsModule {}
