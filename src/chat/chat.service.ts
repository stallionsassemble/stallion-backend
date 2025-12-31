import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, MessageType, ParticipantRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SendMessageWsDto } from './dto/websocket-events.dto';
import {
  ConversationResponse,
  MessageResponse,
} from './interfaces/chat.interfaces';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Find or create a direct conversation between two users
   * This is automatically called when sending a message
   */
  async findOrCreateDirectConversation(
    userId1: string,
    userId2: string,
  ): Promise<ConversationResponse> {
    if (userId1 === userId2) {
      throw new BadRequestException('Cannot create conversation with yourself');
    }

    // Check if conversation already exists
    const existing = await this.findDirectConversation(userId1, userId2);
    if (existing) {
      return existing;
    }

    // Create new direct conversation
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          type: ConversationType.DIRECT,
        },
      });

      // Add both participants
      await tx.conversationParticipant.createMany({
        data: [
          {
            conversationId: conversation.id,
            userId: userId1,
            role: ParticipantRole.MEMBER,
          },
          {
            conversationId: conversation.id,
            userId: userId2,
            role: ParticipantRole.MEMBER,
          },
        ],
      });

      // Fetch the created conversation with participants using transaction context
      const result = await tx.conversation.findUnique({
        where: { id: conversation.id },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  username: true,
                  firstName: true,
                  lastName: true,
                  profilePicture: true,
                },
              },
            },
          },
        },
      });

      return result as ConversationResponse;
    });
  }

  async findDirectConversation(userId1: string, userId2: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: ConversationType.DIRECT,
        AND: [
          {
            participants: {
              some: {
                userId: userId1,
              },
            },
          },
          {
            participants: {
              some: {
                userId: userId2,
              },
            },
          },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    });

    return conversations.find(
      (conv) =>
        conv.participants.length === 2 &&
        conv.participants.some((p) => p.userId === userId1) &&
        conv.participants.some((p) => p.userId === userId2),
    );
  }

  async getConversations(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        userId,
        leftAt: null,
      },
      include: {
        conversation: {
          include: {
            participants: {
              where: {
                leftAt: null,
              },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profilePicture: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          updatedAt: 'desc',
        },
      },
    });

    return Promise.all(
      participants.map(async (p) => {
        const conversation = p.conversation;
        const unreadCount = await this.getUnreadCount(conversation.id, userId);

        return {
          ...conversation,
          unreadCount,
          lastReadAt: p.lastReadAt,
        };
      }),
    );
  }

  async getConversation(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          where: {
            leftAt: null,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
          },
        },
        messages: {
          where: {
            isDeleted: false,
          },
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
            replyToMessage: {
              select: {
                id: true,
                content: true,
                isDeleted: true,
                senderId: true,
                sender: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            readReceipts: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Send a direct message to another user
   * Automatically creates conversation if it doesn't exist
   */
  async sendDirectMessage(
    senderId: string,
    dto: SendMessageWsDto,
  ): Promise<MessageResponse> {
    // Validate recipient exists
    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }

    // Validate replyToMessage if provided
    if (dto.replyToMessageId) {
      const replyToMessage = await this.prisma.message.findUnique({
        where: { id: dto.replyToMessageId },
      });

      if (!replyToMessage) {
        throw new BadRequestException('Reply message not found');
      }
    }

    // Find or create conversation
    const conversation = await this.findOrCreateDirectConversation(
      senderId,
      dto.recipientId,
    );

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content: dto.content,
        type: (dto.type as MessageType) || MessageType.TEXT,
        attachments: dto.attachments
          ? JSON.parse(JSON.stringify(dto.attachments))
          : null,
        replyToMessageId: dto.replyToMessageId || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        replyToMessage: {
          select: {
            id: true,
            content: true,
            isDeleted: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    // Auto-mark as read for sender
    await this.prisma.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId: senderId,
      },
    });

    return message as MessageResponse;
  }

  async updateMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    if (message.isDeleted) {
      throw new BadRequestException('Cannot edit deleted message');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        isEdited: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        content: 'This message has been deleted',
      },
    });

    return { message: 'Message deleted successfully' };
  }

  async markAsRead(conversationId: string, userId: string, messageId?: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    if (messageId) {
      const existing = await this.prisma.messageReadReceipt.findUnique({
        where: {
          messageId_userId: {
            messageId,
            userId,
          },
        },
      });

      if (!existing) {
        await this.prisma.messageReadReceipt.create({
          data: {
            messageId,
            userId,
          },
        });
      }
    }

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { message: 'Marked as read' };
  }

  /**
   * Get the other participant in a direct conversation
   */
  async getOtherParticipant(
    conversationId: string,
    userId: string,
  ): Promise<string> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        leftAt: null,
      },
      select: {
        userId: true,
      },
    });

    const otherParticipant = participants.find((p) => p.userId !== userId);
    if (!otherParticipant) {
      throw new NotFoundException('Other participant not found');
    }

    return otherParticipant.userId;
  }

  /**
   * Delete a conversation (marks participant as left)
   * In 1-on-1 chats, this is like archiving/hiding the conversation
   */
  async deleteConversation(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Conversation not found');
    }

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        leftAt: new Date(),
      },
    });

    return { message: 'Conversation deleted successfully' };
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      return 0;
    }

    const count = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        createdAt: {
          gt: participant.lastReadAt || participant.joinedAt,
        },
        isDeleted: false,
      },
    });

    return count;
  }

  async searchMessages(conversationId: string, userId: string, query: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return this.prisma.message.findMany({
      where: {
        conversationId,
        content: {
          contains: query,
          mode: 'insensitive',
        },
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
      },
    });
  }
}
