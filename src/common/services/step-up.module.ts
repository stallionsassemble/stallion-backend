import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StepUpGuard } from '../guards/step-up.guard';
import { StepUpService } from './step-up.service';

@Module({
  imports: [ConfigModule],
  providers: [StepUpService, StepUpGuard],
  exports: [StepUpService, StepUpGuard],
})
export class StepUpModule {}
