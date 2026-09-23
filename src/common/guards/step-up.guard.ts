import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StepUpService } from '../services/step-up.service';

/**
 * Guard that validates a step-up token on incoming requests.
 *
 * The token can be provided in:
 *   - Request header: `x-step-up-token`
 *   - Request body:   `stepUpToken`
 *
 * Apply this guard to any endpoint that requires re-authentication
 * (e.g. wallet withdrawals, sensitive account changes).
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(private readonly stepUpService: StepUpService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const headerToken = request.headers['x-step-up-token'];
    const resolvedHeaderToken = Array.isArray(headerToken)
      ? headerToken[0]
      : headerToken;
    const stepUpToken = resolvedHeaderToken || request.body?.stepUpToken;

    await this.stepUpService.assertToken(user.id, stepUpToken);
    return true;
  }
}
