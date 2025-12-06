import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KmsModule } from 'src/common/kms/kms.module';
import { StellarAccountService } from './stellar-account.service';

@Module({
  imports: [ConfigModule, KmsModule],
  providers: [StellarAccountService],
})
export class SorobanModule {}
