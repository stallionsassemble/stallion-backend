import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request } from 'express';
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from 'rxjs';

/**
 * Fails any HTTP request whose handler hasn't produced a response within
 * `timeoutMs`, so a stalled dependency (DB, Redis, SMTP, RPC) surfaces to the
 * client as a 503 instead of an indefinite hang. The underlying work is not
 * cancelled; this only bounds how long the client waits.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TimeoutInterceptor.name);

  constructor(private readonly timeoutMs: number) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          const req = context.switchToHttp().getRequest<Request>();
          this.logger.error(
            `Request timed out after ${this.timeoutMs}ms: ${req.method} ${req.originalUrl}`,
          );
          return throwError(
            () =>
              new ServiceUnavailableException(
                'The server took too long to respond. Please try again.',
              ),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}
