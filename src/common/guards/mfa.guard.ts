import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class MFAGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // TODO: Phase 3 - Implement real MFA validation
    // For now, this is a stub that always passes
    // In Phase 3, check if user has MFA enabled and validate TOTP/passkey

    return true;
  }
}
