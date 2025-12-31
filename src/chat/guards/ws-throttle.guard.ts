import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import type { AuthenticatedSocket } from '../interfaces/chat.interfaces';

/**
 * Rate limiting guard for WebSocket events
 * Prevents spam and abuse
 */
@Injectable()
export class WsThrottleGuard implements CanActivate {
  private readonly logger = new Logger(WsThrottleGuard.name);
  private readonly requests = new Map<string, number[]>();
  private readonly MESSAGE_LIMIT = 30; // messages per window
  private readonly WINDOW_MS = 60000; // 1 minute
  private readonly TYPING_LIMIT = 10; // typing events per window
  private readonly TYPING_WINDOW_MS = 10000; // 10 seconds

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<AuthenticatedSocket>();
    const eventName = context.getHandler().name;

    if (!client.userId) {
      return true; // Let auth guard handle this
    }

    const key = `${client.userId}:${eventName}`;
    const now = Date.now();

    // Different limits for different event types
    let limit = this.MESSAGE_LIMIT;
    let window = this.WINDOW_MS;

    if (eventName.includes('typing') || eventName.includes('Typing')) {
      limit = this.TYPING_LIMIT;
      window = this.TYPING_WINDOW_MS;
    }

    // Get or create request history
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const timestamps = this.requests.get(key)!;

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < window);

    // Check if limit exceeded
    if (validTimestamps.length >= limit) {
      this.logger.warn(
        `Rate limit exceeded for user ${client.userId} on event ${eventName}`,
      );
      throw new WsException('Rate limit exceeded. Please slow down.');
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    // Cleanup old entries periodically
    if (Math.random() < 0.01) {
      this.cleanup();
    }

    return true;
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.requests.forEach((timestamps, key) => {
      const validTimestamps = timestamps.filter(
        (ts) => now - ts < this.WINDOW_MS * 2,
      );

      if (validTimestamps.length === 0) {
        keysToDelete.push(key);
      } else {
        this.requests.set(key, validTimestamps);
      }
    });

    keysToDelete.forEach((key) => this.requests.delete(key));

    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} rate limit entries`);
    }
  }
}
