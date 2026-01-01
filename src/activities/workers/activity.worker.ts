import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ActivitiesService } from '../activities.service';
import { ActivityPayload } from '../types/activity-payload.type';

@Processor('activities')
export class ActivityWorker extends WorkerHost {
  private readonly logger = new Logger(ActivityWorker.name);

  constructor(private activitiesService: ActivitiesService) {
    super();
  }

  async process(job: Job<ActivityPayload>): Promise<void> {
    this.logger.log(`Processing activity job ${job.id}: ${job.data.type}`);

    try {
      switch (job.name) {
        case 'create-activity':
          await this.handleCreateActivity(job.data);
          break;
        default:
          this.logger.warn(`Unknown job type: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process activity job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async handleCreateActivity(data: ActivityPayload) {
    await this.activitiesService.createActivity(data);
    this.logger.log(`Activity created: ${data.type} for user ${data.userId}`);
  }
}
