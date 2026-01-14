import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus, ProjectType, Role } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/client';
import { ActivitiesService } from '../activities/activities.service';
import { ProjectActivities } from '../activities/helpers/activity-helper';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProjectNotifications } from '../notifications/helpers/notification-helper';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectContractService } from './project-contract.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private prisma: PrismaService,
    private contractService: ProjectContractService,
    private activitiesService: ActivitiesService,
    private notificationsService: NotificationsService,
  ) {}

  async getProject(projectId: string, currentUserId?: string) {
    try {
      // Fetch database project details first
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
              bio: true,
              createdAt: true,
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
              userMilestones: {
                include: {
                  milestone: true,
                },
                orderBy: {
                  milestone: {
                    order: 'asc',
                  },
                },
              },
            },
          },
          milestones: {
            orderBy: { order: 'asc' },
          },
        },
      });

      if (!project || project.contractProjectId === null) {
        throw new NotFoundException('Project not found');
      }

      // Verify project exists in contract
      const contractProjectId = project.contractProjectId;

      // Make sure contractProjectId is valid u32
      if (contractProjectId < 0 || contractProjectId > 4294967295) {
        throw new NotFoundException('Project not found');
      }

      const assembled = await this.contractService.sorobanClient.get_project({
        project_id: contractProjectId,
      });
      const simulated = await assembled.simulate();

      if (!simulated.result.isOk()) {
        throw new NotFoundException('Project not found in contract');
      }

      // Contract verification passed, continue with existing logic

      // Check if current user has applied
      let applied = false;
      if (currentUserId) {
        const application = await this.prisma.projectApplication.findFirst({
          where: {
            projectId,
            userId: currentUserId,
          },
        });
        applied = !!application;
      }

      // Get winner information (accepted application)
      const acceptedApplication = project.applications.find(
        (app) => app.status === 'ACCEPTED',
      );

      // Calculate owner stats
      const [totalPaidResult, totalBounties, totalProjects] = await Promise.all(
        [
          this.prisma.transaction.aggregate({
            where: {
              walletId: project.owner.id,
              type: 'WITHDRAWAL',
              state: 'COMPLETED',
            },
            _sum: {
              amount: true,
            },
          }),
          this.prisma.bounty.count({
            where: { ownerId: project.ownerId },
          }),
          this.prisma.project.count({
            where: { ownerId: project.ownerId },
          }),
        ],
      );

      const totalPaid = totalPaidResult._sum.amount?.toString() || '0';

      // Calculate released and escrowed amounts from user milestones
      const acceptedApp = project.applications.find(
        (app) => app.status === 'ACCEPTED',
      );

      let released = '0';
      let escrowed = '0';

      if (acceptedApp && acceptedApp.userMilestones.length > 0) {
        released = acceptedApp.userMilestones
          .filter((um) => um.status === 'PAID')
          .reduce((sum, um) => sum + Number(um.milestone.amount), 0)
          .toString();

        escrowed = acceptedApp.userMilestones
          .filter((um) => um.status !== 'PAID')
          .reduce((sum, um) => sum + Number(um.milestone.amount), 0)
          .toString();
      }

      // Combine milestone templates with user milestone data for accepted application
      const milestonesWithStatus =
        acceptedApp && acceptedApplication
          ? project.milestones.map((milestone) => {
              const userMilestone = acceptedApp.userMilestones.find(
                (um) => um.milestone.id === milestone.id,
              );
              return {
                id: userMilestone?.id || milestone.id,
                userMilestoneId: userMilestone?.id,
                title: milestone.title,
                description: milestone.description,
                amount: milestone.amount,
                dueDate: milestone.dueDate,
                order: milestone.order,
                status: userMilestone?.status || 'PENDING',
                submissionDescription: userMilestone?.description,
                submissionLinks: userMilestone?.links,
                submissionAttachments: userMilestone?.attachments,
                submittedAt: userMilestone?.submittedAt,
                reviewNote: userMilestone?.reviewNote,
                reviewedAt: userMilestone?.reviewedAt,
                revisionNote: userMilestone?.revisionNote,
                txHash: userMilestone?.txHash,
                paidAt: userMilestone?.paidAt,
                contributorId: userMilestone?.contributorId,
                contributor: acceptedApplication.user,
              };
            })
          : project.milestones.map((milestone) => ({
              id: milestone.id,
              title: milestone.title,
              description: milestone.description,
              amount: milestone.amount,
              dueDate: milestone.dueDate,
              order: milestone.order,
            }));

      // Calculate project progress based on paid milestones
      let projectProgress = 0;
      if (project.milestones.length > 0 && acceptedApp) {
        const paidMilestones = acceptedApp.userMilestones.filter(
          (um) => um.status === 'PAID',
        ).length;
        projectProgress = (paidMilestones / project.milestones.length) * 100;
      }

      return {
        ...project,
        applied,
        released,
        escrowed,
        milestones: milestonesWithStatus,
        projectProgress,
        winner: acceptedApplication
          ? {
              userId: acceptedApplication.user.id,
              username: acceptedApplication.user.username,
              firstName: acceptedApplication.user.firstName,
              lastName: acceptedApplication.user.lastName,
              profilePicture: acceptedApplication.user.profilePicture,
              acceptedAt: acceptedApplication.updatedAt,
            }
          : null,
        owner: {
          ...project.owner,
          totalPaid,
          totalBounties,
          totalProjects,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get project', error);
      throw error;
    }
  }

  async listProjects(
    filters?: {
      type?: ProjectType;
      status?: ProjectStatus;
      ownerId?: string;
    },
    currentUserId?: string,
  ) {
    try {
      // Fetch contract project IDs based on filters
      let contractProjectIds: number[] = [];

      if (filters?.ownerId) {
        // Get projects for specific owner from contract
        const owner = await this.prisma.user.findUnique({
          where: { id: filters.ownerId },
          include: { wallet: true },
        });

        if (!owner || !owner.wallet) {
          return [];
        }

        contractProjectIds = await this.contractService.getOwnerProjects(
          owner.wallet.publicKey,
        );
      } else if (filters?.status) {
        // Get projects by status from contract
        contractProjectIds = await this.contractService.getProjectsByStatus(
          filters.status,
        );
      } else {
        // Get all projects from contract
        contractProjectIds = await this.contractService.getProjects();
      }

      // Fetch projects from database based on contract IDs
      const projects = await this.prisma.project.findMany({
        where: {
          contractProjectId: {
            in: contractProjectIds,
          },
          type: filters?.type,
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
              bio: true,
              createdAt: true,
            },
          },
          applications: {
            select: {
              userId: true,
              status: true,
              userMilestones: {
                select: {
                  status: true,
                },
              },
            },
          },
          milestones: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get owner stats for all unique owners
      const ownerIds = [...new Set(projects.map((p) => p.ownerId))];
      const ownerStatsMap = new Map<
        string,
        { totalPaid: string; totalBounties: number; totalProjects: number }
      >();

      await Promise.all(
        ownerIds.map(async (ownerId) => {
          const [totalPaidResult, totalBounties, totalProjects] =
            await Promise.all([
              this.prisma.transaction.aggregate({
                where: {
                  walletId: ownerId,
                  type: 'WITHDRAWAL',
                  state: 'COMPLETED',
                },
                _sum: {
                  amount: true,
                },
              }),
              this.prisma.bounty.count({
                where: { ownerId },
              }),
              this.prisma.project.count({
                where: { ownerId },
              }),
            ]);

          ownerStatsMap.set(ownerId, {
            totalPaid: totalPaidResult._sum.amount?.toString() || '0',
            totalBounties,
            totalProjects,
          });
        }),
      );

      // Map projects with applied field, owner stats, and progress
      return projects.map((project) => {
        const applied = currentUserId
          ? project.applications.some((app) => app.userId === currentUserId)
          : false;

        const ownerStats = ownerStatsMap.get(project.ownerId) || {
          totalPaid: '0',
          totalBounties: 0,
          totalProjects: 0,
        };

        // Calculate project progress
        let projectProgress = 0;
        const acceptedApp = project.applications.find(
          (app) => app.status === 'ACCEPTED',
        );
        if (project.milestones.length > 0 && acceptedApp) {
          const paidMilestones = acceptedApp.userMilestones.filter(
            (um) => um.status === 'PAID',
          ).length;
          projectProgress = (paidMilestones / project.milestones.length) * 100;
        }

        return {
          ...project,
          applied,
          projectProgress,
          owner: {
            ...project.owner,
            ...ownerStats,
          },
          applications: undefined, // Remove applications from response
          milestones: undefined, // Remove milestones from list response
        };
      });
    } catch (error) {
      this.logger.error('Failed to list projects', error);
      throw error;
    }
  }

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

      // Validate milestone due dates are in chronological order
      for (let i = 1; i < dto.milestones.length; i++) {
        const previousDueDate = new Date(dto.milestones[i - 1].dueDate);
        const currentDueDate = new Date(dto.milestones[i].dueDate);

        if (currentDueDate <= previousDueDate) {
          throw new BadRequestException(
            `Milestone ${i + 1} due date must be after milestone ${i} due date. Milestones must be in chronological order.`,
          );
        }
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
        // Create milestone templates for GIG projects
        ...(dto.type === ProjectType.GIG && dto.milestones
          ? {
              milestones: {
                createMany: {
                  data: dto.milestones.map((m, index) => ({
                    title: m.title,
                    description: m.description,
                    amount: m.amount,
                    dueDate: new Date(m.dueDate),
                    order: index + 1,
                  })),
                },
              },
            }
          : {}),
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
            bio: true,
            createdAt: true,
          },
        },
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    });

    await this.activitiesService.recordActivity(
      ProjectActivities.created(
        ownerId,
        project.id,
        project.title,
        project.reward,
        project.currency,
      ),
    );

    try {
      await this.notificationsService.sendNotification(
        ProjectNotifications.projectCreated(ownerId, project.title),
      );
    } catch (error) {
      this.logger.error(
        `Failed to send project creation notification: ${error.message}`,
      );
    }

    return project;
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
      // Validate milestone due dates are in chronological order
      for (let i = 1; i < dto.milestones.length; i++) {
        const previousDueDate = dto.milestones[i - 1].dueDate
          ? new Date(dto.milestones[i - 1].dueDate!)
          : project.milestones[i - 1]?.dueDate;
        const currentDueDate = dto.milestones[i].dueDate
          ? new Date(dto.milestones[i].dueDate!)
          : project.milestones[i]?.dueDate;

        if (
          previousDueDate &&
          currentDueDate &&
          currentDueDate <= previousDueDate
        ) {
          throw new BadRequestException(
            `Milestone ${i + 1} due date must be after milestone ${i} due date. Milestones must be in chronological order.`,
          );
        }
      }

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
        const contractParams: Parameters<
          typeof this.contractService.updateGigProject
        >[0] = {
          projectId: project.contractProjectId,
          ownerId,
          ownerPublicKey: project.owner.wallet.publicKey,
          walletId: project.owner.wallet.id,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
          milestones: dto.milestones
            ? dto.milestones.map((m, index) => ({
                amount: m.amount || '0',
                order: index + 1,
              }))
            : undefined,
        };

        await this.contractService.updateGigProject(contractParams);
      } else if (project.type === ProjectType.JOB) {
        const contractParams: Parameters<
          typeof this.contractService.updateJobProject
        >[0] = {
          projectId: project.contractProjectId,
          ownerId,
          ownerPublicKey: project.owner.wallet.publicKey,
          walletId: project.owner.wallet.id,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
        };

        await this.contractService.updateJobProject(contractParams);
      }
    }

    // Prepare update data
    const updateData: Prisma.ProjectUpdateInput = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.shortDescription !== undefined)
      updateData.shortDescription = dto.shortDescription;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.requirements !== undefined)
      updateData.requirements = dto.requirements;
    if (dto.deliverables !== undefined)
      updateData.deliverables = dto.deliverables;
    if (dto.skills !== undefined) updateData.skills = dto.skills;
    if (dto.attachments !== undefined)
      updateData.attachments = dto.attachments as unknown as InputJsonValue;
    if (dto.deadline !== undefined)
      updateData.deadline = new Date(dto.deadline);
    if (dto.peopleNeeded !== undefined)
      updateData.peopleNeeded = dto.peopleNeeded;

    // Update milestones if provided
    if (dto.milestones && project.milestones.length > 0) {
      // Update existing milestones
      const milestoneUpdates = dto.milestones.map((milestone, index) => {
        const existingMilestone = project.milestones[index];
        if (!existingMilestone) {
          throw new BadRequestException(
            `Cannot update milestone at index ${index}: milestone does not exist`,
          );
        }

        const milestoneUpdateData: Prisma.ProjectMilestoneUpdateInput = {};
        if (milestone.title !== undefined)
          milestoneUpdateData.title = milestone.title;
        if (milestone.description !== undefined)
          milestoneUpdateData.description = milestone.description;
        if (milestone.amount !== undefined)
          milestoneUpdateData.amount = milestone.amount;
        if (milestone.dueDate !== undefined)
          milestoneUpdateData.dueDate = new Date(milestone.dueDate);

        return this.prisma.projectMilestone.update({
          where: { id: existingMilestone.id },
          data: milestoneUpdateData,
        });
      });

      await Promise.all(milestoneUpdates);
    }

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

    await this.activitiesService.recordActivity(
      ProjectActivities.updated(ownerId, projectId, updatedProject.title),
    );

    try {
      await this.notificationsService.sendNotification(
        ProjectNotifications.projectUpdated(ownerId, updatedProject.title),
      );
    } catch (error) {
      this.logger.error(
        `Failed to send project update notification: ${error.message}`,
      );
    }

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

    await this.activitiesService.recordActivity(
      ProjectActivities.cancelled(ownerId, projectId, project.title),
    );

    try {
      await this.notificationsService.sendNotification(
        ProjectNotifications.projectCancelled(ownerId, project.title),
      );
    } catch (error) {
      this.logger.error(
        `Failed to send project cancellation notification: ${error.message}`,
      );
    }

    return updatedProject;
  }
}
