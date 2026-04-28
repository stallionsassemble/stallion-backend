import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HackathonStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { GetSubmissionsQueryDto } from '../dto/get-submissions-query.dto';

@Injectable()
export class HackathonSubmissionsService {
  private readonly logger = new Logger(HackathonSubmissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSubmission(userId: string, dto: CreateSubmissionDto) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: dto.hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (
      hackathon.status !== HackathonStatus.PUBLISHED &&
      hackathon.status !== HackathonStatus.JUDGING
    ) {
      throw new BadRequestException('Hackathon is not active');
    }

    if (new Date() > hackathon.deadline) {
      throw new BadRequestException('Hackathon deadline has passed');
    }

    // Check if user is a participant
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: {
        userId_hackathonId: {
          userId,
          hackathonId: hackathon.id,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You must join the hackathon before submitting',
      );
    }

    let teamId = dto.teamId;
    if (hackathon.teamBased) {
      if (!participant.teamId) {
        throw new BadRequestException(
          'You must join a team to submit in this hackathon',
        );
      }
      teamId = participant.teamId;
    } else {
      teamId = undefined; // Force undefined if not team based
    }

    // Check existing submissions
    if (hackathon.teamBased && teamId) {
      const existingTeamSubmission =
        await this.prisma.hackathonSubmission.findFirst({
          where: { hackathonId: hackathon.id, teamId },
        });
      if (existingTeamSubmission) {
        throw new BadRequestException(
          'Your team has already submitted a project',
        );
      }
    } else {
      const existingUserSubmission =
        await this.prisma.hackathonSubmission.findFirst({
          where: { hackathonId: hackathon.id, userId },
        });
      if (existingUserSubmission) {
        throw new BadRequestException('You have already submitted a project');
      }
    }

    this.logger.log(
      `Submission created for hackathon ${hackathon.id} by user ${userId}${teamId ? ` (team ${teamId})` : ''}`,
    );
    return this.prisma.hackathonSubmission.create({
      data: {
        title: dto.title,
        submissionLink: dto.submissionLink,
        description: dto.description,
        submissionData: dto.submissionData,
        projectName: dto.projectName,
        projectUrl: dto.projectUrl,
        repositoryUrl: dto.repositoryUrl,
        videoUrl: dto.videoUrl,
        teamId,
        userId,
        hackathonId: hackathon.id,
      },
    });
  }

  async getSubmissions(hackathonId: string, query: GetSubmissionsQueryDto) {
    const where: any = { hackathonId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { projectName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    let orderBy: any = { createdAt: 'desc' };
    if (query.sortBy === 'score') {
      orderBy = { score: 'desc' };
    }

    const [data, total] = await Promise.all([
      this.prisma.hackathonSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
      }),
      this.prisma.hackathonSubmission.count({ where }),
    ]);

    this.logger.debug(
      `Fetched ${data.length} submissions for hackathon ${hackathonId}`,
    );
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

  async participate(userId: string, hackathonId: string) {
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
        'Cannot join a completed or cancelled hackathon',
      );
    }

    const existing = await this.prisma.hackathonParticipant.findUnique({
      where: { userId_hackathonId: { userId, hackathonId } },
    });

    if (existing) {
      throw new BadRequestException('You are already a participant');
    }

    this.logger.log(`User ${userId} joined hackathon ${hackathonId}`);
    return this.prisma.hackathonParticipant.create({
      data: {
        userId,
        hackathonId,
      },
    });
  }

  // update and delete submission would follow similarly...
}
