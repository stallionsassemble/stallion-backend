import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MFAGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has MFA enabled
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { mfaEnabled: true },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    if (!dbUser.mfaEnabled) {
      throw new ForbiddenException(
        'MFA is required for this operation. Please set up MFA in your settings.',
      );
    }

    return true;
  }
}
