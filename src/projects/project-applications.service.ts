import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  ProjectStatus,
  ProjectType,
  Role,
} from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { ProjectActivities } from '../activities/helpers/activity-helper';
import { PrismaService } from '../common/prisma/prisma.service';
import { ApplyToProjectDto } from './dto/apply-to-project.dto';

@Injectable()
export class ProjectApplicationsService {
  private readonly logger = new Logger(ProjectApplicationsService.name);

  constructor(
    private prisma: PrismaService,
    private activitiesService: ActivitiesService,
  ) {}

  async applyToProject(
    userId: string,
    projectId: string,
    dto: ApplyToProjectDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== Role.CONTRIBUTOR) {
      throw new ForbiddenException('Only contributors can apply to projects');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        applications: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId === userId) {
      throw new BadRequestException('Cannot apply to your own project');
    }

    if (project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException('Project is not accepting applications');
    }

    if (new Date() > project.deadline) {
      throw new BadRequestException('Project deadline has passed');
    }

    const existingApplication = project.applications.find(
      (app) => app.userId === userId,
    );
    if (existingApplication) {
      throw new BadRequestException('You have already applied to this project');
    }

    if (project.type === ProjectType.GIG && !dto.estimatedCompletionTime) {
      throw new BadRequestException(
        'Estimated completion time is required for GIG projects',
      );
    }

    const application = await this.prisma.projectApplication.create({
      data: {
        projectId,
        userId,
        coverLetter: dto.coverLetter,
        estimatedCompletionTime: dto.estimatedCompletionTime,
        portfolioLinks: dto.portfolioLinks || [],
        attachments: dto.attachments,
        status: ApplicationStatus.PENDING,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            skills: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });

    await this.activitiesService.recordActivity(
      ProjectActivities.applicationSubmitted(userId, projectId, project.title),
    );

    return application;
  }

  async updateApplication(
    applicationId: string,
    userId: string,
    dto: ApplyToProjectDto,
  ) {
    const application = await this.prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.userId !== userId) {
      throw new ForbiddenException('You can only update your own application');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException(
        'Cannot update application that has been reviewed',
      );
    }

    if (new Date() > application.project.deadline) {
      throw new BadRequestException(
        'Cannot update application after project deadline',
      );
    }

    return this.prisma.projectApplication.update({
      where: { id: applicationId },
      data: {
        coverLetter: dto.coverLetter,
        estimatedCompletionTime: dto.estimatedCompletionTime,
        portfolioLinks: dto.portfolioLinks || [],
        attachments: dto.attachments,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            skills: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
    });
  }

  async reviewApplication(
    applicationId: string,
    ownerId: string,
    status: 'ACCEPTED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const application = await this.prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: {
          include: {
            applications: {
              where: { status: ApplicationStatus.ACCEPTED },
            },
            milestones: {
              orderBy: { order: 'asc' },
            },
          },
        },
        user: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.project.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the project owner can review applications',
      );
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Application has already been reviewed');
    }

    if (application.project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException('Project is not accepting applications');
    }

    if (status === 'REJECTED' && !rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    if (status === 'ACCEPTED') {
      if (application.project.type === ProjectType.GIG) {
        if (application.project.applications.length > 0) {
          throw new BadRequestException(
            'GIG projects can only have one accepted contributor',
          );
        }
      } else {
        if (
          application.project.acceptedCount >= application.project.peopleNeeded
        ) {
          throw new BadRequestException(
            'Maximum number of contributors already reached',
          );
        }
      }
    }

    const updatedApplication = await this.prisma.$transaction(async (tx) => {
      const app = await tx.projectApplication.update({
        where: { id: applicationId },
        data: {
          status:
            status === 'ACCEPTED'
              ? ApplicationStatus.ACCEPTED
              : ApplicationStatus.REJECTED,
          rejectionReason,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
              skills: true,
            },
          },
          project: true,
        },
      });

      if (status === 'ACCEPTED') {
        await tx.project.update({
          where: { id: application.projectId },
          data: {
            acceptedCount: { increment: 1 },
            status:
              application.project.type === ProjectType.GIG
                ? ProjectStatus.IN_PROGRESS
                : undefined,
          },
        });

        // Create UserMilestones for GIG projects
        if (
          application.project.type === ProjectType.GIG &&
          application.project.milestones.length > 0
        ) {
          await tx.userMilestone.createMany({
            data: application.project.milestones.map((milestone) => ({
              milestoneId: milestone.id,
              applicationId: applicationId,
              contributorId: application.userId,
            })),
          });
        }
      }

      return app;
    });

    if (status === 'ACCEPTED') {
      await this.activitiesService.recordActivity(
        ProjectActivities.applicationAccepted(
          application.userId,
          application.projectId,
          application.project.title,
        ),
      );
    } else {
      await this.activitiesService.recordActivity(
        ProjectActivities.applicationRejected(
          application.userId,
          application.projectId,
          application.project.title,
        ),
      );
    }

    return updatedApplication;
  }

  async withdrawApplication(applicationId: string, userId: string) {
    const application = await this.prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.userId !== userId) {
      throw new ForbiddenException('Can only withdraw your own application');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new BadRequestException('Can only withdraw pending applications');
    }

    const updatedApplication = await this.prisma.projectApplication.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.WITHDRAWN },
    });

    await this.activitiesService.recordActivity(
      ProjectActivities.applicationRejected(
        userId,
        application.projectId,
        application.project.title,
      ),
    );

    return updatedApplication;
  }

  async getApplicationsByProject(projectId: string) {
    return this.prisma.projectApplication.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            skills: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApplicationsByUser(userId: string) {
    return this.prisma.projectApplication.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            owner: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                companyName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
