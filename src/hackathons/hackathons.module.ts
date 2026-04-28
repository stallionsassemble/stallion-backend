import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReputationModule } from '../reputation/reputation.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { WalletModule } from '../wallet/wallet.module';

import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';
import { HackathonSubmissionsService } from './services/hackathon-submissions.service';
import { HackathonJudgingService } from './services/hackathon-judging.service';
import { HackathonTeamsService } from './services/hackathon-teams.service';
import { HackathonContractService } from './services/hackathon-contract.service';
import { HackathonSchedulingService } from './services/hackathon-scheduling.service';

@Module({
  imports: [
    PrismaModule,
    ReputationModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    WalletModule,
  ],
  controllers: [HackathonsController],
  providers: [
    HackathonsService,
    HackathonSubmissionsService,
    HackathonJudgingService,
    HackathonTeamsService,
    HackathonContractService,
    HackathonSchedulingService,
  ],
  exports: [HackathonsService],
})
export class HackathonsModule {}
