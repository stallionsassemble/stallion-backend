import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from 'src/common/redis/redis.service';
import type {
  PendingMessage,
  UserOnlineStatus,
} from '../interfaces/chat.interfaces';

/**
 * Manages distributed chat state using Redis
 * Handles user sockets, pending messages, and online status
 */
@Injectable()
export class ChatStateService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatStateService.name);
  private readonly MESSAGE_TTL = 365 * 24 * 60 * 60; // 1 year in seconds
  private readonly MAX_PENDING_MESSAGES = 100;

  constructor(private redisService: RedisService) {}

  /**
   * Add a socket for a user
   */
  async addUserSocket(userId: string, socketId: string): Promise<void> {
    const key = `chat:sockets:${userId}`;
    await this.redisService.sadd(key, socketId);
    await this.redisService.expire(key, 24 * 60 * 60); // 24 hours
  }

  /**
   * Remove a socket for a user
   */
  async removeUserSocket(userId: string, socketId: string): Promise<boolean> {
    const key = `chat:sockets:${userId}`;
    await this.redisService.srem(key, socketId);

    // Check if user has any remaining sockets
    const count = await this.redisService.scard(key);
    return count === 0;
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const key = `chat:sockets:${userId}`;
    const count = await this.redisService.scard(key);
    return count > 0;
  }

  /**
   * Get all socket IDs for a user
   */
  async getUserSockets(userId: string): Promise<string[]> {
    const key = `chat:sockets:${userId}`;
    return await this.redisService.smembers(key);
  }

  /**
   * Queue a pending message for offline user
   */
  async queuePendingMessage(
    userId: string,
    event: string,
    data: any,
  ): Promise<void> {
    const key = `chat:pending:${userId}`;
    const message: PendingMessage = {
      userId,
      event,
      data,
      timestamp: new Date(),
    };

    // Add message to list
    await this.redisService.lpush(key, JSON.stringify(message));

    // Trim to max size
    await this.redisService.ltrim(key, 0, this.MAX_PENDING_MESSAGES - 1);

    // Set TTL
    await this.redisService.expire(key, this.MESSAGE_TTL);
  }

  /**
   * Get and clear pending messages for a user
   */
  async getPendingMessages(userId: string): Promise<PendingMessage[]> {
    const key = `chat:pending:${userId}`;

    // Get all messages
    const messages = await this.redisService.lrange(key, 0, -1);

    // Delete the key
    await this.redisService.delete(key);

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
    const key = `chat:pending:${userId}`;
    return await this.redisService.llen(key);
  }

  /**
   * Set user's last seen timestamp
   */
  async setLastSeen(userId: string): Promise<void> {
    const key = `chat:lastseen:${userId}`;
    await this.redisService.set(
      key,
      new Date().toISOString(),
      30 * 24 * 60 * 60,
    ); // 30 days
  }

  /**
   * Get user's last seen timestamp
   */
  async getLastSeen(userId: string): Promise<Date | null> {
    const key = `chat:lastseen:${userId}`;
    const timestamp = await this.redisService.get(key);

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
    const pattern = 'chat:sockets:*';
    const keys = await this.redisService.keys(pattern);

    // Extract user IDs from keys (format: chat:sockets:userId)
    return keys.map((key) => key.replace('chat:sockets:', ''));
  }

  /**
   * Clear all socket connections for a user
   */
  async clearUserSockets(userId: string): Promise<void> {
    const key = `chat:sockets:${userId}`;
    await this.redisService.delete(key);
  }

  /**
   * Clear all socket connections (for graceful shutdown)
   */
  async clearAllSockets(): Promise<void> {
    this.logger.log('Clearing all socket connections from Redis...');

    const pattern = 'chat:sockets:*';
    const keys = await this.redisService.keys(pattern);

    if (keys.length > 0) {
      await this.redisService.deleteMany(keys);
      this.logger.log(`Cleared ${keys.length} socket connection sets`);
    }
  }

  /**
   * Cleanup expired data (run periodically)
   */
  async cleanup(): Promise<void> {
    this.logger.log('Running chat state cleanup...');

    // Redis TTL handles most cleanup automatically
    // This is just for logging/monitoring
    const pattern = 'chat:pending:*';
    const keys = await this.redisService.keys(pattern);

    this.logger.log(`Found ${keys.length} pending message queues`);
  }

  async onModuleDestroy() {
    // Clear all socket connections before shutting down
    await this.clearAllSockets();
  }
}
