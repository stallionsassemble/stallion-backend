import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TxState, TxType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string, userId: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        wallet: {
          include: {
            users: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    const isOwner = transaction.wallet.users.some((user) => user.id === userId);
    if (!isOwner) {
      throw new ForbiddenException(
        'You are not authorized to view this transaction',
      );
    }

    return transaction;
  }

  async getUserTransactions(
    userId: string,
    filters?: {
      type?: TxType;
      state?: TxState;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletId: true },
    });

    if (!user || !user.walletId) {
      throw new NotFoundException('User wallet not found');
    }

    const where: any = {
      walletId: user.walletId,
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.state) {
      where.state = filters.state;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      total,
      limit: filters?.limit || 50,
      offset: filters?.offset || 0,
    };
  }
}
