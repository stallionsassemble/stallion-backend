import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return data ? user?.[data] : user;
  },
);
