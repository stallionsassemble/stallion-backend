import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BountiesModule } from './bounties/bounties.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { PointsModule } from './points/points.module';
import { QueueModule } from './queues/queue.module';
import { SorobanModule } from './soroban/soroban.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    BountiesModule,
    SubmissionsModule,
    WalletModule,
    TransactionsModule,
    PointsModule,
    QueueModule,
    SorobanModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
