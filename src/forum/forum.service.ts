import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(private prisma: PrismaService) {}

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.prisma.forumCategory.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('Category with this slug already exists');
    }

    return this.prisma.forumCategory.create({
      data: dto,
    });
  }

  async getCategories() {
    return this.prisma.forumCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { threads: true },
        },
      },
    });
  }

  async getCategory(slug: string) {
    const category = await this.prisma.forumCategory.findUnique({
      where: { slug },
      include: {
        threads: {
          take: 20,
          orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
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
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
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
          isPinned: dto.isPinned || false,
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
          isPinned: dto.isPinned,
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

  async addReaction(userId: string, dto: AddReactionDto) {
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
}
