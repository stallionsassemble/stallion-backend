import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StellarAccountService } from './stellar-account.service';

@Module({
  imports: [ConfigModule],
  providers: [StellarAccountService],
  exports: [StellarAccountService],
})
export class SorobanModule {}
