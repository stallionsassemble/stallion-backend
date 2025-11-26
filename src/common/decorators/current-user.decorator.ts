import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../../auth/interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
