import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_COMPLETE_PROFILE_KEY } from '../decorators/requires-complete-profile.decorator';

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresCompleteProfile = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_COMPLETE_PROFILE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiresCompleteProfile) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      return false;
    }

    if (!user.profileCompleted) {
      throw new ForbiddenException(
        'You must complete your profile before accessing this resource',
      );
    }

    return true;
  }
}
