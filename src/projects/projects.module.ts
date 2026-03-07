import { Module } from '@nestjs/common';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { ActivitiesModule } from '../activities/activities.module';
import { WalletModule } from '../wallet/wallet.module';
import { ProjectApplicationsService } from './project-applications.service';
import { ProjectContractService } from './project-contract.service';
import { ProjectMilestonesService } from './project-milestones.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [WalletModule, ActivitiesModule, NotificationsModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectApplicationsService,
    ProjectMilestonesService,
    ProjectContractService,
  ],
  exports: [
    ProjectsService,
    ProjectApplicationsService,
    ProjectMilestonesService,
    ProjectContractService,
  ],
})
export class ProjectsModule {}
