import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hasAny2FA } from '../utils/mfa.util';

@Injectable()
export class MFAGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user has any second factor enabled (TOTP or Passkey)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        mfaEnabled: true,
        totpSecret: true,
        passkeys: { select: { id: true } },
      },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    if (!hasAny2FA(dbUser)) {
      throw new ForbiddenException(
        'MFA is required for this operation. Please set up an authenticator app or passkey in your settings.',
      );
    }

    return true;
  }
}
