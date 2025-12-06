import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KmsService } from './kms.service';

@Module({
  imports: [ConfigModule, HttpModule],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}
