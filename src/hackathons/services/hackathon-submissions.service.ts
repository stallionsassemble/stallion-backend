import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStatus,
  HackathonStatus,
  Role,
  HackathonSubmissionStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSubmissionDto } from '../dto/create-submission.dto';
import { GetSubmissionsQueryDto } from '../dto/get-submissions-query.dto';
import {
  ApplicationQuestion,
  validateApplicationAnswers,
} from '../utils/application-form.util';

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

    if (participant.status !== ApplicationStatus.ACCEPTED) {
      throw new ForbiddenException(
        participant.status === ApplicationStatus.REJECTED
          ? 'Your application was not accepted, so you cannot submit a project'
          : 'Your application is still being reviewed. You can submit once it is accepted',
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

      // One submission per team, made by the team leader. Everyone else sees it once it is in.
      const team = await this.prisma.hackathonTeam.findUnique({
        where: { id: participant.teamId },
        select: { leaderId: true },
      });
      if (team && team.leaderId !== userId) {
        throw new ForbiddenException(
          'Only your team leader can submit the project for your team',
        );
      }
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

    // When the hackathon is split into tracks, every submission must pick one of them.
    let track: string | undefined;
    if (hackathon.tracks.length > 0) {
      const wanted = dto.track?.trim().toLowerCase();
      const match = hackathon.tracks.find((t) => t.toLowerCase() === wanted);
      if (!match) {
        throw new BadRequestException(
          `Choose a track for your project: ${hackathon.tracks.join(', ')}`,
        );
      }
      track = match;
    }

    // Answers to the admin-defined submission questions (pitch deck link and so on).
    const form = (hackathon.submissionForm ??
      []) as unknown as ApplicationQuestion[];
    let submissionData = dto.submissionData;
    if (form.length > 0) {
      const rawAnswers = (
        dto.submissionData as { answers?: unknown } | undefined
      )?.answers;
      const { answers } = validateApplicationAnswers(form, rawAnswers);
      submissionData = { ...(dto.submissionData ?? {}), answers };
    }

    this.logger.log(
      `Submission created for hackathon ${hackathon.id} by user ${userId}${teamId ? ` (team ${teamId})` : ''}`,
    );
    return this.prisma.hackathonSubmission.create({
      data: {
        title: dto.title,
        submissionLink: dto.submissionLink,
        description: dto.description,
        submissionData,
        projectName: dto.projectName,
        projectUrl: dto.projectUrl,
        repositoryUrl: dto.repositoryUrl,
        videoUrl: dto.videoUrl,
        track,
        teamId,
        userId,
        hackathonId: hackathon.id,
      },
    });
  }

  async getSubmissions(
    hackathonId: string,
    query: GetSubmissionsQueryDto,
    viewer?: { id: string; role: Role } | null,
  ) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { companyId: true, resultsPublished: true },
    });
    if (!hackathon) throw new NotFoundException('Hackathon not found');

    // Submissions are private to the hackathon's owner and admins. The only
    // public view is the winners list, once results are published.
    const canManage =
      !!viewer &&
      (viewer.role === Role.ADMIN || hackathon.companyId === viewer.id);
    const isPublicWinners =
      query.status === HackathonSubmissionStatus.WINNER &&
      hackathon.resultsPublished;
    if (!canManage && !isPublicWinners) {
      throw new ForbiddenException(
        'Only the hackathon owner or an admin can view submissions',
      );
    }

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
              username: true,
              profilePicture: true,
            },
          },
          team: { select: { id: true, name: true } },
          // Placement, prize and payment status for the winners list. isPaid stays false on
          // MANUAL hackathons until an admin records the payment.
          winner: {
            select: {
              position: true,
              prizeAmount: true,
              isPaid: true,
              paidAt: true,
            },
          },
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
