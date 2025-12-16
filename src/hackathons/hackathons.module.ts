import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ReputationModule } from '../reputation/reputation.module';
import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';

@Module({
  imports: [PrismaModule, ReputationModule],
  controllers: [HackathonsController],
  providers: [HackathonsService],
  exports: [HackathonsService],
})
export class HackathonsModule {}
