import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminStepUpGuard } from '../../admin/guards/admin-step-up.guard';

/**
 * Judging endpoints are shared by Project Owners and admins. Owners judge their own hackathon
 * as before. Admins must also have a valid 2FA step-up, because winners decide who gets paid.
 */
@Injectable()
export class AdminJudgingStepUpGuard implements CanActivate {
  constructor(private readonly adminStepUpGuard: AdminStepUpGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user;
    if (user?.role !== Role.ADMIN) return true;
    return this.adminStepUpGuard.canActivate(context);
  }
}
