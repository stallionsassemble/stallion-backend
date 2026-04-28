import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { HackathonStatus } from '@prisma/client';
import { CronJob } from 'cron';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class HackathonSchedulingService {
  private readonly logger = new Logger(HackathonSchedulingService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
  ) {}

  scheduleAnnouncement(hackathonId: string, announcementDate: Date) {
    const jobName = `hackathon-announcement-${hackathonId}`;
    this.deleteJobIfExists(jobName);

    if (announcementDate <= new Date()) {
      this.logger.log(
        `Announcement date is in the past for hackathon ${hackathonId}. Not scheduling.`,
      );
      return;
    }

    const job = new CronJob(announcementDate, async () => {
      this.logger.log(
        `Executing announcement job for hackathon ${hackathonId}`,
      );
      await this.prisma.hackathon.updateMany({
        where: { id: hackathonId, status: HackathonStatus.DRAFT },
        data: { status: HackathonStatus.PUBLISHED },
      });
    });

    type NestJSCronJob = Parameters<SchedulerRegistry['addCronJob']>[1];
    this.schedulerRegistry.addCronJob(jobName, job as unknown as NestJSCronJob);
    job.start();
    this.logger.log(
      `Scheduled announcement for hackathon ${hackathonId} at ${announcementDate.toDateString()}`,
    );
  }

  scheduleDeadline(hackathonId: string, deadline: Date) {
    const jobName = `hackathon-deadline-${hackathonId}`;
    this.deleteJobIfExists(jobName);

    if (deadline <= new Date()) {
      this.logger.log(
        `Deadline is in the past for hackathon ${hackathonId}. Not scheduling.`,
      );
      return;
    }

    const job = new CronJob(deadline, async () => {
      this.logger.log(`Executing deadline job for hackathon ${hackathonId}`);
      await this.prisma.hackathon.updateMany({
        where: { id: hackathonId, status: HackathonStatus.PUBLISHED },
        data: { status: HackathonStatus.JUDGING },
      });
    });

    type NestJSCronJob = Parameters<SchedulerRegistry['addCronJob']>[1];
    this.schedulerRegistry.addCronJob(jobName, job as unknown as NestJSCronJob);
    job.start();
    this.logger.log(
      `Scheduled deadline for hackathon ${hackathonId} at ${deadline.toDateString()}`,
    );
  }

  cancelSchedules(hackathonId: string) {
    this.deleteJobIfExists(`hackathon-announcement-${hackathonId}`);
    this.deleteJobIfExists(`hackathon-deadline-${hackathonId}`);
  }

  private deleteJobIfExists(jobName: string) {
    try {
      this.schedulerRegistry.getCronJob(jobName);
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {
      // Job doesn't exist, ignore
    }
  }
}
