import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ForumNotifications } from 'src/notifications/helpers/notification-helper';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from '../reputation/reputation.service';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private prisma: PrismaService,
    private reputationService: ReputationService,
    private notificationsService: NotificationsService,
  ) {}

  async createCategory(userId: string, dto: CreateCategoryDto) {
    const existing = await this.prisma.forumCategory.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Category with this slug already exists');
    }

    return this.prisma.forumCategory.create({
      data: {
        ...dto,
        creatorId: userId,
      },
    });
  }

  async getCategories() {
    const categories = await this.prisma.forumCategory.findMany({
      where: { isActive: true },
      include: {
        threads: {
          select: {
            id: true,
            _count: {
              select: { posts: true },
            },
          },
        },
        _count: {
          select: { threads: true },
        },
      },
    });

    // Sort categories by popularity and recency
    return (
      categories
        .map((category) => {
          // Calculate popularity score
          const threadCount = category._count.threads;
          const totalPosts = category.threads.reduce(
            (sum, thread) => sum + thread._count.posts,
            0,
          );
          const daysSinceCreation = Math.max(
            1,
            (Date.now() - category.createdAt.getTime()) / (1000 * 60 * 60 * 24),
          );

          // Popularity score: weighted by threads and posts, normalized by age
          const popularityScore =
            (threadCount * 2 + totalPosts) / Math.log10(daysSinceCreation + 10);

          return {
            ...category,
            threads: undefined, // Remove threads from response
            popularityScore,
          };
        })
        .sort((a, b) => {
          // Primary sort: popularity score (descending)
          if (b.popularityScore !== a.popularityScore) {
            return b.popularityScore - a.popularityScore;
          }
          // Secondary sort: creation date (newer first)
          return b.createdAt.getTime() - a.createdAt.getTime();
        })
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ popularityScore, ...category }) => category)
    ); // Remove score from final output
  }

  async getCategory(slug: string, userId?: string) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { slug },
      include: {
        threads: {
          take: 20,
          orderBy: [{ updatedAt: 'desc' }],
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
            _count: {
              select: { posts: true },
            },
            pinnedBy: userId
              ? {
                  where: { userId },
                  select: { pinnedAt: true },
                }
              : false,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Sort threads: pinned by user first, then by updatedAt
    if (userId) {
      category.threads.sort((a, b) => {
        const aPinned = a.pinnedBy.length > 0;
        const bPinned = b.pinnedBy.length > 0;
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
    }

    return category;
  }

  async deleteCategory(categoryId: string, userId: string) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { threads: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.creatorId !== userId) {
      throw new ForbiddenException('You can only delete your own categories');
    }

    if (category._count.threads > 0) {
      throw new BadRequestException(
        `Cannot delete category with ${category._count.threads} existing threads. Please delete or move the threads first.`,
      );
    }

    await this.prisma.forumCategory.delete({
      where: { id: categoryId },
    });

    return { message: 'Category deleted successfully' };
  }

  async createThread(userId: string, dto: CreateThreadDto) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const existingThread = await this.prisma.forumThread.findUnique({
      where: { slug: dto.slug },
    });

    if (existingThread) {
      throw new BadRequestException('Thread with this slug already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const thread = await tx.forumThread.create({
        data: {
          title: dto.title,
          slug: dto.slug,
          categoryId: dto.categoryId,
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

      await tx.forumPost.create({
        data: {
          content: dto.content,
          threadId: thread.id,
          authorId: userId,
        },
      });

      if (dto.tags && dto.tags.length > 0) {
        for (const tagName of dto.tags) {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-');
          let tag = await tx.forumTag.findUnique({ where: { slug } });

          if (!tag) {
            tag = await tx.forumTag.create({
              data: { name: tagName, slug },
            });
          }

          await tx.forumThreadTag.create({
            data: {
              threadId: thread.id,
              tagId: tag.id,
            },
          });
        }
      }

      return thread;
    });
  }

  async getThread(slug: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { slug },
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
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        posts: {
          orderBy: { createdAt: 'asc' },
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

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    await this.prisma.forumThread.update({
      where: { id: thread.id },
      data: { viewCount: { increment: 1 } },
    });

    return thread;
  }

  async updateThread(threadId: string, userId: string, dto: UpdateThreadDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      include: { posts: { orderBy: { createdAt: 'asc' }, take: 1 } },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own threads');
    }

    if (thread.isLocked) {
      throw new ForbiddenException('Thread is locked');
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedThread = await tx.forumThread.update({
        where: { id: threadId },
        data: {
          title: dto.title,
          isLocked: dto.isLocked,
        },
      });

      if (dto.content && thread.posts.length > 0) {
        await tx.forumPost.update({
          where: { id: thread.posts[0].id },
          data: {
            content: dto.content,
            isEdited: true,
          },
        });
      }

      if (dto.tags) {
        await tx.forumThreadTag.deleteMany({
          where: { threadId },
        });

        for (const tagName of dto.tags) {
          const slug = tagName.toLowerCase().replace(/\s+/g, '-');
          let tag = await tx.forumTag.findUnique({ where: { slug } });

          if (!tag) {
            tag = await tx.forumTag.create({
              data: { name: tagName, slug },
            });
          }

          await tx.forumThreadTag.create({
            data: {
              threadId,
              tagId: tag.id,
            },
          });
        }
      }

      return updatedThread;
    });
  }

  async deleteThread(threadId: string, userId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own threads');
    }

    await this.prisma.forumThread.delete({
      where: { id: threadId },
    });

    return { message: 'Thread deleted successfully' };
  }

  async getUserPinnedThreads(userId: string) {
    const pins = await this.prisma.userThreadPin.findMany({
      where: { userId },
      include: {
        thread: {
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
            category: true,
            _count: {
              select: { posts: true },
            },
          },
        },
      },
      orderBy: { pinnedAt: 'desc' },
    });

    return pins.map((pin) => ({
      ...pin.thread,
      pinnedAt: pin.pinnedAt,
    }));
  }

  async togglePinThread(userId: string, threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const existing = await this.prisma.userThreadPin.findUnique({
      where: {
        userId_threadId: {
          userId,
          threadId,
        },
      },
    });

    if (existing) {
      await this.prisma.userThreadPin.delete({
        where: {
          userId_threadId: {
            userId,
            threadId,
          },
        },
      });
      return {
        message: 'Thread unpinned successfully',
        action: 'unpinned',
        isPinned: false,
      };
    }

    await this.prisma.userThreadPin.create({
      data: {
        userId,
        threadId,
      },
    });

    return {
      message: 'Thread pinned successfully',
      action: 'pinned',
      isPinned: true,
    };
  }

  async createPost(userId: string, dto: CreatePostDto) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: dto.threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    if (thread.isLocked) {
      throw new ForbiddenException('Thread is locked');
    }

    const post = await this.prisma.forumPost.create({
      data: {
        content: dto.content,
        threadId: dto.threadId,
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

    await this.prisma.forumThread.update({
      where: { id: dto.threadId },
      data: { updatedAt: new Date() },
    });

    // Award reputation for forum post
    try {
      await this.reputationService.addReputation(userId, 'FORUM_POST', {
        threadId: dto.threadId,
        threadTitle: thread.title,
        postId: post.id,
      });
    } catch (error) {
      this.logger.error('Failed to add reputation for forum post', error);
    }

    return post;
  }

  async updatePost(postId: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: { thread: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (post.thread.isLocked) {
      throw new ForbiddenException('Thread is locked');
    }

    return this.prisma.forumPost.update({
      where: { id: postId },
      data: {
        content: dto.content,
        isEdited: true,
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

  async deletePost(postId: string, userId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: { thread: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    const firstPost = await this.prisma.forumPost.findFirst({
      where: { threadId: post.threadId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstPost?.id === postId) {
      throw new ForbiddenException(
        'Cannot delete the first post. Delete the thread instead.',
      );
    }

    await this.prisma.forumPost.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }

  async addRemoveReaction(userId: string, dto: AddReactionDto) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: dto.postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existing = await this.prisma.forumReaction.findUnique({
      where: {
        postId_userId_emoji: {
          postId: dto.postId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.forumReaction.delete({
        where: { id: existing.id },
      });
      return { message: 'Reaction removed', action: 'removed' };
    }

    await this.prisma.forumReaction.create({
      data: {
        postId: dto.postId,
        userId,
        emoji: dto.emoji,
      },
    });

    return { message: 'Reaction added', action: 'added' };
  }

  async getPostReactions(postId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const reactions = await this.prisma.forumReaction.findMany({
      where: { postId },
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
    });

    // Consolidate reactions by emoji
    const consolidatedReactions = reactions.reduce(
      (acc, reaction) => {
        const emoji = reaction.emoji;
        if (!acc[emoji]) {
          acc[emoji] = {
            emoji,
            count: 0,
            users: [],
          };
        }
        acc[emoji].count++;
        acc[emoji].users.push({
          id: reaction.user.id,
          username: reaction.user.username,
          firstName: reaction.user.firstName,
          lastName: reaction.user.lastName,
          profilePicture: reaction.user.profilePicture,
        });
        return acc;
      },
      {} as Record<string, { emoji: string; count: number; users: any[] }>,
    );

    return {
      postId,
      reactions: Object.values(consolidatedReactions),
      totalReactions: reactions.length,
    };
  }

  async searchThreads(query: string, categoryId?: string) {
    const where: any = {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        {
          posts: {
            some: {
              content: { contains: query, mode: 'insensitive' },
            },
          },
        },
      ],
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    return this.prisma.forumThread.findMany({
      where,
      take: 20,
      orderBy: { updatedAt: 'desc' },
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
        category: true,
        _count: {
          select: { posts: true },
        },
      },
    });
  }

  async getTags() {
    return this.prisma.forumTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { threads: true },
        },
      },
    });
  }

  async getThreadsByTag(tagSlug: string) {
    const tag = await this.prisma.forumTag.findUnique({
      where: { slug: tagSlug },
      include: {
        threads: {
          include: {
            thread: {
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
                category: true,
                _count: {
                  select: { posts: true },
                },
              },
            },
          },
        },
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return {
      tag,
      threads: tag.threads.map((t) => t.thread),
    };
  }

  async createComment(userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: dto.postId },
      include: {
        author: true,
        thread: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.thread.isLocked) {
      throw new ForbiddenException('Thread is locked');
    }

    // If this is a reply, verify parent comment exists
    if (dto.parentId) {
      const parentComment = await this.prisma.forumComment.findUnique({
        where: { id: dto.parentId },
        include: { author: true },
      });

      if (!parentComment) {
        throw new NotFoundException('Parent comment not found');
      }

      if (parentComment.postId !== dto.postId) {
        throw new BadRequestException(
          'Parent comment does not belong to this post',
        );
      }

      // Create the reply comment
      const comment = await this.prisma.forumComment.create({
        data: {
          content: dto.content,
          postId: dto.postId,
          authorId: userId,
          parentId: dto.parentId,
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

      // Send notification to parent comment author
      if (parentComment.authorId !== userId) {
        const commenterName =
          comment.author.username || comment.author.firstName || 'Someone';
        await this.notificationsService.sendNotification(
          ForumNotifications.commentReply(
            parentComment.authorId,
            commenterName,
            {
              commentId: comment.id,
              postId: dto.postId,
              threadId: post.threadId,
              authorId: userId,
            },
          ),
        );
      }

      return comment;
    }

    // Create top-level comment
    const comment = await this.prisma.forumComment.create({
      data: {
        content: dto.content,
        postId: dto.postId,
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

    // Send notification to post author
    if (post.authorId !== userId) {
      const commenterName =
        comment.author.username || comment.author.firstName || 'Someone';
      await this.notificationsService.sendNotification(
        ForumNotifications.postComment(post.authorId, commenterName, {
          commentId: comment.id,
          postId: dto.postId,
          threadId: post.threadId,
          authorId: userId,
        }),
      );
    }

    return comment;
  }

  async getPostComments(postId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comments = await this.prisma.forumComment.findMany({
      where: {
        postId,
        parentId: null, // Only get top-level comments
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
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return comments;
  }

  async updateComment(
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.prisma.forumComment.findUnique({
      where: { id: commentId },
      include: {
        post: {
          include: { thread: true },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    if (comment.post.thread.isLocked) {
      throw new ForbiddenException('Thread is locked');
    }

    return this.prisma.forumComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        isEdited: true,
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

  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.forumComment.findUnique({
      where: { id: commentId },
      include: {
        _count: {
          select: { replies: true },
        },
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    if (comment._count.replies > 0) {
      throw new BadRequestException(
        'Cannot delete comment with replies. Delete the replies first.',
      );
    }

    await this.prisma.forumComment.delete({
      where: { id: commentId },
    });

    return { message: 'Comment deleted successfully' };
  }
}
