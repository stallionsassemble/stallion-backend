import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CommentReaction,
  ForumReaction,
  Prisma,
  ThreadReaction,
  User,
} from '@prisma/client';
import { ForumNotifications } from 'src/notifications/helpers/notification-helper';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReputationService } from '../reputation/reputation.service';
import { AddForumReactionDto } from './dto/add-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { AddThreadReactionDto } from './dto/thread-reaction.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { enrichAuthorData } from './utils/author-enrichment.util';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(
    private prisma: PrismaService,
    private reputationService: ReputationService,
    private notificationsService: NotificationsService,
  ) {}

  async getForumStats() {
    // Total discussions (threads) ever created
    const totalDiscussions = await this.prisma.forumThread.count();

    // Active members: unique users who have posted/replied/reacted in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      activeThreadAuthors,
      activePostAuthors,
      activeCommentAuthors,
      activeReactors,
    ] = await Promise.all([
      this.prisma.forumThread.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumPost.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumComment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumReaction.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    // Combine all unique user IDs
    const activeUserIds = new Set([
      ...activeThreadAuthors.map((t) => t.authorId),
      ...activePostAuthors.map((p) => p.authorId),
      ...activeCommentAuthors.map((c) => c.authorId),
      ...activeReactors.map((r) => r.userId),
    ]);

    const activeMembers = activeUserIds.size;

    // Posts today: threads + posts + comments created since 00:00 UTC today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [threadsToday, postsToday, commentsToday] = await Promise.all([
      this.prisma.forumThread.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.forumPost.count({
        where: { createdAt: { gte: todayStart } },
      }),
      this.prisma.forumComment.count({
        where: { createdAt: { gte: todayStart } },
      }),
    ]);

    const postsTodayTotal = threadsToday + postsToday + commentsToday;

    // Online users: count of users with recent activity (last 5 minutes)
    // This is a simple approximation based on recent forum activity
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);

    const [
      recentThreadAuthors,
      recentPostAuthors,
      recentCommentAuthors,
      recentReactors,
    ] = await Promise.all([
      this.prisma.forumThread.findMany({
        where: { createdAt: { gte: fiveMinutesAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumPost.findMany({
        where: { createdAt: { gte: fiveMinutesAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumComment.findMany({
        where: { createdAt: { gte: fiveMinutesAgo } },
        select: { authorId: true },
        distinct: ['authorId'],
      }),
      this.prisma.forumReaction.findMany({
        where: { createdAt: { gte: fiveMinutesAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const onlineUserIds = new Set([
      ...recentThreadAuthors.map((t) => t.authorId),
      ...recentPostAuthors.map((p) => p.authorId),
      ...recentCommentAuthors.map((c) => c.authorId),
      ...recentReactors.map((r) => r.userId),
    ]);

    const onlineUsers = onlineUserIds.size;

    return {
      totalDiscussions,
      activeMembers,
      postsToday: postsTodayTotal,
      onlineUsers,
    };
  }

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
          content: dto.content,
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
              role: true,
            },
          },
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

  async getAllThreads(
    params?: {
      categoryId?: string;
      limit?: number;
      offset?: number;
    },
    currentUserId?: string,
  ) {
    const { categoryId, limit = 50, offset = 0 } = params || {};

    const threads = await this.prisma.forumThread.findMany({
      where: categoryId ? { categoryId } : undefined,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            role: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    // Enrich author data with stats and add reactions
    const enrichedThreads = await Promise.all(
      threads.map(async (thread) => {
        const enrichedAuthor = await enrichAuthorData(
          this.prisma,
          thread.author,
        );

        const consolidatedReactions = await this.consolidateReactions(
          thread.reactions,
          currentUserId,
        );

        return {
          ...thread,
          author: enrichedAuthor,
          postCount: thread._count.posts,
          reactions: consolidatedReactions,
        };
      }),
    );

    const total = await this.prisma.forumThread.count({
      where: categoryId ? { categoryId } : undefined,
    });

    return {
      threads: enrichedThreads,
      total,
      limit,
      offset,
    };
  }

  async getThread(slug: string, currentUserId?: string) {
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
            role: true,
          },
        },
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        reactions: {
          select: {
            emoji: true,
            userId: true,
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
                role: true,
              },
            },
            reactions: {
              select: {
                emoji: true,
                userId: true,
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

    // Enrich author data
    const enrichedAuthor = await enrichAuthorData(this.prisma, thread.author);

    // Consolidate thread reactions
    const threadReactions = await this.consolidateReactions(
      thread.reactions,
      currentUserId,
    );

    // Enrich post authors and consolidate post reactions
    const enrichedPosts = await Promise.all(
      thread.posts.map(async (post) => {
        const enrichedPostAuthor = await enrichAuthorData(
          this.prisma,
          post.author,
        );
        const postReactions = await this.consolidateReactions(
          post.reactions,
          currentUserId,
        );
        return {
          ...post,
          author: enrichedPostAuthor,
          reactions: postReactions,
        };
      }),
    );

    return {
      ...thread,
      author: enrichedAuthor,
      reactions: threadReactions,
      posts: enrichedPosts,
    };
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
          content: dto.content,
          isLocked: dto.isLocked,
        },
      });

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
            role: true,
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

    // Enrich author data
    const enrichedAuthor = await enrichAuthorData(this.prisma, post.author);

    return {
      ...post,
      author: enrichedAuthor,
    };
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

    const updatedPost = await this.prisma.forumPost.update({
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
            role: true,
          },
        },
      },
    });

    // Enrich author data
    const enrichedAuthor = await enrichAuthorData(
      this.prisma,
      updatedPost.author,
    );

    return {
      ...updatedPost,
      author: enrichedAuthor,
    };
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

  async addRemoveReaction(userId: string, dto: AddForumReactionDto) {
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
      {} as Record<
        string,
        {
          emoji: string;
          count: number;
          users: Pick<
            User,
            'id' | 'username' | 'firstName' | 'lastName' | 'profilePicture'
          >[];
        }
      >,
    );

    return {
      postId,
      reactions: Object.values(consolidatedReactions),
      totalReactions: reactions.length,
    };
  }

  async searchThreads(
    query: string,
    categoryId?: string,
    currentUserId?: string,
  ) {
    const where: Prisma.ForumThreadWhereInput = {
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

    const threads = await this.prisma.forumThread.findMany({
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
        reactions: {
          select: {
            emoji: true,
            userId: true,
          },
        },
        _count: {
          select: { posts: true },
        },
      },
    });

    // Add reactions to each thread
    const threadsWithReactions = await Promise.all(
      threads.map(async (thread) => {
        const consolidatedReactions = await this.consolidateReactions(
          thread.reactions,
          currentUserId,
        );
        return {
          ...thread,
          reactions: consolidatedReactions,
        };
      }),
    );

    return threadsWithReactions;
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
              role: true,
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

      // Enrich author data
      const enrichedAuthor = await enrichAuthorData(
        this.prisma,
        comment.author,
      );

      return {
        ...comment,
        author: enrichedAuthor,
      };
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
            role: true,
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

    // Enrich author data
    const enrichedAuthor = await enrichAuthorData(this.prisma, comment.author);

    return {
      ...comment,
      author: enrichedAuthor,
    };
  }

  async getPostComments(postId: string, currentUserId?: string) {
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
            role: true,
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
                role: true,
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
                    role: true,
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
        _count: {
          select: { replies: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enrich all comment authors and add reactions recursively
    const enrichedComments = await Promise.all(
      comments.map(async (comment) => {
        const enrichedAuthor = await enrichAuthorData(
          this.prisma,
          comment.author,
        );
        const commentReactions = await this.consolidateReactions(
          comment.reactions,
          currentUserId,
        );

        const enrichedReplies = await Promise.all(
          comment.replies.map(async (reply) => {
            const enrichedReplyAuthor = await enrichAuthorData(
              this.prisma,
              reply.author,
            );
            const replyReactions = await this.consolidateReactions(
              reply.reactions,
              currentUserId,
            );

            const enrichedNestedReplies = await Promise.all(
              reply.replies.map(async (nestedReply) => {
                const enrichedNestedAuthor = await enrichAuthorData(
                  this.prisma,
                  nestedReply.author,
                );
                const nestedReactions = await this.consolidateReactions(
                  nestedReply.reactions,
                  currentUserId,
                );
                return {
                  ...nestedReply,
                  author: enrichedNestedAuthor,
                  reactions: nestedReactions,
                };
              }),
            );

            return {
              ...reply,
              author: enrichedReplyAuthor,
              reactions: replyReactions,
              replies: enrichedNestedReplies,
            };
          }),
        );

        return {
          ...comment,
          author: enrichedAuthor,
          reactions: commentReactions,
          replies: enrichedReplies,
        };
      }),
    );

    return enrichedComments;
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

    const updatedComment = await this.prisma.forumComment.update({
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
            role: true,
          },
        },
      },
    });

    // Enrich author data
    const enrichedAuthor = await enrichAuthorData(
      this.prisma,
      updatedComment.author,
    );

    return {
      ...updatedComment,
      author: enrichedAuthor,
    };
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

  async addRemoveThreadReaction(
    userId: string,
    threadId: string,
    dto: AddThreadReactionDto,
  ) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const existing = await this.prisma.threadReaction.findUnique({
      where: {
        threadId_userId_emoji: {
          threadId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.threadReaction.delete({
        where: { id: existing.id },
      });
      return { message: 'Reaction removed', action: 'removed' };
    }

    await this.prisma.threadReaction.create({
      data: {
        threadId,
        userId,
        emoji: dto.emoji,
      },
    });

    return { message: 'Reaction added', action: 'added' };
  }

  private async consolidateReactions(
    reactions: (
      | ThreadReaction
      | Pick<CommentReaction, 'emoji' | 'userId'>
      | Pick<ForumReaction, 'emoji' | 'userId'>
    )[],
    currentUserId?: string,
  ) {
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

  async getThreadReactions(threadId: string, currentUserId?: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const reactions = await this.prisma.threadReaction.findMany({
      where: { threadId },
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
            userIds: [],
            users: [],
            hasReacted: false,
          };
        }
        acc[emoji].count++;
        acc[emoji].userIds.push(reaction.userId);
        acc[emoji].users.push({
          id: reaction.user.id,
          username: reaction.user.username,
          firstName: reaction.user.firstName,
          lastName: reaction.user.lastName,
          profilePicture: reaction.user.profilePicture,
        });
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
          users: Pick<
            User,
            'id' | 'username' | 'firstName' | 'lastName' | 'profilePicture'
          >[];
          hasReacted: boolean;
        }
      >,
    );

    return {
      threadId,
      reactions: Object.values(consolidatedReactions),
      totalReactions: reactions.length,
    };
  }

  async addRemoveCommentReaction(
    userId: string,
    commentId: string,
    dto: { emoji: string },
  ) {
    const comment = await this.prisma.forumComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const existing = await this.prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji: dto.emoji,
        },
      },
    });

    if (existing) {
      await this.prisma.commentReaction.delete({
        where: { id: existing.id },
      });
      return { message: 'Reaction removed', action: 'removed' };
    }

    await this.prisma.commentReaction.create({
      data: {
        commentId,
        userId,
        emoji: dto.emoji,
      },
    });

    return { message: 'Reaction added', action: 'added' };
  }

  async getCommentReactions(commentId: string, currentUserId?: string) {
    const comment = await this.prisma.forumComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    const reactions = await this.prisma.commentReaction.findMany({
      where: { commentId },
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
            userIds: [],
            users: [],
            hasReacted: false,
          };
        }
        acc[emoji].count++;
        acc[emoji].userIds.push(reaction.userId);
        acc[emoji].users.push({
          id: reaction.user.id,
          username: reaction.user.username,
          firstName: reaction.user.firstName,
          lastName: reaction.user.lastName,
          profilePicture: reaction.user.profilePicture,
        });
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
          users: Pick<
            User,
            'id' | 'username' | 'firstName' | 'lastName' | 'profilePicture'
          >[];
          hasReacted: boolean;
        }
      >,
    );

    return {
      commentId,
      reactions: Object.values(consolidatedReactions),
      totalReactions: reactions.length,
    };
  }
}
