import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
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
