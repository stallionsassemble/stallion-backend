import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  AddReactionDto,
  CreateDiscussionDto,
  CreateReplyDto,
} from './dto/create-discussion.dto';

@Injectable()
export class DiscussionsService {
  constructor(private prisma: PrismaService) {}

  // Create a discussion for bounty or project
  async createDiscussion(userId: string, dto: CreateDiscussionDto) {
    if (!dto.bountyId && !dto.projectId) {
      throw new BadRequestException(
        'Either bountyId or projectId must be provided',
      );
    }

    if (dto.bountyId && dto.projectId) {
      throw new BadRequestException(
        'Cannot provide both bountyId and projectId',
      );
    }

    // Verify bounty or project exists
    if (dto.bountyId) {
      const bounty = await this.prisma.bounty.findUnique({
        where: { id: dto.bountyId },
      });
      if (!bounty) {
        throw new NotFoundException('Bounty not found');
      }

      return this.prisma.bountyDiscussion.create({
        data: {
          content: dto.content,
          bountyId: dto.bountyId,
          authorId: userId,
        },
        include: {
          author: {
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
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      return this.prisma.projectDiscussion.create({
        data: {
          content: dto.content,
          projectId: dto.projectId!,
          authorId: userId,
        },
        include: {
          author: {
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

  // Get discussions for a bounty
  async getBountyDiscussions(bountyId: string, currentUserId?: string) {
    const bounty = await this.prisma.bounty.findUnique({
      where: { id: bountyId },
    });

    if (!bounty) {
      throw new NotFoundException('Bounty not found');
    }

    const discussions = await this.prisma.bountyDiscussion.findMany({
      where: { bountyId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        replies: {
          where: { parentId: null },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
            reactions: {
              select: {
                emoji: true,
                userId: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profilePicture: true,
                  },
                },
                reactions: {
                  select: {
                    emoji: true,
                    userId: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return discussions.map((discussion) => ({
      ...discussion,
      reactions: this.consolidateReactions(discussion.reactions, currentUserId),
      replies: discussion.replies.map((reply) => ({
        ...reply,
        reactions: this.consolidateReactions(reply.reactions, currentUserId),
        replies: reply.replies.map((nestedReply) => ({
          ...nestedReply,
          reactions: this.consolidateReactions(
            nestedReply.reactions,
            currentUserId,
          ),
        })),
      })),
    }));
  }

  // Get discussions for a project
  async getProjectDiscussions(projectId: string, currentUserId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const discussions = await this.prisma.projectDiscussion.findMany({
      where: { projectId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        replies: {
          where: { parentId: null },
          include: {
            author: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true,
                profilePicture: true,
              },
            },
            reactions: {
              select: {
                emoji: true,
                userId: true,
              },
            },
            replies: {
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true,
                    profilePicture: true,
                  },
                },
                reactions: {
                  select: {
                    emoji: true,
                    userId: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return discussions.map((discussion) => ({
      ...discussion,
      reactions: this.consolidateReactions(discussion.reactions, currentUserId),
      replies: discussion.replies.map((reply) => ({
        ...reply,
        reactions: this.consolidateReactions(reply.reactions, currentUserId),
        replies: reply.replies.map((nestedReply) => ({
          ...nestedReply,
          reactions: this.consolidateReactions(
            nestedReply.reactions,
            currentUserId,
          ),
        })),
      })),
    }));
  }

  // Create a reply to a discussion
  async createReply(
    userId: string,
    discussionId: string,
    dto: CreateReplyDto,
    type: 'bounty' | 'project',
  ) {
    // Verify discussion exists
    if (type === 'bounty') {
      const discussion = await this.prisma.bountyDiscussion.findUnique({
        where: { id: discussionId },
      });
      if (!discussion) {
        throw new NotFoundException('Discussion not found');
      }
    } else {
      const discussion = await this.prisma.projectDiscussion.findUnique({
        where: { id: discussionId },
      });
      if (!discussion) {
        throw new NotFoundException('Discussion not found');
      }
    }

    // Verify parent reply exists if provided
    if (dto.parentId) {
      const parentReply = await this.prisma.discussionReply.findUnique({
        where: { id: dto.parentId },
      });
      if (!parentReply) {
        throw new NotFoundException('Parent reply not found');
      }
    }

    return this.prisma.discussionReply.create({
      data: {
        content: dto.content,
        authorId: userId,
        ...(type === 'bounty'
          ? { bountyDiscussionId: discussionId }
          : { projectDiscussionId: discussionId }),
        ...(dto.parentId && { parentId: dto.parentId }),
      },
      include: {
        author: {
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

  // Add/remove reaction to discussion
  async toggleDiscussionReaction(
    userId: string,
    discussionId: string,
    dto: AddReactionDto,
    type: 'bounty' | 'project',
  ) {
    // Verify discussion exists
    if (type === 'bounty') {
      const discussion = await this.prisma.bountyDiscussion.findUnique({
        where: { id: discussionId },
      });
      if (!discussion) {
        throw new NotFoundException('Discussion not found');
      }

      const existing = await this.prisma.discussionReaction.findFirst({
        where: {
          bountyDiscussionId: discussionId,
          userId,
          emoji: dto.emoji,
        },
      });

      if (existing) {
        await this.prisma.discussionReaction.delete({
          where: { id: existing.id },
        });
        return { message: 'Reaction removed', action: 'removed' };
      }

      await this.prisma.discussionReaction.create({
        data: {
          bountyDiscussionId: discussionId,
          userId,
          emoji: dto.emoji,
        },
      });
      return { message: 'Reaction added', action: 'added' };
    } else {
      const discussion = await this.prisma.projectDiscussion.findUnique({
        where: { id: discussionId },
      });
      if (!discussion) {
        throw new NotFoundException('Discussion not found');
      }

      const existing = await this.prisma.discussionReaction.findFirst({
        where: {
          projectDiscussionId: discussionId,
          userId,
          emoji: dto.emoji,
        },
      });

      if (existing) {
        await this.prisma.discussionReaction.delete({
          where: { id: existing.id },
        });
        return { message: 'Reaction removed', action: 'removed' };
      }

      await this.prisma.discussionReaction.create({
        data: {
          projectDiscussionId: discussionId,
          userId,
          emoji: dto.emoji,
        },
      });
      return { message: 'Reaction added', action: 'added' };
    }
  }

  // Add/remove reaction to reply
  async toggleReplyReaction(
    userId: string,
    replyId: string,
    dto: AddReactionDto,
  ) {
    const reply = await this.prisma.discussionReply.findUnique({
      where: { id: replyId },
    });

    if (!reply) {
      throw new NotFoundException('Reply not found');
    }

    const existing = await this.prisma.discussionReaction.findFirst({
      where: {
        replyId,
        userId,
        emoji: dto.emoji,
      },
    });

    if (existing) {
      await this.prisma.discussionReaction.delete({
        where: { id: existing.id },
      });
      return { message: 'Reaction removed', action: 'removed' };
    }

    await this.prisma.discussionReaction.create({
      data: {
        replyId,
        userId,
        emoji: dto.emoji,
      },
    });
    return { message: 'Reaction added', action: 'added' };
  }

  // Helper method to consolidate reactions
  private consolidateReactions(reactions: any[], currentUserId?: string) {
    const consolidated = reactions.reduce(
      (acc, reaction) => {
        const emoji = reaction.emoji;
        if (!acc[emoji]) {
          acc[emoji] = {
            emoji,
            count: 0,
            userIds: [],
            hasReacted: false,
          };
        }
        acc[emoji].count++;
        acc[emoji].userIds.push(reaction.userId);
        if (currentUserId && reaction.userId === currentUserId) {
          acc[emoji].hasReacted = true;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          emoji: string;
          count: number;
          userIds: string[];
          hasReacted: boolean;
        }
      >,
    );

    return Object.values(consolidated);
  }
}
