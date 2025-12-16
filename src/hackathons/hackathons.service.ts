import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  HackathonStatus,
  HackathonSubmissionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateHackathonDto } from './dto/create-hackathon.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { JudgeSubmissionDto } from './dto/judge-submission.dto';
import { SelectWinnersDto } from './dto/select-winners.dto';
import { UpdateHackathonDto } from './dto/update-hackathon.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

@Injectable()
export class HackathonsService {
  private readonly logger = new Logger(HackathonsService.name);

  constructor(private prisma: PrismaService) {}

  async createHackathon(ownerId: string, dto: CreateHackathonDto) {
    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException('End date must be after start date');
    }

    if (startDate < new Date()) {
      throw new BadRequestException('Start date cannot be in the past');
    }

    // Validate tracks
    const mainTracks = dto.tracks.filter((t) => t.isMainTrack);
    if (mainTracks.length !== 1) {
      throw new BadRequestException(
        'Hackathon must have exactly one main track',
      );
    }

    // Calculate total reward
    const totalReward = dto.tracks.reduce(
      (sum, track) => sum + track.prizePool,
      0,
    );

    // Validate reward distributions
    for (const track of dto.tracks) {
      const distributionSum = track.rewardDistribution.reduce(
        (sum, pct) => sum + pct,
        0,
      );
      if (Math.abs(distributionSum - 100) > 0.01) {
        throw new BadRequestException(
          `Track "${track.name}" reward distribution must sum to 100%`,
        );
      }
    }

    // Check slug uniqueness
    const existing = await this.prisma.hackathon.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Slug already exists');
    }

    // Create hackathon with tracks
    const hackathon = await this.prisma.hackathon.create({
      data: {
        title: dto.title,
        slug: dto.slug,
        description: dto.description,
        startDate,
        endDate,
        totalReward: new Prisma.Decimal(totalReward),
        currency: dto.currency || 'XLM',
        allowMultipleTrackSubmissions:
          dto.allowMultipleTrackSubmissions ?? false,
        maxSubmissionsPerUser: dto.maxSubmissionsPerUser || 1,
        coverImage: dto.coverImage,
        rules: dto.rules,
        prizes: dto.prizes,
        ownerId,
        tracks: {
          create: dto.tracks.map((track) => ({
            name: track.name,
            description: track.description,
            prizePool: new Prisma.Decimal(track.prizePool),
            rewardDistribution: track.rewardDistribution as any,
            submissionFields: (track.submissionFields || []) as any,
            maxSubmissions: track.maxSubmissions,
            isMainTrack: track.isMainTrack ?? false,
          })),
        },
      },
      include: {
        tracks: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Hackathon created: ${hackathon.id} by ${ownerId}`);
    return hackathon;
  }

  async updateHackathon(
    hackathonId: string,
    ownerId: string,
    dto: UpdateHackathonDto,
  ) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.ownerId !== ownerId) {
      throw new ForbiddenException('Only the owner can update this hackathon');
    }

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate
        ? new Date(dto.startDate)
        : hackathon.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : hackathon.endDate;

      if (startDate >= endDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    // Don't allow status changes to ONGOING or COMPLETED manually
    if (dto.status === HackathonStatus.ONGOING) {
      throw new BadRequestException(
        'Hackathon status will automatically change to ONGOING at start time',
      );
    }

    if (dto.status === HackathonStatus.COMPLETED) {
      throw new BadRequestException(
        'Use the complete hackathon endpoint to finalize',
      );
    }

    return this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        tracks: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async publishHackathon(hackathonId: string, ownerId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      include: { tracks: true },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.ownerId !== ownerId) {
      throw new ForbiddenException('Only the owner can publish this hackathon');
    }

    if (hackathon.status !== HackathonStatus.DRAFT) {
      throw new BadRequestException('Only draft hackathons can be published');
    }

    if (hackathon.tracks.length === 0) {
      throw new BadRequestException('Hackathon must have at least one track');
    }

    return this.prisma.hackathon.update({
      where: { id: hackathonId },
      data: { status: HackathonStatus.PUBLISHED },
      include: { tracks: true },
    });
  }

  async getHackathons(filters?: {
    status?: HackathonStatus;
    ownerId?: string;
  }) {
    return this.prisma.hackathon.findMany({
      where: {
        status: filters?.status,
        ownerId: filters?.ownerId,
      },
      include: {
        tracks: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getHackathon(identifier: string) {
    const hackathon = await this.prisma.hackathon.findFirst({
      where: {
        OR: [{ id: identifier }, { slug: identifier }],
      },
      include: {
        tracks: {
          include: {
            _count: {
              select: {
                submissions: true,
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    return hackathon;
  }

  async deleteHackathon(hackathonId: string, ownerId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      include: { submissions: true },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.ownerId !== ownerId) {
      throw new ForbiddenException('Only the owner can delete this hackathon');
    }

    if (hackathon.submissions.length > 0) {
      throw new BadRequestException(
        'Cannot delete hackathon with existing submissions',
      );
    }

    await this.prisma.hackathon.delete({
      where: { id: hackathonId },
    });

    return { message: 'Hackathon deleted successfully' };
  }

  async createSubmission(userId: string, dto: CreateSubmissionDto) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: dto.hackathonId },
      include: { tracks: true },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    // Check hackathon status
    if (
      hackathon.status !== HackathonStatus.PUBLISHED &&
      hackathon.status !== HackathonStatus.ONGOING
    ) {
      throw new BadRequestException('Hackathon is not accepting submissions');
    }

    // Check if hackathon has started and not ended
    const now = new Date();
    if (now < hackathon.startDate) {
      throw new BadRequestException('Hackathon has not started yet');
    }

    if (now > hackathon.endDate) {
      throw new BadRequestException('Hackathon has ended');
    }

    // Validate track exists
    const track = hackathon.tracks.find((t) => t.id === dto.trackId);
    if (!track) {
      throw new NotFoundException('Track not found');
    }

    // Check if user already submitted to this track
    const existingSubmission = await this.prisma.hackathonSubmission.findUnique(
      {
        where: {
          userId_hackathonId_trackId: {
            userId,
            hackathonId: dto.hackathonId,
            trackId: dto.trackId,
          },
        },
      },
    );

    if (existingSubmission) {
      throw new BadRequestException('You have already submitted to this track');
    }

    // Check multiple track submission policy
    if (!hackathon.allowMultipleTrackSubmissions) {
      const userSubmissions = await this.prisma.hackathonSubmission.findMany({
        where: {
          userId,
          hackathonId: dto.hackathonId,
        },
      });

      if (userSubmissions.length > 0) {
        throw new BadRequestException(
          'This hackathon does not allow multiple track submissions',
        );
      }
    }

    // Check max submissions per user
    const userSubmissionCount = await this.prisma.hackathonSubmission.count({
      where: {
        userId,
        hackathonId: dto.hackathonId,
      },
    });

    if (userSubmissionCount >= hackathon.maxSubmissionsPerUser) {
      throw new BadRequestException(
        `Maximum ${hackathon.maxSubmissionsPerUser} submission(s) allowed per user`,
      );
    }

    // Validate submission data against track fields
    this.validateSubmissionData(dto.submissionData, track.submissionFields);

    // Create submission
    const submission = await this.prisma.hackathonSubmission.create({
      data: {
        userId,
        hackathonId: dto.hackathonId,
        trackId: dto.trackId,
        submissionData: dto.submissionData,
        projectName: dto.projectName,
        projectUrl: dto.projectUrl,
        repositoryUrl: dto.repositoryUrl,
        videoUrl: dto.videoUrl,
        description: dto.description,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        track: true,
      },
    });

    this.logger.log(
      `Submission created: ${submission.id} by ${userId} for hackathon ${dto.hackathonId}`,
    );

    return submission;
  }

  async updateSubmission(
    submissionId: string,
    userId: string,
    dto: UpdateSubmissionDto,
  ) {
    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
      include: { hackathon: true, track: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.userId !== userId) {
      throw new ForbiddenException('You can only update your own submissions');
    }

    // Check if hackathon is still accepting updates
    const now = new Date();
    if (now > submission.hackathon.endDate) {
      throw new BadRequestException(
        'Cannot update submission after hackathon has ended',
      );
    }

    // Validate submission data if provided
    if (dto.submissionData) {
      this.validateSubmissionData(
        dto.submissionData,
        submission.track.submissionFields,
      );
    }

    return this.prisma.hackathonSubmission.update({
      where: { id: submissionId },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        track: true,
      },
    });
  }

  async deleteSubmission(submissionId: string, userId: string) {
    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
      include: { hackathon: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.userId !== userId) {
      throw new ForbiddenException('You can only delete your own submissions');
    }

    // Check if hackathon is still accepting deletions
    const now = new Date();
    if (now > submission.hackathon.endDate) {
      throw new BadRequestException(
        'Cannot delete submission after hackathon has ended',
      );
    }

    await this.prisma.hackathonSubmission.delete({
      where: { id: submissionId },
    });

    return { message: 'Submission deleted successfully' };
  }

  async getSubmissions(hackathonId: string, trackId?: string) {
    return this.prisma.hackathonSubmission.findMany({
      where: {
        hackathonId,
        trackId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        track: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getUserSubmissions(userId: string, hackathonId?: string) {
    return this.prisma.hackathonSubmission.findMany({
      where: {
        userId,
        hackathonId,
      },
      include: {
        hackathon: true,
        track: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async judgeSubmission(
    submissionId: string,
    ownerId: string,
    dto: JudgeSubmissionDto,
  ) {
    const submission = await this.prisma.hackathonSubmission.findUnique({
      where: { id: submissionId },
      include: { hackathon: true },
    });

    if (!submission) {
      throw new NotFoundException('Submission not found');
    }

    if (submission.hackathon.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the hackathon owner can judge submissions',
      );
    }

    return this.prisma.hackathonSubmission.update({
      where: { id: submissionId },
      data: {
        score: new Prisma.Decimal(dto.score),
        feedback: dto.feedback,
        status: HackathonSubmissionStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        track: true,
      },
    });
  }

  async selectWinners(
    hackathonId: string,
    ownerId: string,
    dto: SelectWinnersDto,
  ) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      include: { tracks: true },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (hackathon.ownerId !== ownerId) {
      throw new ForbiddenException(
        'Only the hackathon owner can select winners',
      );
    }

    // Validate track
    const track = hackathon.tracks.find((t) => t.id === dto.trackId);
    if (!track) {
      throw new NotFoundException('Track not found');
    }

    // Validate number of winners matches reward distribution
    const rewardDistribution = track.rewardDistribution as number[];
    if (dto.winners.length !== rewardDistribution.length) {
      throw new BadRequestException(
        `Expected ${rewardDistribution.length} winner(s) based on reward distribution`,
      );
    }

    // Validate all submissions exist and belong to the track
    for (const winner of dto.winners) {
      const submission = await this.prisma.hackathonSubmission.findUnique({
        where: { id: winner.submissionId },
      });

      if (!submission) {
        throw new NotFoundException(
          `Submission ${winner.submissionId} not found`,
        );
      }

      if (submission.trackId !== dto.trackId) {
        throw new BadRequestException(
          `Submission ${winner.submissionId} does not belong to this track`,
        );
      }

      if (submission.userId !== winner.userId) {
        throw new BadRequestException(
          `Submission ${winner.submissionId} does not belong to user ${winner.userId}`,
        );
      }
    }

    // Calculate prize amounts
    const prizePool = Number(track.prizePool);
    const winners: any[] = [];

    for (let i = 0; i < dto.winners.length; i++) {
      const winnerData = dto.winners[i];
      const percentage = rewardDistribution[i];
      const prizeAmount = (prizePool * percentage) / 100;

      const winner = await this.prisma.hackathonWinner.create({
        data: {
          userId: winnerData.userId,
          hackathonId,
          trackId: dto.trackId,
          submissionId: winnerData.submissionId,
          position: i + 1,
          prizeAmount: new Prisma.Decimal(prizeAmount),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          submission: true,
        },
      });

      winners.push(winner);
    }

    this.logger.log(
      `Winners selected for hackathon ${hackathonId}, track ${dto.trackId}`,
    );

    return winners;
  }

  async getWinners(hackathonId: string, trackId?: string) {
    return this.prisma.hackathonWinner.findMany({
      where: {
        hackathonId,
        trackId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        track: true,
        submission: true,
      },
      orderBy: [{ trackId: 'asc' }, { position: 'asc' }],
    });
  }

  private validateSubmissionData(
    submissionData: Record<string, any>,
    fieldDefinitions: any,
  ) {
    const fields = fieldDefinitions as Array<{
      name: string;
      type: string;
      required?: boolean;
    }>;

    for (const field of fields) {
      if (field.required && !submissionData[field.name]) {
        throw new BadRequestException(
          `Required field "${field.name}" is missing`,
        );
      }

      // Basic type validation
      if (submissionData[field.name]) {
        const value = submissionData[field.name];

        switch (field.type) {
          case 'url':
            if (typeof value !== 'string' || !this.isValidUrl(value)) {
              throw new BadRequestException(
                `Field "${field.name}" must be a valid URL`,
              );
            }
            break;
          case 'number':
            if (typeof value !== 'number') {
              throw new BadRequestException(
                `Field "${field.name}" must be a number`,
              );
            }
            break;
          // Add more type validations as needed
        }
      }
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
