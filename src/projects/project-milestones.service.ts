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
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { ProjectContractService } from './project-contract.service';

@Injectable()
export class ProjectMilestonesService {
  private readonly logger = new Logger(ProjectMilestonesService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: ProjectContractService,
    private activitiesService: ActivitiesService,
  ) {}

  // This method is no longer needed as UserMilestones are created
  // automatically when an application is accepted

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
        submissionNote: dto.submissionNote,
        submissionUrl: dto.submissionUrl,
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
    }

    return updatedUserMilestone;
  }

  async getMilestonesByProject(projectId: string) {
    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async getUserMilestonesByContributor(
    contributorId: string,
    projectId?: string,
  ) {
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
}
