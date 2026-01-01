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
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectActivityService } from './project-activity.service';
import { ProjectContractService } from './project-contract.service';
import { InputJsonValue } from '@prisma/client/runtime/client';

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
        attachments: dto.attachments as unknown as InputJsonValue,
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

  async updateProject(
    projectId: string,
    ownerId: string,
    dto: UpdateProjectDto,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { milestones: true, owner: { include: { wallet: true } } },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('Only the project owner can update');
    }

    if (project.status !== ProjectStatus.OPEN) {
      throw new BadRequestException(
        'Only OPEN projects can be updated. Cannot update projects that are in progress, completed, or cancelled.',
      );
    }

    if (!project.owner.wallet) {
      throw new NotFoundException('Owner wallet not found');
    }

    // Validate deadline if provided
    if (dto.deadline) {
      const newDeadline = new Date(dto.deadline);
      const currentDeadline = new Date(project.deadline);
      const now = new Date();

      if (newDeadline <= now) {
        throw new BadRequestException('Deadline must be in the future');
      }

      if (newDeadline < currentDeadline) {
        throw new BadRequestException(
          'New deadline cannot be before the current deadline',
        );
      }
    }

    // Validate milestones for GIG projects
    if (dto.milestones && project.type === ProjectType.GIG) {
      const rewardAmount = BigInt(project.reward);
      const totalMilestoneAmount = dto.milestones.reduce(
        (sum, m) => sum + BigInt(m.amount || '0'),
        BigInt(0),
      );

      if (
        totalMilestoneAmount > BigInt(0) &&
        totalMilestoneAmount !== rewardAmount
      ) {
        throw new BadRequestException(
          'Sum of milestone amounts must equal total reward',
        );
      }
    }

    // Check if contract-related fields are being updated
    const needsContractUpdate =
      dto.deadline !== undefined || dto.milestones !== undefined;

    // Update smart contract if needed
    if (needsContractUpdate && project.contractProjectId) {
      if (project.type === ProjectType.GIG) {
        const contractParams: any = {
          projectId: project.contractProjectId,
          ownerId,
          ownerPublicKey: project.owner.wallet.publicKey,
          walletId: project.owner.wallet.id,
        };

        if (dto.deadline) {
          contractParams.deadline = new Date(dto.deadline);
        }

        if (dto.milestones) {
          contractParams.milestones = dto.milestones.map((m, index) => ({
            amount: m.amount || '0',
            order: index + 1,
          }));
        }

        await this.contractService.updateGigProject(contractParams);
      } else if (project.type === ProjectType.JOB) {
        const contractParams: any = {
          projectId: project.contractProjectId,
          ownerId,
          ownerPublicKey: project.owner.wallet.publicKey,
          walletId: project.owner.wallet.id,
        };

        if (dto.deadline) {
          contractParams.deadline = new Date(dto.deadline);
        }

        await this.contractService.updateJobProject(contractParams);
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.shortDescription !== undefined)
      updateData.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.requirements !== undefined)
      updateData.requirements = dto.requirements;
    if (dto.deliverables !== undefined)
      updateData.deliverables = dto.deliverables;
    if (dto.skills !== undefined) updateData.skills = dto.skills;
    if (dto.attachments !== undefined) updateData.attachments = dto.attachments;
    if (dto.deadline !== undefined)
      updateData.deadline = new Date(dto.deadline);
    if (dto.peopleNeeded !== undefined)
      updateData.peopleNeeded = dto.peopleNeeded;

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
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
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    });

    await this.activityService.createActivity({
      projectId,
      userId: ownerId,
      type: ProjectActivityType.PROJECT_UPDATED,
      message: 'Project details updated',
    });

    return updatedProject;
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
