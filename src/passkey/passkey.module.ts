import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from 'src/common/redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ChallengeStorageService } from './challenge-storage.service';
import { PasskeyService } from './passkey.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    RedisModule,
    forwardRef(() => AuthModule),
  ],
  providers: [PasskeyService, ChallengeStorageService],
  exports: [PasskeyService],
})
export class PasskeyModule {}
