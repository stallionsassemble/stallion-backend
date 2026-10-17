import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplicationStatus, HackathonStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EnvConfig } from '../../config/env.config';
import { EmailService } from '../../email/email.service';
import {
  ApplicationQuestion,
  validateApplicationAnswers,
  validateApplicationForm,
} from '../utils/application-form.util';

@Injectable()
export class HackathonApplicationsService {
  private readonly logger = new Logger(HackathonApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Apply to a hackathon. Validates the answers against the hackathon's form, links the
   * applicant to a real team when they registered with one, and sets the status from the
   * hackathon's approval mode.
   */
  async apply(userId: string, hackathonId: string, rawAnswers?: unknown) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });
    if (!hackathon) throw new NotFoundException('Hackathon not found');

    if (
      hackathon.status === HackathonStatus.COMPLETED ||
      hackathon.status === HackathonStatus.CANCELLED
    ) {
      throw new BadRequestException(
        'This hackathon is no longer accepting applications',
      );
    }
    if (new Date() > hackathon.deadline) {
      throw new BadRequestException('The hackathon deadline has passed');
    }

    const existing = await this.prisma.hackathonParticipant.findUnique({
      where: { userId_hackathonId: { userId, hackathonId } },
    });
    if (existing) {
      throw new BadRequestException(
        'You have already applied to this hackathon',
      );
    }

    const questions: ApplicationQuestion[] = validateApplicationForm(
      hackathon.applicationForm,
    );
    if (questions.length > 0 && rawAnswers === undefined) {
      throw new BadRequestException(
        'This hackathon has an application form. Please fill it in to apply.',
      );
    }
    const { answers, teamIntent, teamName } = validateApplicationAnswers(
      questions,
      rawAnswers,
    );

    const status = hackathon.requiresApproval
      ? ApplicationStatus.PENDING
      : ApplicationStatus.ACCEPTED;

    let participant: Awaited<
      ReturnType<typeof this.prisma.hackathonParticipant.create>
    >;
    try {
      participant = await this.prisma.$transaction(async (tx) => {
        let teamId: string | null = null;

        if (hackathon.teamBased && teamIntent === 'EXISTING_TEAM' && teamName) {
          // Match the exact name, ignoring case and surrounding spaces, so
          // "Team A" and "team a" end up in one team.
          const team = await tx.hackathonTeam.findFirst({
            where: {
              hackathonId,
              name: { equals: teamName, mode: 'insensitive' },
            },
            include: { _count: { select: { participants: true } } },
          });

          if (team) {
            if (
              hackathon.maxTeamSize &&
              team._count.participants >= hackathon.maxTeamSize
            ) {
              throw new BadRequestException(
                `The team "${team.name}" is already full (maximum ${hackathon.maxTeamSize} members).`,
              );
            }
            teamId = team.id;
          } else {
            const created = await tx.hackathonTeam.create({
              data: { name: teamName, leaderId: userId, hackathonId },
            });
            teamId = created.id;
          }
        }

        return tx.hackathonParticipant.create({
          data: {
            userId,
            hackathonId,
            teamId,
            status,
            applicationData: answers as unknown as Prisma.InputJsonValue,
            lookingForTeam: hackathon.teamBased && teamIntent === 'NEED_TEAM',
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You have already applied, or that team name was just taken. Please try again.',
        );
      }
      throw error;
    }

    this.logger.log(
      `User ${userId} applied to hackathon ${hackathonId} (${status}${participant.teamId ? `, team ${participant.teamId}` : ''})`,
    );
    void this.sendStatusEmail(userId, hackathon, status);

    return participant;
  }

  async getMyApplication(userId: string, hackathonId: string) {
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { userId_hackathonId: { userId, hackathonId } },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            leaderId: true,
            _count: { select: { participants: true } },
          },
        },
      },
    });
    return { applied: !!participant, application: participant };
  }

  private async sendStatusEmail(
    userId: string,
    hackathon: { title: string; slug: string },
    status: ApplicationStatus,
    note: string | null = null,
  ) {
    try {
      if (status === ApplicationStatus.WITHDRAWN) return;
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, username: true },
      });
      if (!user?.email) return;

      const base =
        this.configService.get<string>(EnvConfig.FRONTEND_URL) ||
        'http://localhost:3000';
      await this.emailService.sendHackathonApplicationEmail(user.email, {
        name: user.firstName || user.username,
        hackathonTitle: hackathon.title,
        status,
        hackathonUrl: `${base.replace(/\/$/, '')}/hackathons/${hackathon.slug}`,
        note,
      });
    } catch (error) {
      // An email problem must never fail the application itself.
      this.logger.warn(
        `Could not send application email: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Admin: review applications and match applicants into teams
  // ---------------------------------------------------------------------------

  async listApplications(
    hackathonId: string,
    query: {
      status?: ApplicationStatus;
      lookingForTeam?: boolean;
      inTeam?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    await this.requireHackathon(hackathonId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const search = query.search?.trim();

    const where: Prisma.HackathonParticipantWhereInput = {
      hackathonId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.lookingForTeam ? { lookingForTeam: true, teamId: null } : {}),
      ...(query.inTeam ? { teamId: { not: null } } : {}),
      ...(search
        ? {
            user: {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total, grouped] = await Promise.all([
      this.prisma.hackathonParticipant.findMany({
        where,
        // People in the same team stay together, teams in alphabetical order.
        orderBy: query.inTeam
          ? [{ team: { name: 'asc' } }, { appliedAt: 'asc' }]
          : { appliedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
              profilePicture: true,
            },
          },
          team: { select: { id: true, name: true } },
        },
      }),
      this.prisma.hackathonParticipant.count({ where }),
      this.prisma.hackathonParticipant.groupBy({
        by: ['status'],
        where: { hackathonId },
        _count: { _all: true },
      }),
    ]);

    const counts = { PENDING: 0, ACCEPTED: 0, REJECTED: 0, WITHDRAWN: 0 };
    for (const g of grouped) counts[g.status] = g._count._all;

    const lookingForTeam = await this.prisma.hackathonParticipant.count({
      where: { hackathonId, lookingForTeam: true, teamId: null },
    });

    const inTeam = await this.prisma.hackathonParticipant.count({
      where: { hackathonId, teamId: { not: null } },
    });

    return {
      data: items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      counts: { ...counts, lookingForTeam, inTeam },
    };
  }

  async reviewApplication(
    hackathonId: string,
    participantId: string,
    adminId: string,
    decision: ApplicationStatus,
    note?: string,
  ) {
    if (
      decision !== ApplicationStatus.ACCEPTED &&
      decision !== ApplicationStatus.REJECTED
    ) {
      throw new BadRequestException('Decision must be ACCEPTED or REJECTED');
    }
    const hackathon = await this.requireHackathon(hackathonId);

    const participant = await this.prisma.hackathonParticipant.findFirst({
      where: { id: participantId, hackathonId },
    });
    if (!participant) throw new NotFoundException('Application not found');
    if (participant.status === decision) {
      throw new BadRequestException(`This application is already ${decision}`);
    }

    const updated = await this.prisma.hackathonParticipant.update({
      where: { id: participantId },
      data: {
        status: decision,
        reviewedAt: new Date(),
        reviewedById: adminId,
        reviewNote: note?.trim() || null,
        // A rejected applicant should not hold a team seat or sit in the matching pool.
        ...(decision === ApplicationStatus.REJECTED
          ? { teamId: null, lookingForTeam: false }
          : // Rejecting clears the flag, so bring it back when the applicant is accepted again.
            hackathon.teamBased && !participant.teamId
            ? {
                lookingForTeam: this.needsTeam(
                  hackathon.applicationForm,
                  participant.applicationData,
                ),
              }
            : {}),
      },
    });

    this.logger.log(
      `Application ${participantId} for hackathon ${hackathonId} ${decision} by admin ${adminId}`,
    );
    void this.sendStatusEmail(
      participant.userId,
      hackathon,
      decision,
      note?.trim() || null,
    );
    return updated;
  }

  /** True when the applicant's saved answers say they are registering without a team. */
  private needsTeam(form: unknown, answers: unknown): boolean {
    if (!Array.isArray(form) || !answers || typeof answers !== 'object') {
      return false;
    }
    const mode = (form as ApplicationQuestion[]).find(
      (q) => q.type === 'TEAM_MODE',
    );
    if (!mode?.options) return false;
    return (answers as Record<string, unknown>)[mode.id] === mode.options[0];
  }

  /** Puts unmatched applicants into one new team. The first listed applicant becomes leader. */
  async groupIntoTeam(
    hackathonId: string,
    teamName: string,
    participantIds: string[],
  ) {
    const hackathon = await this.requireHackathon(hackathonId);
    if (!hackathon.teamBased) {
      throw new BadRequestException('This hackathon does not support teams');
    }

    const ids = Array.from(new Set(participantIds));
    if (ids.length === 0) {
      throw new BadRequestException('Select at least one applicant');
    }
    if (hackathon.maxTeamSize && ids.length > hackathon.maxTeamSize) {
      throw new BadRequestException(
        `A team can have at most ${hackathon.maxTeamSize} members`,
      );
    }

    const name = teamName.trim();
    if (!name) throw new BadRequestException('Enter a team name');

    return this.prisma.$transaction(async (tx) => {
      const participants = await tx.hackathonParticipant.findMany({
        where: { id: { in: ids }, hackathonId },
      });
      if (participants.length !== ids.length) {
        throw new NotFoundException('Some applicants were not found');
      }
      const unavailable = participants.filter(
        (p) => p.teamId || p.status === ApplicationStatus.REJECTED,
      );
      if (unavailable.length > 0) {
        throw new BadRequestException(
          'Some applicants already have a team or were rejected. Refresh the list and try again.',
        );
      }

      const taken = await tx.hackathonTeam.findFirst({
        where: { hackathonId, name: { equals: name, mode: 'insensitive' } },
      });
      if (taken) {
        throw new BadRequestException(
          `A team named "${taken.name}" already exists`,
        );
      }

      const leader = ids
        .map((id) => participants.find((p) => p.id === id))
        .find(Boolean)!;
      const team = await tx.hackathonTeam.create({
        data: { name, hackathonId, leaderId: leader.userId },
      });
      await tx.hackathonParticipant.updateMany({
        where: { id: { in: ids } },
        data: { teamId: team.id, lookingForTeam: false },
      });

      this.logger.log(
        `Admin grouped ${ids.length} applicants into team "${name}" (${team.id}) for hackathon ${hackathonId}`,
      );
      return { ...team, memberCount: ids.length };
    });
  }

  private async requireHackathon(hackathonId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });
    if (!hackathon) throw new NotFoundException('Hackathon not found');
    return hackathon;
  }
}
