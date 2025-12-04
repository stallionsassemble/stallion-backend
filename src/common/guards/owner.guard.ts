import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const bountyId = request.params.id || request.params.bountyId;

    if (!user || !bountyId) {
      throw new ForbiddenException('Access denied');
    }

    // Admin can access everything
    if (user.role === 'ADMIN') {
      return true;
    }

    // Check if user is the bounty creator
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
      select: { ownerId: true },
    });

    if (!bounty) {
      throw new ForbiddenException('Bounty not found');
    }

    if (bounty.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this bounty');
    }

    return true;
  }
}
