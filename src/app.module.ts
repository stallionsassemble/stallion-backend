import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BountiesModule } from './bounties/bounties.module';
import { ChatModule } from './chat/chat.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { ForumModule } from './forum/forum.module';
import { HackathonsModule } from './hackathons/hackathons.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PasskeyModule } from './passkey/passkey.module';
import { PointsModule } from './points/points.module';
import { QueueModule } from './queues/queue.module';
import { ReputationModule } from './reputation/reputation.module';
import { SettingsModule } from './settings/settings.module';
import { SorobanModule } from './soroban/soroban.module';
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
    PasskeyModule,
    SettingsModule,
    BountiesModule,
    WalletModule,
    TransactionsModule,
    PointsModule,
    QueueModule,
    ReputationModule,
    SorobanModule,
    ForumModule,
    ChatModule,
    NotificationsModule,
    HackathonsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
