import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { ActivityWorker } from './workers/activity.worker';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'activities',
    }),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivityWorker],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
