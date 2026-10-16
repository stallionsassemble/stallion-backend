import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HackathonStatus, HackathonType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  getTokenAddress,
  isCurrencySupported,
} from '../common/utils/supported-currencies';
import { validateWalletForBountyCreation } from '../bounties/utils/wallet-validator';
import { EnvConfig } from '../config/env.config';
import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { GetHackathonsQueryDto } from './dto/get-hackathons-query.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';
import {
  normalisePrizeTracks,
  normaliseTracks,
  validateApplicationForm,
} from './utils/application-form.util';
import { HackathonContractService } from './services/hackathon-contract.service';
import { HackathonSchedulingService } from './services/hackathon-scheduling.service';

@Injectable()
export class HackathonsService {
  private readonly logger = new Logger(HackathonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly contractService: HackathonContractService,
    private readonly schedulingService: HackathonSchedulingService,
  ) {}

  async createHackathon(adminId: string, dto: CreateHackathonDto) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { wallet: true },
    });

    if (!adminUser || adminUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can create hackathons');
    }

    if (!adminUser.wallet || !adminUser.wallet.publicKey) {
      throw new BadRequestException('Admin must have an active wallet');
    }

    // Verify company exists
    const companyUser = await this.prisma.user.findUnique({
      where: { id: dto.companyId },
    });

    if (!companyUser || companyUser.role !== Role.PROJECT_OWNER) {
      throw new BadRequestException(
        'Invalid company ID or user is not a project owner',
      );
    }

    // 1. Validate Hackathon Type (Enum check)
    if (!Object.values(HackathonType).includes(dto.type)) {
      throw new BadRequestException(
        `Invalid hackathon type: ${dto.type}. Expected one of: ${Object.values(HackathonType).join(', ')}`,
      );
    }

    // 2. Validate currency and get token address
    const networkPassphrase =
      this.configService.get<string>(EnvConfig.SOROBAN_NETWORK_PASSPHRASE) ||
      'Test SDF Network ; September 2015';

    if (!isCurrencySupported(dto.asset, networkPassphrase)) {
      throw new BadRequestException(`Unsupported currency: ${dto.asset}`);
    }

    const tokenAddress = getTokenAddress(dto.asset, networkPassphrase);

    // 3. Validate dates
    const now = new Date();
    const deadline = new Date(dto.deadline);
    const announcementDate = dto.announcementDate
      ? new Date(dto.announcementDate)
      : now;

    if (deadline <= now) {
      throw new BadRequestException('Deadline must be in the future');
    }

    if (dto.announcementDate && announcementDate <= now) {
      throw new BadRequestException('Announcement date must be in the future');
    }

    if (announcementDate >= deadline) {
      throw new BadRequestException(
        'Announcement date must be before deadline',
      );
    }

    const isImmediate = announcementDate <= now;

    // 4. Validate prize pool
    if (dto.totalBudget <= 0) {
      throw new BadRequestException('Total budget must be greater than 0');
    }

    const prizeSum = dto.prizePool.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(prizeSum - dto.totalBudget) > 0.0000001) {
      // Handle potential floating point issues
      throw new BadRequestException(
        `Prize pool amounts (${prizeSum}) must sum exactly to the total budget (${dto.totalBudget})`,
      );
    }

    // 5. Validate prize pool positions
    const positions = dto.prizePool.map((p) => p.position);
    const uniquePositions = new Set(positions);
    if (uniquePositions.size !== positions.length) {
      throw new BadRequestException('Duplicate prize pool positions found');
    }

    // Check slug uniqueness
    const existing = await this.prisma.hackathon.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new BadRequestException('Slug already exists');
    }

    // Fail fast with an actionable message if the admin wallet can't fund the
    // escrow, instead of a generic on-chain "transaction failed" error.
    try {
      await validateWalletForBountyCreation(
        adminUser.wallet.publicKey,
        dto.totalBudget,
        dto.asset,
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_RPC_URL),
        this.configService.getOrThrow<string>(EnvConfig.SOROBAN_HORIZON_URL),
        networkPassphrase,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        const detail = error.message;
        this.logger.warn(`Hackathon wallet pre-check failed: ${detail}`);
        throw new BadRequestException(
          `Your admin wallet cannot fund this hackathon. ${detail}`,
        );
      }
      throw error;
    }

    // Validate off-chain data BEFORE the escrow is locked, so a bad form never costs a refund.
    const applicationForm = validateApplicationForm(dto.applicationForm);
    const tracks = normaliseTracks(dto.tracks);
    const prizePool = normalisePrizeTracks(dto.prizePool, tracks);

    // Smart Contract Call
    const contractResult = await this.contractService.createHackathon({
      adminPublicKey: adminUser.wallet.publicKey,
      adminWalletId: adminUser.wallet.id,
      token: tokenAddress,
      totalBudget: dto.totalBudget.toString(),
      prizePool: dto.prizePool.map((p) => ({
        position: p.position,
        amount: p.amount.toString(),
      })),
      deadline,
    });

    // Create DB Record. The escrow is already locked on-chain at this point, so if the insert
    // fails we must refund it instead of leaving the funds orphaned in the contract.
    let hackathon: Awaited<ReturnType<typeof this.prisma.hackathon.create>>;
    try {
      hackathon = await this.prisma.hackathon.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          description: dto.description,
          type: dto.type,
          deliverables: dto.deliverables,
          tags: dto.tags,
          deadline,
          announcementDate,
          totalBudget: new Prisma.Decimal(dto.totalBudget),
          token: tokenAddress,
          asset: dto.asset,
          currency: dto.asset,
          prizePool: prizePool as any,
          documents: dto.documents || {},
          attachments: dto.attachments || {},
          teamBased: dto.teamBased,
          maxTeamSize: dto.teamBased ? dto.maxTeamSize : null,
          createdById: adminId,
          companyId: dto.companyId,
          status: isImmediate
            ? HackathonStatus.PUBLISHED
            : HackathonStatus.DRAFT,
          contractHackathonId: contractResult.contractHackathonId,
          txHash: contractResult.txHash,
          applicationForm:
            applicationForm.length > 0
              ? (applicationForm as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          requiresApproval: dto.requiresApproval ?? false,
          tracks,
        },
      });
    } catch (dbError) {
      const reason =
        dbError instanceof Error ? dbError.message : String(dbError);
      this.logger.error(
        `Hackathon DB insert failed AFTER escrow was locked on-chain (contractHackathonId=${contractResult.contractHackathonId}, txHash=${contractResult.txHash}): ${reason}`,
      );
      try {
        const refund = await this.contractService.cancelHackathon({
          adminPublicKey: adminUser.wallet.publicKey,
          adminWalletId: adminUser.wallet.id,
          contractHackathonId: contractResult.contractHackathonId,
        });
        this.logger.warn(
          `Escrow refunded for failed hackathon (contractHackathonId=${contractResult.contractHackathonId}, refund tx ${refund.txHash})`,
        );
        throw new BadRequestException(
          'The hackathon could not be saved, so your escrowed funds were refunded to your admin wallet. Please try again or contact support.',
        );
      } catch (refundError) {
        if (
          refundError instanceof BadRequestException &&
          refundError.message.includes('refunded')
        ) {
          throw refundError;
        }
        this.logger.error(
          `AUTO-REFUND FAILED for contractHackathonId=${contractResult.contractHackathonId} (txHash=${contractResult.txHash}). Cancel it manually to recover the escrow.`,
        );
        throw new BadRequestException(
          `The hackathon could not be saved and the automatic refund failed. Your escrow is on-chain as hackathon #${contractResult.contractHackathonId} (tx ${contractResult.txHash}). Contact support to recover it.`,
        );
      }
    }

    // Schedule Jobs
    if (!isImmediate) {
      this.schedulingService.scheduleAnnouncement(
        hackathon.id,
        announcementDate,
      );
    }
    this.schedulingService.scheduleDeadline(hackathon.id, deadline);

    this.logger.log(`Hackathon created: ${hackathon.id} by Admin ${adminId}`);
    return hackathon;
  }

  async updateHackathon(
    hackathonId: string,
    adminId: string,
    dto: UpdateHackathonDto,
  ) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { wallet: true },
    });

    if (!adminUser || adminUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can update hackathons');
    }

    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (
      hackathon.status === HackathonStatus.COMPLETED ||
      hackathon.status === HackathonStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot update a completed or cancelled hackathon',
      );
    }

    if (dto.type && !Object.values(HackathonType).includes(dto.type)) {
      throw new BadRequestException(
        `Invalid hackathon type: ${dto.type}. Expected one of: ${Object.values(HackathonType).join(', ')}`,
      );
    }

    let contractUpdateRequired = false;
    let newDeadline: Date | undefined = undefined;

    if (dto.deadline) {
      newDeadline = new Date(dto.deadline);
      if (newDeadline < hackathon.deadline) {
        throw new BadRequestException(
          'Deadline can only be extended, not shortened',
        );
      }
      contractUpdateRequired = true;
    }

    let contractPrizePool: any[] | undefined = undefined;
    if (dto.prizePool) {
      const prizeSum = dto.prizePool.reduce((sum, p) => sum + p.amount, 0);
      const totalBudget = dto.totalBudget || hackathon.totalBudget.toNumber();
      if (Math.abs(prizeSum - totalBudget) > 0.0000001) {
        throw new BadRequestException(
          `Prize pool amounts (${prizeSum}) must sum exactly to the total budget (${totalBudget})`,
        );
      }

      // Check for duplicate positions
      const positions = dto.prizePool.map((p) => p.position);
      if (new Set(positions).size !== positions.length) {
        throw new BadRequestException('Duplicate prize pool positions found');
      }

      contractUpdateRequired = true;
      contractPrizePool = dto.prizePool.map((p) => ({
        position: p.position,
        amount: p.amount.toString(),
      }));
    }

    // Validate off-chain data before any contract call is made.
    if (dto.applicationForm !== undefined) {
      validateApplicationForm(dto.applicationForm);
    }
    const effectiveTracks =
      dto.tracks !== undefined ? normaliseTracks(dto.tracks) : hackathon.tracks;
    // Prizes keep their tracks consistent with the hackathon's tracks, whichever of the two changes.
    const checkedPrizePool = dto.prizePool
      ? normalisePrizeTracks(dto.prizePool, effectiveTracks)
      : dto.tracks !== undefined
        ? normalisePrizeTracks(
            (hackathon.prizePool as Array<{ track?: string }>) ?? [],
            effectiveTracks,
          )
        : undefined;

    if (contractUpdateRequired && hackathon.contractHackathonId !== null) {
      await this.contractService.updateHackathon({
        adminPublicKey: adminUser.wallet!.publicKey,
        adminWalletId: adminUser.wallet!.id,
        contractHackathonId: hackathon.contractHackathonId,
        newDeadline,
        newPrizePool: contractPrizePool,
      });
    }

    const {
      deadline,
      announcementDate,
      totalBudget,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      prizePool,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      asset,
      applicationForm,
      tracks,
      ...restDto
    } = dto;

    if (dto.asset && dto.asset !== hackathon.asset) {
      throw new BadRequestException(
        'Currency cannot be changed after creation',
      );
    }

    const dataToUpdate: Prisma.HackathonUpdateInput = {
      ...restDto,
    };

    if (deadline) dataToUpdate.deadline = new Date(deadline);
    if (announcementDate)
      dataToUpdate.announcementDate = new Date(announcementDate);
    if (totalBudget !== undefined)
      dataToUpdate.totalBudget = new Prisma.Decimal(totalBudget);

    if (applicationForm !== undefined) {
      const validated = validateApplicationForm(applicationForm);
      dataToUpdate.applicationForm =
        validated.length > 0
          ? (validated as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull;
    }
    if (tracks !== undefined) dataToUpdate.tracks = normaliseTracks(tracks);

    if (checkedPrizePool)
      dataToUpdate.prizePool =
        checkedPrizePool as unknown as Prisma.InputJsonValue;

    const updated = await this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: dataToUpdate,
    });

    // Reschedule jobs if dates changed
    if (dataToUpdate.announcementDate) {
      this.schedulingService.scheduleAnnouncement(
        hackathonId,
        dataToUpdate.announcementDate as Date,
      );
    }
    if (dataToUpdate.deadline) {
      this.schedulingService.scheduleDeadline(
        hackathonId,
        dataToUpdate.deadline as Date,
      );
    }

    this.logger.log(`Hackathon updated: ${hackathonId} by Admin ${adminId}`);
    return updated;
  }

  async cancelHackathon(hackathonId: string, adminId: string) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { wallet: true },
    });

    if (!adminUser || adminUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can cancel hackathons');
    }

    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (
      hackathon.status === HackathonStatus.COMPLETED ||
      hackathon.status === HackathonStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'Cannot cancel a completed or already cancelled hackathon',
      );
    }

    if (hackathon.contractHackathonId !== null) {
      await this.contractService.cancelHackathon({
        adminPublicKey: adminUser.wallet!.publicKey,
        adminWalletId: adminUser.wallet!.id,
        contractHackathonId: hackathon.contractHackathonId,
      });
    }

    this.schedulingService.cancelSchedules(hackathonId);

    this.logger.log(`Hackathon cancelled: ${hackathonId} by Admin ${adminId}`);
    return this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: { status: HackathonStatus.CANCELLED },
    });
  }

  /**
   * Recover escrow for a hackathon that exists on-chain but has no database record
   * (for example when the DB insert failed after the contract call). Only the on-chain owner
   * (the admin wallet that created it) can cancel, so this cannot touch anyone else's funds.
   */
  async recoverOrphanedEscrow(contractHackathonId: string, adminId: string) {
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { wallet: true },
    });
    if (!adminUser || adminUser.role !== Role.ADMIN || !adminUser.wallet) {
      throw new ForbiddenException('Only admins can recover hackathon escrow');
    }

    let onChainId: bigint;
    try {
      onChainId = BigInt(contractHackathonId);
    } catch {
      throw new BadRequestException('contractHackathonId must be a number');
    }

    const existing = await this.prisma.hackathon.findUnique({
      where: { contractHackathonId: onChainId },
      select: { id: true, title: true },
    });
    if (existing) {
      throw new BadRequestException(
        `This hackathon is saved as "${existing.title}". Cancel it from the Hackathons list instead.`,
      );
    }

    const refund = await this.contractService.cancelHackathon({
      adminPublicKey: adminUser.wallet.publicKey,
      adminWalletId: adminUser.wallet.id,
      contractHackathonId: onChainId,
    });
    this.logger.warn(
      `Recovered orphaned escrow for contractHackathonId=${contractHackathonId} by admin ${adminId}: refunded ${refund.refundedAmount} (tx ${refund.txHash})`,
    );
    return refund;
  }

  async getHackathons(query: GetHackathonsQueryDto) {
    const where: Prisma.HackathonWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.tag) {
      where.tags = { has: query.tag };
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.hackathon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: {
            select: { id: true, companyName: true, companyLogo: true },
          },
          _count: {
            select: { submissions: true, participants: true },
          },
        },
      }),
      this.prisma.hackathon.count({ where }),
    ]);

    this.logger.debug(`Fetched ${data.length} hackathons (total: ${total})`);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getHackathonByIdentifier(identifier: string) {
    const hackathon = await this.prisma.hackathon.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        company: {
          select: {
            id: true,
            companyName: true,
            companyLogo: true,
            companyBio: true,
          },
        },
        _count: {
          select: { submissions: true, participants: true, teams: true },
        },
      },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    return hackathon;
  }
}
