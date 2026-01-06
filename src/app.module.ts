import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ActivitiesModule } from './activities/activities.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BountiesModule } from './bounties/bounties.module';
import { ChatModule } from './chat/chat.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { CronModule } from './cron/cron.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DiscussionsModule } from './discussions/discussions.module';
import { ForumModule } from './forum/forum.module';
import { HackathonsModule } from './hackathons/hackathons.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PasskeyModule } from './passkey/passkey.module';
import { PointsModule } from './points/points.module';
import { ProjectsModule } from './projects/projects.module';
import { QueueModule } from './queues/queue.module';
import { ReputationModule } from './reputation/reputation.module';
import { SettingsModule } from './settings/settings.module';
import { SorobanModule } from './soroban/soroban.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UploadModule } from './upload/upload.module';
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
    DiscussionsModule,
    DashboardModule,
    ChatModule,
    NotificationsModule,
    ActivitiesModule,
    HackathonsModule,
    ProjectsModule,
    UploadModule,
    CronModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
