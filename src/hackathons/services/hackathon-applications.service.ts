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
      });
    } catch (error) {
      // An email problem must never fail the application itself.
      this.logger.warn(
        `Could not send application email: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
