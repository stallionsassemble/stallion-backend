import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AdminStepUpService } from '../admin-step-up.service';

@Injectable()
export class AdminStepUpGuard implements CanActivate {
  constructor(private readonly stepUpService: AdminStepUpService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const headerToken = request.headers['x-admin-step-up-token'];
    const resolvedHeaderToken = Array.isArray(headerToken)
      ? headerToken[0]
      : headerToken;
    const stepUpToken = resolvedHeaderToken || request.body?.stepUpToken;

    await this.stepUpService.assertStepUpToken(user.id, stepUpToken);
    return true;
  }
}
