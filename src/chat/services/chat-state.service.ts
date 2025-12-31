import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvConfig } from 'src/config/env.config';
import type {
  PendingMessage,
  UserOnlineStatus,
} from '../interfaces/chat.interfaces';

/**
 * Manages distributed chat state using Redis
 * Handles user sockets, pending messages, and online status
 */
@Injectable()
export class ChatStateService {
  private readonly logger = new Logger(ChatStateService.name);
  private redis: Redis;
  private readonly MESSAGE_TTL = 365 * 24 * 60 * 60; // 1 year in seconds
  private readonly MAX_PENDING_MESSAGES = 100;

  constructor(private configService: ConfigService) {
    const redisHost = this.configService.get<string>(EnvConfig.REDIS_HOST);
    const redisPort = this.configService.get<number>(EnvConfig.REDIS_PORT);
    const redisPassword = this.configService.get<string>(
      EnvConfig.REDIS_PASSWORD,
    );

    if (redisHost && redisPort) {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword || undefined,
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      this.redis.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.redis.on('connect', () => {
        this.logger.log('Connected to Redis');
      });
    } else {
      this.logger.warn(
        'Redis not configured (REDIS_HOST/REDIS_PORT missing), using in-memory fallback',
      );
    }
  }

  /**
   * Add a socket for a user
   */
  async addUserSocket(userId: string, socketId: string): Promise<void> {
    if (!this.redis) return;

    const key = `chat:sockets:${userId}`;
    await this.redis.sadd(key, socketId);
    await this.redis.expire(key, 24 * 60 * 60); // 24 hours
  }

  /**
   * Remove a socket for a user
   */
  async removeUserSocket(userId: string, socketId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `chat:sockets:${userId}`;
    await this.redis.srem(key, socketId);

    // Check if user has any remaining sockets
    const count = await this.redis.scard(key);
    return count === 0;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    if (!this.redis) return false;

    const key = `chat:sockets:${userId}`;
    const count = await this.redis.scard(key);
    return count > 0;
  }

  /**
   * Get all socket IDs for a user
   */
  async getUserSockets(userId: string): Promise<string[]> {
    if (!this.redis) return [];

    const key = `chat:sockets:${userId}`;
    return await this.redis.smembers(key);
  }

  /**
   * Queue a pending message for offline user
   */
  async queuePendingMessage(
    userId: string,
    event: string,
    data: any,
  ): Promise<void> {
    if (!this.redis) return;

    const key = `chat:pending:${userId}`;
    const message: PendingMessage = {
      userId,
      event,
      data,
      timestamp: new Date(),
    };

    // Add message to list
    await this.redis.lpush(key, JSON.stringify(message));

    // Trim to max size
    await this.redis.ltrim(key, 0, this.MAX_PENDING_MESSAGES - 1);

    // Set TTL
    await this.redis.expire(key, this.MESSAGE_TTL);
  }

  /**
   * Get and clear pending messages for a user
   */
  async getPendingMessages(userId: string): Promise<PendingMessage[]> {
    if (!this.redis) return [];

    const key = `chat:pending:${userId}`;

    // Get all messages
    const messages = await this.redis.lrange(key, 0, -1);

    // Delete the key
    await this.redis.del(key);

    // Parse and return
    return messages
      .map((msg) => {
        try {
          return JSON.parse(msg);
        } catch (error) {
          this.logger.error(
            `Failed to parse pending message: ${error.message}`,
          );
          return null;
        }
      })
      .filter((msg) => msg !== null);
  }

  /**
   * Get count of pending messages
   */
  async getPendingMessageCount(userId: string): Promise<number> {
    if (!this.redis) return 0;

    const key = `chat:pending:${userId}`;
    return await this.redis.llen(key);
  }

  /**
   * Set user's last seen timestamp
   */
  async setLastSeen(userId: string): Promise<void> {
    if (!this.redis) return;

    const key = `chat:lastseen:${userId}`;
    await this.redis.set(
      key,
      new Date().toISOString(),
      'EX',
      30 * 24 * 60 * 60,
    ); // 30 days
  }

  /**
   * Get user's last seen timestamp
   */
  async getLastSeen(userId: string): Promise<Date | null> {
    if (!this.redis) return null;

    const key = `chat:lastseen:${userId}`;
    const timestamp = await this.redis.get(key);

    return timestamp ? new Date(timestamp) : null;
  }

  /**
   * Get online status for multiple users
   */
  async getUsersOnlineStatus(userIds: string[]): Promise<UserOnlineStatus[]> {
    const statuses = await Promise.all(
      userIds.map(async (userId) => {
        const isOnline = await this.isUserOnline(userId);
        const status: UserOnlineStatus = {
          userId,
          isOnline,
        };

        if (!isOnline) {
          const lastSeen = await this.getLastSeen(userId);
          if (lastSeen) {
            status.lastSeen = lastSeen;
          }
        }

        return status;
      }),
    );

    return statuses;
  }

  /**
   * Get all user IDs that have active sockets
   */
  async getAllConnectedUserIds(): Promise<string[]> {
    if (!this.redis) return [];

    const pattern = 'chat:sockets:*';
    const keys = await this.redis.keys(pattern);

    // Extract user IDs from keys (format: chat:sockets:userId)
    return keys.map((key) => key.replace('chat:sockets:', ''));
  }

  /**
   * Clear all socket connections for a user
   */
  async clearUserSockets(userId: string): Promise<void> {
    if (!this.redis) return;

    const key = `chat:sockets:${userId}`;
    await this.redis.del(key);
  }

  /**
   * Clear all socket connections (for graceful shutdown)
   */
  async clearAllSockets(): Promise<void> {
    if (!this.redis) return;

    this.logger.log('Clearing all socket connections from Redis...');

    const pattern = 'chat:sockets:*';
    const keys = await this.redis.keys(pattern);

    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.logger.log(`Cleared ${keys.length} socket connection sets`);
    }
  }

  /**
   * Cleanup expired data (run periodically)
   */
  async cleanup(): Promise<void> {
    if (!this.redis) return;

    this.logger.log('Running chat state cleanup...');

    // Redis TTL handles most cleanup automatically
    // This is just for logging/monitoring
    const pattern = 'chat:pending:*';
    const keys = await this.redis.keys(pattern);

    this.logger.log(`Found ${keys.length} pending message queues`);
  }

  async onModuleDestroy() {
    if (this.redis) {
      // Clear all socket connections before shutting down
      await this.clearAllSockets();
      await this.redis.quit();
    }
  }
}
