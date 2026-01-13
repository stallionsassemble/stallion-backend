import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MilestoneStatus, ProjectStatus } from '@prisma/client';
import { ActivitiesService } from '../activities/activities.service';
import { ProjectActivities } from '../activities/helpers/activity-helper';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateUsdValue } from '../common/utils/token-price.util';
import { ProjectNotifications } from '../notifications/helpers/notification-helper';
import { NotificationsService } from '../notifications/notifications.service';
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { ProjectContractService } from './project-contract.service';

@Injectable()
export class ProjectMilestonesService {
  private readonly logger = new Logger(ProjectMilestonesService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: ProjectContractService,
    private activitiesService: ActivitiesService,
    private notificationsService: NotificationsService,
  ) {}

  async submitMilestone(
    userMilestoneId: string,
    contributorId: string,
    dto: SubmitMilestoneDto,
  ) {
    const userMilestone = await this.prisma.userMilestone.findUnique({
      where: { id: userMilestoneId },
      include: {
        milestone: {
          include: {
            project: true,
          },
        },
        application: true,
      },
    });

    if (!userMilestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (userMilestone.contributorId !== contributorId) {
      throw new ForbiddenException('Can only submit your own milestones');
    }

    if (
      userMilestone.status !== MilestoneStatus.PENDING &&
      userMilestone.status !== MilestoneStatus.REVISION_REQUESTED
    ) {
      throw new BadRequestException(
        'Milestone can only be submitted when pending or revision requested',
      );
    }

    if (userMilestone.milestone.project.status !== ProjectStatus.IN_PROGRESS) {
      throw new BadRequestException('Project is not in progress');
    }

    // Validate chronological submission: ensure all previous milestones are completed
    if (userMilestone.milestone.order > 1) {
      const previousUserMilestones = await this.prisma.userMilestone.findMany({
        where: {
          applicationId: userMilestone.applicationId,
          milestone: {
            projectId: userMilestone.milestone.projectId,
            order: {
              lt: userMilestone.milestone.order,
            },
          },
        },
        include: {
          milestone: true,
        },
        orderBy: {
          milestone: {
            order: 'asc',
          },
        },
      });

      const incompletePrevious = previousUserMilestones.find(
        (um) =>
          um.status !== MilestoneStatus.APPROVED &&
          um.status !== MilestoneStatus.PAID,
      );

      if (incompletePrevious) {
        throw new BadRequestException(
          `Cannot submit milestone ${userMilestone.milestone.order}. Milestone ${incompletePrevious.milestone.order} ("${incompletePrevious.milestone.title}") must be completed first. Milestones must be submitted chronologically.`,
        );
      }
    }

    const updatedUserMilestone = await this.prisma.userMilestone.update({
      where: { id: userMilestoneId },
      data: {
        description: dto.description,
        links: dto.links,
        attachments: dto.attachments as any,
        submittedAt: new Date(),
        status: MilestoneStatus.SUBMITTED,
      },
      include: {
        milestone: true,
      },
    });

    await this.activitiesService.recordActivity(
      ProjectActivities.milestoneSubmitted(
        contributorId,
        userMilestone.milestone.projectId,
        userMilestone.milestone.project.title,
        userMilestone.milestone.title,
      ),
    );

    if (userMilestone.milestone.project.ownerId) {
      try {
        const contributor = await this.prisma.user.findUnique({
          where: { id: contributorId },
          select: { firstName: true, lastName: true, username: true },
        });
        const contributorName =
          contributor?.firstName &&
          contributor?.lastName &&
          contributor?.username
            ? `${contributor.firstName} ${contributor.lastName}`.trim() ||
              contributor.username
            : 'A contributor';
        await this.notificationsService.sendNotification(
          ProjectNotifications.milestoneSubmitted(
            userMilestone.milestone.project.ownerId,
            userMilestone.milestone.project.title,
            userMilestone.milestone.title,
            contributorName,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send milestone submitted notification: ${error.message}`,
        );
      }
    }

    return updatedUserMilestone;
  }

  async reviewMilestone(
    userMilestoneId: string,
    ownerId: string,
    approve: boolean,
    reviewNote?: string,
    revisionNote?: string,
  ) {
    const userMilestone = await this.prisma.userMilestone.findUnique({
      where: { id: userMilestoneId },
      include: {
        milestone: {
          include: {
            project: {
              include: {
                owner: {
                  include: {
                    wallet: true,
                  },
                },
              },
            },
          },
        },
        contributor: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!userMilestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (userMilestone.milestone.project.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the project owner can review milestones',
      );
    }

    if (userMilestone.status !== MilestoneStatus.SUBMITTED) {
      throw new BadRequestException('Milestone must be submitted for review');
    }

    if (approve && !reviewNote) {
      throw new BadRequestException('Review note is required for approval');
    }

    if (!approve && !revisionNote) {
      throw new BadRequestException(
        'Revision note is required when requesting changes',
      );
    }

    let txHash: string | undefined;

    let usdValue: number | undefined;

    if (approve) {
      if (!userMilestone.contributor.wallet) {
        throw new BadRequestException('Contributor does not have a wallet');
      }

      if (!userMilestone.milestone.project.owner.wallet) {
        throw new BadRequestException('Project owner does not have a wallet');
      }

      const paymentResult = await this.contractService.releaseMilestonePayment({
        projectId: userMilestone.milestone.project.contractProjectId!,
        milestoneOrder: userMilestone.milestone.order,
        contributorPublicKey: userMilestone.contributor.wallet.publicKey,
        amount: userMilestone.milestone.amount,
        ownerId,
        ownerPublicKey: userMilestone.milestone.project.owner.wallet.publicKey,
        walletId: userMilestone.milestone.project.owner.wallet.id,
      });

      txHash = paymentResult.txHash;

      // Calculate USD value at time of payment
      usdValue = await calculateUsdValue(
        userMilestone.milestone.amount,
        userMilestone.milestone.project.currency,
      );
    }

    const updatedUserMilestone = await this.prisma.userMilestone.update({
      where: { id: userMilestoneId },
      data: {
        status: approve
          ? MilestoneStatus.APPROVED
          : MilestoneStatus.REVISION_REQUESTED,
        reviewNote: approve ? reviewNote : undefined,
        revisionNote: !approve ? revisionNote : undefined,
        reviewedAt: new Date(),
        txHash: approve ? txHash : undefined,
        paidAt: approve ? new Date() : undefined,
        usdValueAtCompletion: approve ? usdValue : undefined,
      },
      include: {
        milestone: true,
      },
    });

    if (approve) {
      await this.activitiesService.recordActivity(
        ProjectActivities.milestoneApproved(
          userMilestone.contributorId,
          userMilestone.milestone.projectId,
          userMilestone.milestone.project.title,
          userMilestone.milestone.title,
        ),
      );

      await this.activitiesService.recordActivity(
        ProjectActivities.milestonePaid(
          userMilestone.contributorId,
          userMilestone.milestone.projectId,
          userMilestone.milestone.project.title,
          userMilestone.milestone.title,
          userMilestone.milestone.amount,
          userMilestone.milestone.project.currency,
        ),
      );

      try {
        await this.notificationsService.sendNotification(
          ProjectNotifications.milestoneApproved(
            userMilestone.contributorId,
            userMilestone.milestone.project.title,
            userMilestone.milestone.title,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send milestone approved notification: ${error.message}`,
        );
      }

      try {
        await this.notificationsService.sendNotification(
          ProjectNotifications.milestonePaid(
            userMilestone.contributorId,
            userMilestone.milestone.project.title,
            userMilestone.milestone.title,
            userMilestone.milestone.amount,
            userMilestone.milestone.project.currency,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send milestone paid notification: ${error.message}`,
        );
      }
    } else {
      try {
        await this.notificationsService.sendNotification(
          ProjectNotifications.milestoneRevisionRequested(
            userMilestone.contributorId,
            userMilestone.milestone.project.title,
            userMilestone.milestone.title,
            revisionNote,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send milestone revision requested notification: ${error.message}`,
        );
      }
    }

    // Check if all user milestones for this application are completed
    const allUserMilestones = await this.prisma.userMilestone.findMany({
      where: { applicationId: userMilestone.applicationId },
    });

    const allApproved = allUserMilestones.every(
      (um) =>
        um.status === MilestoneStatus.APPROVED ||
        um.status === MilestoneStatus.PAID,
    );

    if (allApproved) {
      await this.prisma.project.update({
        where: { id: userMilestone.milestone.projectId },
        data: { status: ProjectStatus.COMPLETED },
      });

      await this.activitiesService.recordActivity(
        ProjectActivities.completed(
          ownerId,
          userMilestone.milestone.projectId,
          userMilestone.milestone.project.title,
        ),
      );

      try {
        await this.notificationsService.sendNotification(
          ProjectNotifications.projectCompleted(
            ownerId,
            userMilestone.milestone.project.title,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send project completed notification: ${error.message}`,
        );
      }

      try {
        await this.notificationsService.sendNotification(
          ProjectNotifications.projectCompleted(
            userMilestone.contributorId,
            userMilestone.milestone.project.title,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Failed to send project completed notification to contributor: ${error.message}`,
        );
      }
    }

    return updatedUserMilestone;
  }

  async getMilestonesByProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async getUserMilestonesByContributor(
    contributorId: string,
    projectId?: string,
  ) {
    if (projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // Check if user has applied to project and been approved
      const application = await this.prisma.projectApplication.findFirst({
        where: {
          projectId,
          userId: contributorId,
          status: 'ACCEPTED',
        },
      });

      if (!application) {
        throw new ForbiddenException(
          'You do not have access to milestones for this project. Only contributors with accepted applications can view milestones.',
        );
      }
    }

    return this.prisma.userMilestone.findMany({
      where: {
        contributorId,
        ...(projectId && {
          milestone: {
            projectId,
          },
        }),
      },
      include: {
        milestone: {
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
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        milestone: {
          dueDate: 'asc',
        },
      },
    });
  }

  async getMilestonesByApplication(applicationId: string, ownerId: string) {
    // First verify the application exists and belongs to a project owned by this user
    const application = await this.prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: {
        project: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.project.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You can only view milestones for your own projects',
      );
    }

    if (application.status !== 'ACCEPTED') {
      throw new BadRequestException(
        'Can only view milestones for accepted applications',
      );
    }

    // Get all user milestones for this application
    return this.prisma.userMilestone.findMany({
      where: {
        applicationId,
      },
      include: {
        milestone: {
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
                  },
                },
              },
            },
          },
        },
        contributor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        milestone: {
          order: 'asc',
        },
      },
    });
  }

  async getUserMilestoneById(userMilestoneId: string, userId: string) {
    const userMilestone = await this.prisma.userMilestone.findUnique({
      where: { id: userMilestoneId },
      include: {
        milestone: {
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
        },
        contributor: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            skills: true,
          },
        },
        application: true,
      },
    });

    if (!userMilestone) {
      throw new NotFoundException('User milestone not found');
    }

    // Check if user is either the project owner or the contributor
    const isOwner = userMilestone.milestone.project.ownerId === userId;
    const isContributor = userMilestone.contributorId === userId;

    if (!isOwner && !isContributor) {
      throw new ForbiddenException(
        'You can only view milestones for your own projects or submissions',
      );
    }

    return userMilestone;
  }
}
