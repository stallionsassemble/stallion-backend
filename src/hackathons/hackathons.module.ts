import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { HackathonsController } from './hackathons.controller';
import { HackathonsService } from './hackathons.service';

@Module({
  imports: [PrismaModule],
  controllers: [HackathonsController],
  providers: [HackathonsService],
  exports: [HackathonsService],
})
export class HackathonsModule {}
