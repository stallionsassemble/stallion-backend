import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ProjectActivityType,
  ProjectStatus,
  ProjectType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectActivityService } from './project-activity.service';
import { ProjectContractService } from './project-contract.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: ProjectContractService,
    private activityService: ProjectActivityService,
  ) {}

  async createProject(ownerId: string, dto: CreateProjectDto) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: { wallet: true },
    });

    if (!owner || !owner.wallet) {
      throw new NotFoundException('User or wallet not found');
    }

    if (owner.role !== Role.PROJECT_OWNER) {
      throw new ForbiddenException('Only project owners can create projects');
    }

    if (dto.type === ProjectType.GIG) {
      if (!dto.milestones || dto.milestones.length === 0) {
        throw new BadRequestException('GIG projects must have milestones');
      }

      const totalMilestoneAmount = dto.milestones.reduce(
        (sum, m) => sum + BigInt(m.amount),
        BigInt(0),
      );
      const rewardAmount = BigInt(dto.reward);

      if (totalMilestoneAmount !== rewardAmount) {
        throw new BadRequestException(
          'Sum of milestone amounts must equal total reward',
        );
      }
    }

    if (dto.type === ProjectType.JOB && dto.milestones) {
      throw new BadRequestException('JOB projects cannot have milestones');
    }

    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) {
      throw new BadRequestException('Deadline must be in the future');
    }

    const platformFee = '100000000';

    let contractProjectId: number | undefined;
    let txHash: string | undefined;

    if (dto.type === ProjectType.GIG) {
      const milestonesWithOrder = dto.milestones!.map((m, index) => ({
        amount: m.amount,
        order: index + 1,
      }));

      const escrowResult = await this.contractService.createGigEscrow({
        ownerId,
        ownerPublicKey: owner.wallet.publicKey,
        walletId: owner.wallet.id,
        reward: dto.reward,
        currency: dto.currency,
        milestones: milestonesWithOrder,
        deadline,
        platformFee,
      });
      contractProjectId = escrowResult.contractProjectId;
      txHash = escrowResult.txHash;
    } else {
      const jobResult = await this.contractService.createJobProject({
        ownerId,
        ownerPublicKey: owner.wallet.publicKey,
        walletId: owner.wallet.id,
        rewardAmount: dto.reward,
        currency: dto.currency,
        platformFee,
        deadline,
      });
      contractProjectId = jobResult.contractProjectId;
      txHash = jobResult.txHash;
    }

    const project = await this.prisma.project.create({
      data: {
        title: dto.title,
        shortDescription: dto.shortDescription,
        description: dto.description,
        requirements: dto.requirements || [],
        deliverables: dto.deliverables || [],
        skills: dto.skills,
        attachments: dto.attachments,
        reward: dto.reward,
        currency: dto.currency,
        deadline,
        type: dto.type,
        peopleNeeded: dto.peopleNeeded,
        status: ProjectStatus.OPEN,
        contractProjectId,
        txHash,
        ownerId,
      },
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
    });

    await this.activityService.createActivity({
      projectId: project.id,
      userId: ownerId,
      type: ProjectActivityType.PROJECT_CREATED,
      message: `Project "${project.title}" created`,
    });

    return project;
  }

  async getProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
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
        applications: {
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
        },
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async listProjects(filters?: {
    type?: ProjectType;
    status?: ProjectStatus;
    ownerId?: string;
  }) {
    return this.prisma.project.findMany({
      where: {
        type: filters?.type,
        status: filters?.status,
        ownerId: filters?.ownerId,
      },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelProject(projectId: string, ownerId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('Only the project owner can cancel');
    }

    if (project.status === ProjectStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed project');
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { status: ProjectStatus.CANCELLED },
    });

    await this.activityService.createActivity({
      projectId,
      userId: ownerId,
      type: ProjectActivityType.PROJECT_CANCELLED,
      message: 'Project cancelled',
    });

    return updatedProject;
  }
}
