import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
