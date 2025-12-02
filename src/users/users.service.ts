import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      include: {
        userPoints: true,
        wallet: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userPoints: {
          include: {
            points: true,
          },
        },
        wallet: true,
        submissions: true,
        winners: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userPoints: true,
        wallet: true,
      },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findOne(id);

    return this.prisma.user.update({
      where: { id: user.id },
      data: updateUserDto,
      include: {
        userPoints: true,
        wallet: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    return this.prisma.user.delete({
      where: { id: user.id },
    });
  }
}
