import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MilestoneStatus,
  ProjectActivityType,
  ProjectStatus,
  ProjectType,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SubmitMilestoneDto } from './dto/submit-milestone.dto';
import { ProjectActivityService } from './project-activity.service';
import { ProjectContractService } from './project-contract.service';

@Injectable()
export class ProjectMilestonesService {
  private readonly logger = new Logger(ProjectMilestonesService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: ProjectContractService,
    private activityService: ProjectActivityService,
  ) {}

  async createMilestonesForApplication(
    applicationId: string,
    milestones: Array<{
      title: string;
      description: string;
      amount: string;
      dueDate: Date;
    }>,
  ) {
    const application = await this.prisma.projectApplication.findUnique({
      where: { id: applicationId },
      include: { project: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.project.type !== ProjectType.GIG) {
      throw new BadRequestException('Only GIG projects have milestones');
    }

    const createdMilestones = await Promise.all(
      milestones.map((milestone, index) =>
        this.prisma.projectMilestone.create({
          data: {
            projectId: application.projectId,
            applicationId,
            contributorId: application.userId,
            title: milestone.title,
            description: milestone.description,
            amount: milestone.amount,
            dueDate: milestone.dueDate,
            order: index + 1,
            status: MilestoneStatus.PENDING,
          },
        }),
      ),
    );

    await this.activityService.createActivity({
      projectId: application.projectId,
      userId: application.project.ownerId,
      type: ProjectActivityType.MILESTONE_CREATED,
      message: `Created ${milestones.length} milestones`,
      metadata: { applicationId, milestoneCount: milestones.length },
    });

    return createdMilestones;
  }

  async submitMilestone(
    milestoneId: string,
    contributorId: string,
    dto: SubmitMilestoneDto,
  ) {
    const milestone = await this.prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: true,
        application: true,
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.contributorId !== contributorId) {
      throw new ForbiddenException('Can only submit your own milestones');
    }

    if (
      milestone.status !== MilestoneStatus.PENDING &&
      milestone.status !== MilestoneStatus.REVISION_REQUESTED
    ) {
      throw new BadRequestException(
        'Milestone can only be submitted when pending or revision requested',
      );
    }

    if (milestone.project.status !== ProjectStatus.IN_PROGRESS) {
      throw new BadRequestException('Project is not in progress');
    }

    const updatedMilestone = await this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        submissionNote: dto.submissionNote,
        submissionUrl: dto.submissionUrl,
        submittedAt: new Date(),
        status: MilestoneStatus.SUBMITTED,
      },
    });

    await this.activityService.createActivity({
      projectId: milestone.projectId,
      userId: contributorId,
      type: ProjectActivityType.MILESTONE_SUBMITTED,
      message: `Submitted milestone: ${milestone.title}`,
      metadata: { milestoneId },
    });

    return updatedMilestone;
  }

  async reviewMilestone(
    milestoneId: string,
    ownerId: string,
    approve: boolean,
    reviewNote?: string,
    revisionNote?: string,
  ) {
    const milestone = await this.prisma.projectMilestone.findUnique({
      where: { id: milestoneId },
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
        contributor: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    if (milestone.project.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the project owner can review milestones',
      );
    }

    if (milestone.status !== MilestoneStatus.SUBMITTED) {
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
      if (!milestone.contributor.wallet) {
        throw new BadRequestException('Contributor does not have a wallet');
      }

      if (!milestone.project.owner.wallet) {
        throw new BadRequestException('Project owner does not have a wallet');
      }

      const paymentResult = await this.contractService.releaseMilestonePayment({
        projectId: milestone.project.contractProjectId!,
        milestoneOrder: milestone.order,
        contributorPublicKey: milestone.contributor.wallet.publicKey,
        amount: milestone.amount,
        ownerId,
        ownerPublicKey: milestone.project.owner.wallet.publicKey,
        walletId: milestone.project.owner.wallet.id,
      });

      txHash = paymentResult.txHash;
    }

    const updatedMilestone = await this.prisma.projectMilestone.update({
      where: { id: milestoneId },
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
    });

    await this.activityService.createActivity({
      projectId: milestone.projectId,
      userId: ownerId,
      type: approve
        ? ProjectActivityType.MILESTONE_APPROVED
        : ProjectActivityType.MILESTONE_REVISION_REQUESTED,
      message: approve
        ? `Approved milestone: ${milestone.title}`
        : `Requested revision for milestone: ${milestone.title}`,
      metadata: { milestoneId, txHash },
    });

    const allMilestones = await this.prisma.projectMilestone.findMany({
      where: { projectId: milestone.projectId },
    });

    const allApproved = allMilestones.every(
      (m) =>
        m.status === MilestoneStatus.APPROVED ||
        m.status === MilestoneStatus.PAID,
    );

    if (allApproved) {
      await this.prisma.project.update({
        where: { id: milestone.projectId },
        data: { status: ProjectStatus.COMPLETED },
      });

      await this.activityService.createActivity({
        projectId: milestone.projectId,
        userId: ownerId,
        type: ProjectActivityType.PROJECT_COMPLETED,
        message: 'All milestones completed, project finished',
      });
    }

    return updatedMilestone;
  }

  async getMilestonesByProject(projectId: string) {
    return this.prisma.projectMilestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  async getMilestonesByContributor(contributorId: string) {
    return this.prisma.projectMilestone.findMany({
      where: { contributorId },
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
      orderBy: { dueDate: 'asc' },
    });
  }
}
