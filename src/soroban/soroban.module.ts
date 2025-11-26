import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SorobanContract } from './soroban.contract';
import { SorobanService } from './soroban.service';

@Module({
  imports: [ConfigModule],
  providers: [SorobanService, SorobanContract],
  exports: [SorobanService],
})
export class SorobanModule {}
