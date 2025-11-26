import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  async create(
    bountyId: string,
    userId: string,
    createSubmissionDto: CreateSubmissionDto,
  ) {
    return this.prisma.bountySubmission.create({
      data: {
        bountyId,
        userId,
        submission: createSubmissionDto.submission,
      },
      include: {
        user: true,
        bounty: true,
      },
    });
  }

  async findByBounty(bountyId: string) {
    return this.prisma.bountySubmission.findMany({
      where: { bountyId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.bountySubmission.findUnique({
      where: { id },
      include: {
        user: true,
        bounty: true,
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    return submission;
  }
}
