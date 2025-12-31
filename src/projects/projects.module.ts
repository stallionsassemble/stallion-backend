import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { ProjectActivityService } from './project-activity.service';
import { ProjectApplicationsService } from './project-applications.service';
import { ProjectContractService } from './project-contract.service';
import { ProjectMilestonesService } from './project-milestones.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [WalletModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectApplicationsService,
    ProjectMilestonesService,
    ProjectActivityService,
    ProjectContractService,
  ],
  exports: [
    ProjectsService,
    ProjectApplicationsService,
    ProjectMilestonesService,
    ProjectActivityService,
  ],
})
export class ProjectsModule {}
