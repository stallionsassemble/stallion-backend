import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HackathonStatus,
  MilestoneStatus,
  PayoutSourceType,
  PayoutStatus,
  Prisma,
  ProjectStatus,
  ProjectType,
  Role,
  UserStatus,
} from '@prisma/client';
import { BountiesService } from 'src/bounties/bounties.service';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { PlatformSettingsService } from 'src/common/services/platform-settings.service';
import { calculateUsdValue } from 'src/common/utils/token-price.util';
import { calculateUserTotalEarnings } from 'src/common/utils/user-earnings.util';
import { EnvConfig } from 'src/config/env.config';
import { EmailService } from 'src/email/email.service';
import { CreateHackathonDto } from 'src/hackathons/dto/create-hackathon.dto';
import { UpdateHackathonDto } from 'src/hackathons/dto/update-hackathon.dto';
import { HackathonsService } from 'src/hackathons/hackathons.service';
import { PasskeyService } from 'src/passkey/passkey.service';
import { UpdateProjectDto } from 'src/projects/dto/update-project.dto';
import { ProjectContractService } from 'src/projects/project-contract.service';
import { ProjectsService } from 'src/projects/projects.service';
import { UpdateBountyDto } from '../bounties/dto/update-bounty.dto';
import { TwoFactorVerificationService } from '../common/services/two-factor-verification.service';
import {
  AdminBountyQueryDto,
  AdminCreateUserDto,
  AdminHackathonQueryDto,
  AdminPayoutQueryDto,
  AdminProjectQueryDto,
  AdminUserQueryDto,
  BanUserDto,
  SuspendUserDto,
} from './dto/admin.dto';
import { AdminStepUpService } from './admin-step-up.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly platformSettingsService: PlatformSettingsService,
    private readonly twoFactorVerificationService: TwoFactorVerificationService,
    private readonly passkeyService: PasskeyService,
    private readonly stepUpService: AdminStepUpService,
    private readonly emailService: EmailService,
    private readonly bountiesService: BountiesService,
    private readonly projectsService: ProjectsService,
    private readonly projectContractService: ProjectContractService,
    private readonly hackathonsService: HackathonsService,
  ) {}

  async verifyTotpStepUp(userId: string, code: string) {
    await this.twoFactorVerificationService.verify2FA(userId, code);
    return this.stepUpService.issueStepUpToken(userId);
  }

  async getPasskeyStepUpOptions(userId: string) {
    return this.passkeyService.generateStepUpAuthenticationOptions(userId);
  }

  async verifyPasskeyStepUp(userId: string, response: any) {
    await this.passkeyService.verifyStepUpAuthentication(userId, response);
    return this.stepUpService.issueStepUpToken(userId);
  }

  async getFundingWallet() {
    return this.platformSettingsService.getFundingWallet();
  }

  async setFundingWallet(userId: string, fundingWalletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: fundingWalletId },
      select: { id: true },
    });

    if (!wallet) {
      throw new NotFoundException('Funding wallet not found');
    }

    await this.platformSettingsService.setFundingWalletId(
      fundingWalletId,
      userId,
    );
    return this.platformSettingsService.getFundingWallet();
  }

  async clearFundingWallet(userId: string) {
    await this.platformSettingsService.clearFundingWalletId(userId);
    return this.platformSettingsService.getFundingWallet();
  }

  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOf12MonthWindow = new Date(
      now.getFullYear(),
      now.getMonth() - 11,
      1,
    );
    const currentQuarterStart = this.getQuarterStart(now);
    const quarterWindowStart = new Date(currentQuarterStart);
    quarterWindowStart.setMonth(quarterWindowStart.getMonth() - 9);

    const [
      totalUsers,
      activeBounties,
      openProjects,
      inProgressProjects,
      payoutSum,
      usersThisMonth,
      genderCounts,
      bountyStatusCounts,
      projectStatusCounts,
      bountiesForQuarter,
      projectsForQuarter,
      payoutsForAnalytics,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.bounty.count({ where: { status: 'ACTIVE' } }),
      this.prisma.project.count({ where: { status: 'OPEN' } }),
      this.prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.payout.aggregate({
        where: { status: PayoutStatus.COMPLETED },
        _sum: { usdAmount: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { createdAt: true },
      }),
      this.prisma.user.groupBy({
        by: ['gender'],
        _count: { _all: true },
      }),
      this.prisma.bounty.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.project.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.bounty.findMany({
        where: { createdAt: { gte: quarterWindowStart } },
        select: { createdAt: true },
      }),
      this.prisma.project.findMany({
        where: { createdAt: { gte: quarterWindowStart } },
        select: { createdAt: true },
      }),
      this.prisma.payout.findMany({
        where: {
          status: PayoutStatus.COMPLETED,
          completedAt: { gte: startOf12MonthWindow },
        },
        select: {
          token: true,
          amount: true,
          usdAmount: true,
          completedAt: true,
        },
      }),
    ]);

    const userGrowthDaily: Record<string, number> = {};
    const totalDaysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateKey = new Date(now.getFullYear(), now.getMonth(), day)
        .toISOString()
        .slice(0, 10);
      userGrowthDaily[dateKey] = 0;
    }
    for (const user of usersThisMonth) {
      const dateKey = new Date(user.createdAt).toISOString().slice(0, 10);
      userGrowthDaily[dateKey] = (userGrowthDaily[dateKey] || 0) + 1;
    }

    const genderDistribution = genderCounts.reduce(
      (acc, item) => {
        acc[item.gender] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    const bountyRaw = bountyStatusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );
    const projectRaw = projectStatusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );

    const workStatusNormalized = {
      active:
        (bountyRaw.ACTIVE || 0) +
        (projectRaw.OPEN || 0) +
        (projectRaw.IN_PROGRESS || 0),
      completed: (bountyRaw.COMPLETED || 0) + (projectRaw.COMPLETED || 0),
      cancelled: (projectRaw.CANCELLED || 0) + (bountyRaw.CLOSED || 0),
      closed: projectRaw.CLOSED || 0,
    };

    const quarterKeys = this.getQuarterWindowKeys(now, 4);
    const quarterlyStats = quarterKeys.map((key) => ({
      quarter: key,
      bountiesCreated: 0,
      projectsCreated: 0,
    }));

    const quarterStatsMap = new Map(
      quarterlyStats.map((item) => [item.quarter, item]),
    );
    for (const bounty of bountiesForQuarter) {
      const key = this.getQuarterKey(bounty.createdAt);
      const stats = quarterStatsMap.get(key);
      if (stats) stats.bountiesCreated += 1;
    }
    for (const project of projectsForQuarter) {
      const key = this.getQuarterKey(project.createdAt);
      const stats = quarterStatsMap.get(key);
      if (stats) stats.projectsCreated += 1;
    }

    const payoutAnalyticsMap = new Map<
      string,
      {
        month: string;
        token: string;
        totalAmount: number;
        totalUsd: number;
        count: number;
      }
    >();

    for (const payout of payoutsForAnalytics) {
      if (!payout.completedAt) continue;
      const month = `${payout.completedAt.getFullYear()}-${String(
        payout.completedAt.getMonth() + 1,
      ).padStart(2, '0')}`;
      const key = `${month}:${payout.token}`;
      const existing = payoutAnalyticsMap.get(key) || {
        month,
        token: payout.token,
        totalAmount: 0,
        totalUsd: 0,
        count: 0,
      };
      existing.totalAmount += Number(payout.amount);
      existing.totalUsd += Number(payout.usdAmount || 0);
      existing.count += 1;
      payoutAnalyticsMap.set(key, existing);
    }

    return {
      totalUsers,
      activeWorks: activeBounties + openProjects + inProgressProjects,
      totalPayoutsUsd: Number(payoutSum._sum.usdAmount || 0),
      userGrowth: {
        currentMonthDailyRegistrations: userGrowthDaily,
        monthToDate: usersThisMonth.length,
        today: usersThisMonth.filter((u) => u.createdAt >= startOfToday).length,
        genderDistribution,
      },
      payoutAnalytics: Array.from(payoutAnalyticsMap.values()).sort((a, b) =>
        a.month === b.month
          ? a.token.localeCompare(b.token)
          : a.month.localeCompare(b.month),
      ),
      workStatus: {
        normalized: workStatusNormalized,
        raw: {
          bounties: bountyRaw,
          projects: projectRaw,
        },
      },
      jobPerformance: quarterlyStats,
    };
  }

  async getUserStats() {
    const grouped = await this.prisma.user.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const stats = grouped.reduce(
      (acc, entry) => {
        acc[entry.status] = entry._count._all;
        return acc;
      },
      {} as Record<UserStatus, number>,
    );

    return {
      totalUsers: Object.values(stats).reduce((sum, count) => sum + count, 0),
      activeUsers: stats.ACTIVE || 0,
      suspendedUsers: stats.SUSPENDED || 0,
      bannedUsers: stats.BANNED || 0,
    };
  }

  async listUsers(query: AdminUserQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (query.role) where.role = query.role;
    if (query.status) where.status = query.status;
    if (query.gender) where.gender = query.gender;
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { username: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {};
      if (query.createdFrom) where.createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) where.createdAt.lte = new Date(query.createdTo);
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reputation: {
            select: { score: true, level: true },
          },
          _count: {
            select: {
              submissions: true,
              projectApplications: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = users.map((user) => user.id);
    const ratingRows =
      userIds.length > 0
        ? await this.prisma.userReview.groupBy({
            by: ['reviewedUserId'],
            where: { reviewedUserId: { in: userIds } },
            _avg: { rating: true },
            _count: { _all: true },
          })
        : [];

    const ratingsMap = new Map(
      ratingRows.map((row) => [
        row.reviewedUserId,
        {
          averageRating: Number(row._avg.rating || 0),
          totalReviews: row._count._all,
        },
      ]),
    );

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const rating = ratingsMap.get(user.id);
        const earningsUsd = await calculateUserTotalEarnings(
          this.prisma,
          user.id,
        );

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          gender: user.gender,
          reputation: user.reputation,
          reputationRating: rating?.averageRating || 0,
          totalReviews: rating?.totalReviews || 0,
          bountiesParticipated: user._count.submissions,
          projectsParticipated: user._count.projectApplications,
          earningsUsd: Number(earningsUsd),
          lastActiveAt: user.lastActiveAt,
          createdAt: user.createdAt,
        };
      }),
    );

    return this.paginate(usersWithStats, total, page, limit);
  }

  async createUser(dto: AdminCreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('Invalid email address');
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        role: dto.role,
        emailVerified: true,
        profileCompleted: false,
        status: UserStatus.ACTIVE,
        lastActiveAt: new Date(),
      },
    });

    const frontendUrl =
      this.configService.get<string>(EnvConfig.FRONTEND_URL) ||
      'http://localhost:3000';
    const loginUrl = `${frontendUrl}/login?email=${encodeURIComponent(email)}`;
    await this.emailService.sendAdminInviteEmail(
      email,
      dto.role as 'CONTRIBUTOR' | 'PROJECT_OWNER' | 'ADMIN',
      loginUrl,
    );

    return {
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profileCompleted: user.profileCompleted,
      },
    };
  }

  async resetUser2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          totpSecret: null,
          backupCodes: [],
        },
      }),
      this.prisma.passkey.deleteMany({
        where: { userId },
      }),
    ]);

    return { message: '2FA reset successfully' };
  }

  async makeAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { role: Role.ADMIN },
    });

    return { message: 'User role updated to ADMIN' };
  }

  async suspendUser(userId: string, dto: SuspendUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let suspendedUntil: Date | null = null;
    if (!dto.indefinite) {
      if (!dto.durationHours) {
        throw new BadRequestException(
          'durationHours is required unless indefinite=true',
        );
      }
      suspendedUntil = new Date(
        Date.now() + dto.durationHours * 60 * 60 * 1000,
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        suspendedUntil,
        suspensionReason: dto.reason || null,
        refreshToken: null,
      },
    });

    return {
      message: 'User suspended successfully',
      suspendedUntil,
    };
  }

  async banUser(userId: string, dto: BanUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.BANNED,
        bannedAt: new Date(),
        banReason: dto.reason || null,
        suspendedUntil: null,
        suspensionReason: null,
        refreshToken: null,
      },
    });

    return { message: 'User banned successfully' };
  }

  async getBountyStats() {
    const [active, completed] = await Promise.all([
      this.prisma.bounty.count({ where: { status: 'ACTIVE' } }),
      this.prisma.bounty.count({ where: { status: 'COMPLETED' } }),
    ]);

    return {
      active,
      completed,
      escrowLocked: active,
    };
  }

  async listBounties(query: AdminBountyQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.BountyWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.currency) where.rewardCurrency = query.currency;
    if (typeof query.isFeatured === 'boolean')
      where.isFeatured = query.isFeatured;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [bounties, total] = await Promise.all([
      this.prisma.bounty.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: { submissions: true },
          },
        },
      }),
      this.prisma.bounty.count({ where }),
    ]);

    const data = bounties.map((bounty) => ({
      ...bounty,
      applicantCount: bounty._count.submissions,
    }));

    return this.paginate(data, total, page, limit);
  }

  async toggleBountyFeature(bountyId: string, isFeatured: boolean) {
    const bounty = await this.prisma.bounty.update({
      where: { id: bountyId },
      data: { isFeatured },
    });
    return {
      message: isFeatured
        ? 'Bounty set as featured'
        : 'Bounty removed from featured',
      bounty,
    };
  }

  async adminUpdateBounty(bountyId: string, dto: UpdateBountyDto) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
    });
    if (!bounty) throw new NotFoundException('Bounty not found');
    return this.bountiesService.updateBounty(bounty.ownerId, bountyId, dto);
  }

  async adminDeleteBounty(bountyId: string) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
    });
    if (!bounty) throw new NotFoundException('Bounty not found');
    return this.bountiesService.deleteBounty(bounty.ownerId, bountyId);
  }

  async getProjectStats() {
    const [active, completed, escrowLocked] = await Promise.all([
      this.prisma.project.count({
        where: {
          status: { in: [ProjectStatus.OPEN, ProjectStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.project.count({ where: { status: ProjectStatus.COMPLETED } }),
      this.prisma.project.count({
        where: {
          type: ProjectType.GIG,
          status: { in: [ProjectStatus.OPEN, ProjectStatus.IN_PROGRESS] },
        },
      }),
    ]);

    return { active, completed, escrowLocked };
  }

  async listProjects(query: AdminProjectQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.ownerId = query.ownerId;
    if (query.type) where.type = query.type as ProjectType;
    if (typeof query.isFeatured === 'boolean')
      where.isFeatured = query.isFeatured;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { shortDescription: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: { applications: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const data = projects.map((project) => ({
      ...project,
      applicantCount: project._count.applications,
    }));

    return this.paginate(data, total, page, limit);
  }

  async toggleProjectFeature(projectId: string, isFeatured: boolean) {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { isFeatured },
    });
    return {
      message: isFeatured
        ? 'Project set as featured'
        : 'Project removed from featured',
      project,
    };
  }

  async adminUpdateProject(projectId: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');
    return this.projectsService.updateProject(projectId, project.ownerId, dto);
  }

  async adminDeleteProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: { include: { wallet: true } },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (
      project.type === ProjectType.GIG &&
      project.contractProjectId &&
      project.owner.wallet
    ) {
      try {
        await this.projectContractService.cancelGigProject({
          projectId: project.contractProjectId,
          ownerId: project.ownerId,
          ownerPublicKey: project.owner.wallet.publicKey,
          walletId: project.owner.wallet.id,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to cancel contract project ${project.contractProjectId} before deletion: ${error.message}`,
        );
      }
    }

    await this.prisma.project.delete({
      where: { id: projectId },
    });

    return { message: 'Project deleted successfully' };
  }

  async getPayoutStats() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [pendingCount, pendingSum, completed30d, issues] = await Promise.all([
      this.prisma.payout.count({
        where: { status: PayoutStatus.PENDING_APPROVAL },
      }),
      this.prisma.payout.aggregate({
        where: { status: PayoutStatus.PENDING_APPROVAL },
        _sum: { usdAmount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          status: PayoutStatus.COMPLETED,
          completedAt: { gte: thirtyDaysAgo },
        },
        _sum: { usdAmount: true },
      }),
      this.prisma.payout.count({
        where: {
          status: { in: [PayoutStatus.FAILED, PayoutStatus.DISPUTED] },
        },
      }),
    ]);

    return {
      pendingApproval: pendingCount,
      pendingAmountUsd: Number(pendingSum._sum.usdAmount || 0),
      completed30dUsd: Number(completed30d._sum.usdAmount || 0),
      issues,
    };
  }

  async listPayouts(query: AdminPayoutQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.token) where.token = query.token;
    if (query.requestedFrom || query.requestedTo) {
      where.requestedAt = {};
      if (query.requestedFrom)
        where.requestedAt.gte = new Date(query.requestedFrom);
      if (query.requestedTo)
        where.requestedAt.lte = new Date(query.requestedTo);
    }
    if (query.search) {
      where.OR = [
        {
          contributor: {
            email: { contains: query.search, mode: 'insensitive' },
          },
        },
        {
          contributor: {
            username: { contains: query.search, mode: 'insensitive' },
          },
        },
        { bounty: { title: { contains: query.search, mode: 'insensitive' } } },
        { project: { title: { contains: query.search, mode: 'insensitive' } } },
        {
          userMilestone: {
            milestone: {
              title: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          contributor: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          bounty: {
            select: { id: true, title: true },
          },
          project: {
            select: { id: true, title: true },
          },
          userMilestone: {
            include: {
              milestone: {
                select: { id: true, title: true },
              },
            },
          },
        },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return this.paginate(payouts, total, page, limit);
  }

  async retryPayout(payoutId: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        userMilestone: {
          include: {
            contributor: {
              include: { wallet: true },
            },
            milestone: {
              include: {
                project: {
                  include: {
                    owner: {
                      include: { wallet: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!payout) {
      throw new NotFoundException('Payout not found');
    }

    if (payout.status !== PayoutStatus.FAILED) {
      throw new BadRequestException('Only failed payouts can be retried');
    }

    if (payout.sourceType !== PayoutSourceType.PROJECT_MILESTONE) {
      throw new BadRequestException(
        'Retry is currently supported for milestone payouts only',
      );
    }

    if (!payout.userMilestone) {
      throw new BadRequestException('Payout milestone reference not found');
    }

    const milestone = payout.userMilestone.milestone;
    const project = milestone.project;
    const contributorWallet = payout.userMilestone.contributor.wallet;
    const ownerWallet = project.owner.wallet;

    if (!project.contractProjectId) {
      throw new BadRequestException('Project contract reference is missing');
    }
    if (!contributorWallet || !ownerWallet) {
      throw new BadRequestException('Required wallets were not found');
    }

    try {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.PROCESSING,
          errorMessage: null,
        },
      });

      const result = await this.projectContractService.releaseMilestonePayment({
        projectId: project.contractProjectId,
        milestoneOrder: milestone.order,
        contributorPublicKey: contributorWallet.publicKey,
        amount: milestone.amount,
        ownerId: project.ownerId,
        ownerPublicKey: ownerWallet.publicKey,
        walletId: ownerWallet.id,
      });

      const usdValue = await calculateUsdValue(
        milestone.amount,
        project.currency,
      );

      await this.prisma.$transaction([
        this.prisma.userMilestone.update({
          where: { id: payout.userMilestone.id },
          data: {
            status: MilestoneStatus.APPROVED,
            txHash: result.txHash,
            paidAt: new Date(),
            usdValueAtCompletion: usdValue,
          },
        }),
        this.prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: PayoutStatus.COMPLETED,
            completedAt: new Date(),
            failedAt: null,
            txHash: result.txHash,
            errorMessage: null,
            retryCount: { increment: 1 },
            lastRetryAt: new Date(),
            usdAmount: usdValue,
          },
        }),
      ]);

      return { message: 'Payout retried successfully', txHash: result.txHash };
    } catch (error) {
      await this.prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: PayoutStatus.FAILED,
          failedAt: new Date(),
          retryCount: { increment: 1 },
          lastRetryAt: new Date(),
          errorMessage: error.message,
        },
      });

      throw new BadRequestException(`Payout retry failed: ${error.message}`);
    }
  }

  async getHackathonStats() {
    const [totalHackathons, activeHackathons, totalSubmissions, submissions] =
      await Promise.all([
        this.prisma.hackathon.count(),
        this.prisma.hackathon.count({
          where: {
            status: {
              in: [HackathonStatus.PUBLISHED, HackathonStatus.JUDGING],
            },
          },
        }),
        this.prisma.hackathonSubmission.count(),
        this.prisma.hackathonSubmission.findMany({
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

    const allHackathons = await this.prisma.hackathon.findMany({
      select: {
        totalBudget: true,
        currency: true,
      },
    });

    let totalPrizePoolUsd = 0;
    for (const hackathon of allHackathons) {
      totalPrizePoolUsd += await calculateUsdValue(
        hackathon.totalBudget.toString(),
        hackathon.currency,
      );
    }

    return {
      totalHackathons,
      activeHackathons,
      totalPrizePoolUsd,
      totalParticipants: submissions.length,
      totalSubmissions,
    };
  }

  async listHackathons(query: AdminHackathonQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.HackathonWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.ownerId) where.companyId = query.ownerId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [hackathons, total] = await Promise.all([
      this.prisma.hackathon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: { select: { submissions: true } },
        },
      }),
      this.prisma.hackathon.count({ where }),
    ]);

    const hackathonIds = hackathons.map((hackathon) => hackathon.id);
    const participantRows =
      hackathonIds.length > 0
        ? await this.prisma.hackathonSubmission.findMany({
            where: { hackathonId: { in: hackathonIds } },
            select: { hackathonId: true, userId: true },
          })
        : [];

    const participantsByHackathon = new Map<string, Set<string>>();
    for (const row of participantRows) {
      if (!participantsByHackathon.has(row.hackathonId)) {
        participantsByHackathon.set(row.hackathonId, new Set());
      }
      participantsByHackathon.get(row.hackathonId)!.add(row.userId);
    }

    const data = hackathons.map((hackathon) => ({
      id: hackathon.id,
      host: hackathon.company,
      title: hackathon.title,
      description: hackathon.description,
      status: hackathon.status,
      duration: {
        startDate: hackathon.createdAt,
        endDate: hackathon.deadline,
      },
      numParticipants: participantsByHackathon.get(hackathon.id)?.size || 0,
      prizePool: {
        amount: hackathon.totalBudget,
        currency: hackathon.currency,
      },
      totalSubmissions: hackathon._count.submissions,
      createdAt: hackathon.createdAt,
    }));

    return this.paginate(data, total, page, limit);
  }

  async createHackathon(ownerId: string, payload: Record<string, any>) {
    return this.hackathonsService.createHackathon(
      ownerId,
      payload as CreateHackathonDto,
    );
  }

  async updateHackathon(hackathonId: string, payload: Record<string, any>) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { createdById: true },
    });
    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }
    return this.hackathonsService.updateHackathon(
      hackathonId,
      hackathon.createdById,
      payload as UpdateHackathonDto,
    );
  }

  async deleteHackathon(hackathonId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { createdById: true },
    });
    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }
    return this.hackathonsService.cancelHackathon(
      hackathonId,
      hackathon.createdById,
    );
  }

  private paginate<T>(data: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  private getQuarterStart(date: Date): Date {
    const quarter = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), quarter * 3, 1);
  }

  private getQuarterKey(date: Date): string {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${date.getFullYear()}-Q${quarter}`;
  }

  private getQuarterWindowKeys(now: Date, count: number): string[] {
    const keys: string[] = [];
    const start = this.getQuarterStart(now);
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(start);
      date.setMonth(start.getMonth() - i * 3);
      keys.push(this.getQuarterKey(date));
    }
    return keys;
  }
}
