import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType, ParticipantRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService?: any,
  ) {}

  async createConversation(userId: string, dto: CreateConversationDto) {
    if (
      dto.type === ConversationType.DIRECT &&
      dto.participantIds.length !== 1
    ) {
      throw new BadRequestException(
        'Direct conversations must have exactly one other participant',
      );
    }

    if (!dto.participantIds.includes(userId)) {
      dto.participantIds.push(userId);
    }

    if (dto.type === ConversationType.DIRECT) {
      const existingConversation = await this.findDirectConversation(
        userId,
        dto.participantIds[0] === userId
          ? dto.participantIds[1]
          : dto.participantIds[0],
      );

      if (existingConversation) {
        return existingConversation;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          type: dto.type,
          name: dto.name,
          avatar: dto.avatar,
        },
      });

      for (const participantId of dto.participantIds) {
        await tx.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: participantId,
            role:
              participantId === userId
                ? ParticipantRole.ADMIN
                : ParticipantRole.MEMBER,
          },
        });
      }

      return this.getConversation(conversation.id, userId);
    });
  }

  async findDirectConversation(userId1: string, userId2: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: ConversationType.DIRECT,
        participants: {
          every: {
            userId: {
              in: [userId1, userId2],
            },
          },
        },
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

    return participants.map((p) => {
      const conversation = p.conversation;
      const unreadCount = this.getUnreadCount(conversation.id, userId);

      return {
        ...conversation,
        unreadCount,
        lastReadAt: p.lastReadAt,
      };
    });
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

  async sendMessage(userId: string, dto: SendMessageDto) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId,
        },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderId: userId,
        content: dto.content,
        type: dto.type || 'TEXT',
        attachments: dto.attachments,
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

    await this.prisma.conversation.update({
      where: { id: dto.conversationId },
      data: { updatedAt: new Date() },
    });

    await this.prisma.messageReadReceipt.create({
      data: {
        messageId: message.id,
        userId,
      },
    });

    return message;
  }

  async updateMessage(
    messageId: string,
    userId: string,
    dto: UpdateMessageDto,
  ) {
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
        content: dto.content,
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

  async addParticipants(userId: string, dto: AddParticipantsDto) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: dto.conversationId,
          userId,
        },
      },
    });

    if (!participant || participant.role !== ParticipantRole.ADMIN) {
      throw new ForbiddenException('Only admins can add participants');
    }

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (conversation?.type === ConversationType.DIRECT) {
      throw new BadRequestException(
        'Cannot add participants to direct conversations',
      );
    }

    for (const newUserId of dto.userIds) {
      const existing = await this.prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: dto.conversationId,
            userId: newUserId,
          },
        },
      });

      if (!existing) {
        await this.prisma.conversationParticipant.create({
          data: {
            conversationId: dto.conversationId,
            userId: newUserId,
            role: ParticipantRole.MEMBER,
          },
        });

        await this.prisma.message.create({
          data: {
            conversationId: dto.conversationId,
            senderId: userId,
            content: `Added user to the conversation`,
            type: 'SYSTEM',
          },
        });
      }
    }

    return { message: 'Participants added successfully' };
  }

  async leaveConversation(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!participant) {
      throw new NotFoundException('Participant not found');
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

    await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: 'Left the conversation',
        type: 'SYSTEM',
      },
    });

    return { message: 'Left conversation successfully' };
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
