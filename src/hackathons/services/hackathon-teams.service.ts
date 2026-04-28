import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HackathonTeamsService {
  private readonly logger = new Logger(HackathonTeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createTeam(userId: string, hackathonId: string, name: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon) {
      throw new NotFoundException('Hackathon not found');
    }

    if (!hackathon.teamBased) {
      throw new BadRequestException('This hackathon does not support teams');
    }

    const existingParticipant =
      await this.prisma.hackathonParticipant.findUnique({
        where: { userId_hackathonId: { userId, hackathonId } },
      });

    if (!existingParticipant) {
      throw new ForbiddenException(
        'You must join the hackathon before creating a team',
      );
    }

    if (existingParticipant.teamId) {
      throw new BadRequestException(
        'You are already in a team for this hackathon',
      );
    }

    // Attempt to create team and update participant transactionally
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.hackathonTeam.create({
        data: {
          name,
          leaderId: userId,
          hackathonId,
        },
      });

      await tx.hackathonParticipant.update({
        where: { id: existingParticipant.id },
        data: { teamId: team.id },
      });

      this.logger.log(
        `Team '${name}' created by user ${userId} for hackathon ${hackathonId}`,
      );
      return team;
    });
  }

  async joinTeam(userId: string, hackathonId: string, teamId: string) {
    const hackathon = await this.prisma.hackathon.findUnique({
      where: { id: hackathonId },
    });

    if (!hackathon || !hackathon.teamBased) {
      throw new BadRequestException('Invalid hackathon for team joining');
    }

    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { userId_hackathonId: { userId, hackathonId } },
    });

    if (!participant) {
      throw new ForbiddenException('You must join the hackathon first');
    }

    if (participant.teamId) {
      throw new BadRequestException('You are already in a team');
    }

    const team = await this.prisma.hackathonTeam.findUnique({
      where: { id: teamId },
      include: {
        _count: { select: { participants: true } },
      },
    });

    if (!team || team.hackathonId !== hackathonId) {
      throw new NotFoundException('Team not found');
    }

    if (
      hackathon.maxTeamSize &&
      team._count.participants >= hackathon.maxTeamSize
    ) {
      throw new BadRequestException('Team is already full');
    }

    this.logger.log(
      `User ${userId} joined team ${teamId} in hackathon ${hackathonId}`,
    );
    return this.prisma.hackathonParticipant.update({
      where: { id: participant.id },
      data: { teamId },
    });
  }

  async leaveTeam(userId: string, hackathonId: string) {
    const participant = await this.prisma.hackathonParticipant.findUnique({
      where: { userId_hackathonId: { userId, hackathonId } },
      include: { team: true },
    });

    if (!participant || !participant.teamId) {
      throw new BadRequestException('You are not in a team');
    }

    const team = participant.team;

    return this.prisma.$transaction(async (tx) => {
      await tx.hackathonParticipant.update({
        where: { id: participant.id },
        data: { teamId: null },
      });

      // If user was the leader, reassign or delete
      if (team!.leaderId === userId) {
        const remaining = await tx.hackathonParticipant.findFirst({
          where: { teamId: team!.id },
        });

        if (remaining) {
          await tx.hackathonTeam.update({
            where: { id: team!.id },
            data: { leaderId: remaining.userId },
          });
        } else {
          // Delete empty team
          await tx.hackathonTeam.delete({
            where: { id: team!.id },
          });
        }
      }

      this.logger.log(
        `User ${userId} left team ${team!.id} in hackathon ${hackathonId}`,
      );
      return { success: true };
    });
  }
}
