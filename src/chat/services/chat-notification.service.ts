import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { UserOnlineStatus } from '../interfaces/chat.interfaces';

/**
 * Handles chat notifications and status change broadcasting
 * Separated from gateway to avoid tight coupling
 */
@Injectable()
export class ChatNotificationService {
  private readonly logger = new Logger(ChatNotificationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all contact IDs for a user (users they have conversations with)
   */
  async getUserContacts(userId: string): Promise<string[]> {
    try {
      const conversations = await this.prisma.conversationParticipant.findMany({
        where: {
          userId,
          leftAt: null,
        },
        include: {
          conversation: {
            include: {
              participants: {
                where: {
                  userId: { not: userId },
                  leftAt: null,
                },
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      // Get unique contact user IDs
      const contactIds = new Set<string>();
      conversations.forEach((conv) => {
        conv.conversation.participants.forEach((p) => {
          contactIds.add(p.userId);
        });
      });

      return Array.from(contactIds);
    } catch (error) {
      this.logger.error(
        `Error getting contacts for user ${userId}: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Get the other participant in a conversation
   */
  async getConversationRecipient(
    conversationId: string,
    userId: string,
  ): Promise<string | null> {
    try {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: {
          conversationId,
          userId: { not: userId },
          leftAt: null,
        },
        select: {
          userId: true,
        },
        take: 1,
      });

      return participants[0]?.userId || null;
    } catch (error) {
      this.logger.error(
        `Error getting conversation recipient: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Create status update object
   */
  createStatusUpdate(
    userId: string,
    isOnline: boolean,
    lastSeen?: Date | null,
  ): UserOnlineStatus {
    return {
      userId,
      isOnline,
      lastSeen: lastSeen ?? undefined,
    };
  }
}
