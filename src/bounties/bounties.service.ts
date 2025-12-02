import { Injectable, NotFoundException } from '@nestjs/common';
import { BountyStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateBountyDto } from './dto/create-bounty.dto';
import { UpdateBountyDto } from './dto/update-bounty.dto';

@Injectable()
export class BountiesService {
  constructor(private prisma: PrismaService) {}

  async create(createBountyDto: CreateBountyDto, userId: string) {
    return this.prisma.bounty.create({
      data: {
        ...createBountyDto,
        ownerId: userId,
        reward: createBountyDto.reward.toString(),
      },
      include: {
        submissions: true,
        winners: true,
      },
    });
  }

  async findAll(status?: BountyStatus) {
    return this.prisma.bounty.findMany({
      where: status ? { status } : undefined,
      include: {
        submissions: true,
        winners: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id },
      include: {
        submissions: {
          include: {
            user: true,
          },
        },
        winners: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!bounty) {
      throw new NotFoundException(`Bounty with ID ${id} not found`);
    }

    return bounty;
  }

  async update(id: string, updateBountyDto: UpdateBountyDto) {
    const bounty = await this.findOne(id);

    return this.prisma.bounty.update({
      where: { id: bounty.id },
      data: {
        ...updateBountyDto,
        reward: updateBountyDto.reward?.toString(),
      },
      include: {
        submissions: true,
        winners: true,
      },
    });
  }

  async remove(id: string) {
    const bounty = await this.findOne(id);
    return this.prisma.bounty.delete({
      where: { id: bounty.id },
    });
  }
}
