import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AddReactionDto } from './dto/add-reaction.dto';
import { AddCommentReactionDto } from './dto/comment-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { AddThreadReactionDto } from './dto/thread-reaction.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { ForumService } from './forum.service';

@ApiTags('Forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get forum statistics',
    description: 'Retrieve real-time forum metrics for the community dashboard',
  })
  @ApiResponse({
    status: 200,
    description: 'Forum statistics retrieved successfully',
    schema: {
      example: {
        totalDiscussions: 1250,
        activeMembers: 340,
        postsToday: 45,
        onlineUsers: 82,
      },
    },
  })
  getForumStats() {
    return this.forumService.getForumStats();
  }

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create category',
    description: 'Create a new forum category (requires authentication)',
  })
  @ApiResponse({
    status: 201,
    description: 'Category created successfully',
    schema: {
      example: {
        id: 'cat-uuid',
        name: 'General Discussion',
        slug: 'general-discussion',
        description: 'General topics and discussions',
        icon: '💬',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.forumService.createCategory(userId, dto);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all categories',
    description:
      'Retrieve all forum categories sorted by popularity (thread count, post count) and creation date',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories sorted by popularity',
    schema: {
      example: [
        {
          id: 'cat-uuid-1',
          name: 'General Discussion',
          slug: 'general-discussion',
          description: 'General topics and discussions',
          icon: '💬',
          isActive: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          creatorId: 'user-uuid',
          _count: {
            threads: 42,
          },
        },
        {
          id: 'cat-uuid-2',
          name: 'Technical Help',
          slug: 'technical-help',
          description: 'Get help with technical issues',
          icon: '🛠️',
          isActive: true,
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          creatorId: 'user-uuid',
          _count: {
            threads: 28,
          },
        },
      ],
    },
  })
  getCategories() {
    return this.forumService.getCategories();
  }

  @Get('categories/:slug')
  @ApiOperation({
    summary: 'Get category by slug',
    description:
      'Retrieve a specific category with its threads. If authenticated, includes user-specific pin status.',
  })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiResponse({
    status: 200,
    description: 'Category details',
    schema: {
      example: {
        id: 'cat-uuid',
        name: 'General Discussion',
        slug: 'general-discussion',
        description: 'General topics and discussions',
        icon: '💬',
        threads: [
          {
            id: 'thread-uuid',
            title: 'Welcome to the forum!',
            slug: 'welcome-to-the-forum',
            isPinned: true,
            isLocked: false,
            viewCount: 245,
            postCount: 12,
            author: {
              username: 'admin',
              firstName: 'Admin',
              lastName: 'User',
            },
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  getCategory(@Param('slug') slug: string, @CurrentUser('id') userId?: string) {
    return this.forumService.getCategory(slug, userId);
  }

  @Delete('categories/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete category',
    description: 'Delete a forum category (only if it has no threads)',
  })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 204,
    description: 'Category deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Category has existing threads' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the category creator',
  })
  @ApiResponse({ status: 404, description: 'Category not found' })
  deleteCategory(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deleteCategory(id, userId);
  }

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create thread',
    description: 'Create a new discussion thread in a category',
  })
  @ApiResponse({
    status: 201,
    description: 'Thread created successfully',
    schema: {
      example: {
        id: 'thread-uuid',
        title: 'How to get started with bounties?',
        slug: 'how-to-get-started-with-bounties',
        content:
          'I am new here and would like to know how to participate in bounties...',
        categoryId: 'cat-uuid',
        authorId: 'user-uuid',
        isPinned: false,
        isLocked: false,
        viewCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        author: {
          id: 'user-uuid',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
          role: 'USER',
          postCount: 15,
          reactionCount: 42,
          replyCount: 28,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createThread(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forumService.createThread(userId, dto);
  }

  @Get('threads')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get all threads',
    description:
      'Retrieve all forum threads with pagination and optional category filter. Authentication is optional - if provided, includes hasReacted field in reactions.',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of threads to return (default: 50)',
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: 'Number of threads to skip (default: 0)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of threads with pagination',
    schema: {
      example: {
        threads: [
          {
            id: 'thread-uuid',
            title: 'How to get started with bounties?',
            slug: 'how-to-get-started-with-bounties',
            categoryId: 'cat-uuid',
            category: {
              id: 'cat-uuid',
              name: 'General Discussion',
              slug: 'general-discussion',
            },
            author: {
              id: 'user-uuid',
              username: 'john_doe',
              firstName: 'John',
              lastName: 'Doe',
              profilePicture: 'https://example.com/profile.jpg',
              role: 'USER',
              postCount: 15,
              reactionCount: 42,
              replyCount: 28,
            },
            postCount: 5,
            viewCount: 42,
            isPinned: false,
            isLocked: false,
            createdAt: '2024-01-01T00:00:00.000Z',
            reactions: [
              {
                emoji: '👍',
                count: 5,
                userIds: ['user-1', 'user-2'],
                hasReacted: false,
              },
            ],
            tags: [
              {
                tag: {
                  id: 'tag-uuid',
                  name: 'beginner',
                  slug: 'beginner',
                },
              },
            ],
          },
        ],
        total: 100,
        limit: 50,
        offset: 0,
      },
    },
  })
  getAllThreads(
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.forumService.getAllThreads(
      { categoryId, limit, offset },
      currentUserId,
    );
  }

  @Get('threads/search')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Search threads',
    description:
      'Search for threads by query and optional category filter. Authentication is optional - if provided, includes hasReacted field in reactions.',
  })
  @ApiQuery({ name: 'q', description: 'Search query' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Category ID filter',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      example: [
        {
          id: 'thread-uuid',
          title: 'How to get started with bounties?',
          slug: 'how-to-get-started-with-bounties',
          content: 'I am new here and would like to know...',
          categoryId: 'cat-uuid',
          category: {
            name: 'General Discussion',
            slug: 'general-discussion',
          },
          author: {
            username: 'john_doe',
            firstName: 'John',
            lastName: 'Doe',
          },
          postCount: 5,
          viewCount: 42,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  searchThreads(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.forumService.searchThreads(query, categoryId, currentUserId);
  }

  @Get('threads/pinned')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my pinned threads',
    description: 'Retrieve all threads pinned by the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pinned threads',
    schema: {
      example: [
        {
          id: 'thread-uuid',
          title: 'Important thread',
          slug: 'important-thread',
          author: {
            username: 'john_doe',
            firstName: 'John',
            lastName: 'Doe',
          },
          category: {
            name: 'General Discussion',
            slug: 'general-discussion',
          },
          postCount: 12,
          viewCount: 156,
          pinnedAt: '2024-01-01T00:00:00.000Z',
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUserPinnedThreads(@CurrentUser('id') userId: string) {
    return this.forumService.getUserPinnedThreads(userId);
  }

  @Get('threads/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get thread by slug',
    description:
      'Retrieve a specific thread with all its posts. Authentication is optional - if provided, includes hasReacted field in reactions.',
  })
  @ApiParam({ name: 'slug', description: 'Thread slug' })
  @ApiResponse({
    status: 200,
    description: 'Thread details with posts',
    schema: {
      example: {
        id: 'thread-uuid',
        title: 'How to get started with bounties?',
        slug: 'how-to-get-started-with-bounties',
        content:
          'I am new here and would like to know how to participate in bounties...',
        categoryId: 'cat-uuid',
        authorId: 'user-uuid',
        isPinned: false,
        isLocked: false,
        viewCount: 42,
        createdAt: '2024-01-01T00:00:00.000Z',
        author: {
          id: 'user-uuid',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
          role: 'USER',
          postCount: 15,
          reactionCount: 42,
          replyCount: 28,
        },
        posts: [
          {
            id: 'post-uuid',
            content: 'Welcome! Here is how you can get started...',
            authorId: 'user-uuid-2',
            threadId: 'thread-uuid',
            createdAt: '2024-01-01T01:00:00.000Z',
            author: {
              id: 'user-uuid-2',
              username: 'helper',
              firstName: 'Helper',
              lastName: 'User',
              profilePicture: 'https://example.com/profile2.jpg',
              role: 'USER',
              postCount: 8,
              reactionCount: 20,
              replyCount: 15,
            },
            reactions: [
              {
                type: '👍',
                count: 5,
              },
            ],
          },
        ],
        tags: [
          {
            id: 'tag-uuid',
            name: 'beginner',
            slug: 'beginner',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  getThread(
    @Param('slug') slug: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.forumService.getThread(slug, currentUserId);
  }

  @Patch('threads/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update thread',
    description: 'Update a thread (only by thread author)',
  })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread updated successfully',
    schema: {
      example: {
        id: 'thread-uuid',
        title: 'Updated: How to get started with bounties?',
        slug: 'updated-how-to-get-started-with-bounties',
        content: 'Updated content...',
        updatedAt: '2024-01-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  updateThread(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forumService.updateThread(id, userId, dto);
  }

  @Delete('threads/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete thread',
    description: 'Delete a thread (only by thread author)',
  })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 204,
    description: 'Thread deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  deleteThread(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deleteThread(id, userId);
  }

  @Patch('threads/:id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Toggle pin thread',
    description: 'Pin or unpin a thread for the current user',
  })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 200,
    description: 'Thread pin status toggled successfully',
    schema: {
      example: {
        message: 'Thread pinned successfully',
        action: 'pinned',
        isPinned: true,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  togglePinThread(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.togglePinThread(userId, id);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create post',
    description: 'Create a new post in a thread',
  })
  @ApiResponse({
    status: 201,
    description: 'Post created successfully',
    schema: {
      example: {
        id: 'post-uuid',
        content: 'This is my reply to the thread...',
        authorId: 'user-uuid',
        threadId: 'thread-uuid',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        author: {
          id: 'user-uuid',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
          role: 'USER',
          postCount: 15,
          reactionCount: 42,
          replyCount: 28,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createPost(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.forumService.createPost(userId, dto);
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update post',
    description: 'Update a post (only by post author)',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post updated successfully',
    schema: {
      example: {
        id: 'post-uuid',
        content: 'Updated post content...',
        updatedAt: '2024-01-01T12:00:00.000Z',
        author: {
          id: 'user-uuid',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
          role: 'USER',
          postCount: 15,
          reactionCount: 42,
          replyCount: 28,
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  updatePost(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(id, userId, dto);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete post',
    description: 'Delete a post (only by post author)',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 204,
    description: 'Post deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  deletePost(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deletePost(id, userId);
  }

  @Get('posts/:id/reactions')
  @ApiOperation({
    summary: 'Get post reactions',
    description: 'Retrieve all reactions for a post with consolidated counts',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'Post reactions retrieved successfully',
    schema: {
      example: {
        postId: 'post-uuid',
        reactions: [
          {
            emoji: '👍',
            count: 5,
            users: [
              {
                id: 'user-uuid-1',
                username: 'john_doe',
                firstName: 'John',
                lastName: 'Doe',
                profilePicture: 'https://example.com/pic.jpg',
              },
            ],
          },
          {
            emoji: '❤️',
            count: 3,
            users: [
              {
                id: 'user-uuid-2',
                username: 'jane_smith',
                firstName: 'Jane',
                lastName: 'Smith',
                profilePicture: null,
              },
            ],
          },
        ],
        totalReactions: 8,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  getPostReactions(@Param('id') id: string) {
    return this.forumService.getPostReactions(id);
  }

  @Patch('reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add/Remove reaction',
    description: 'Add or remove a reaction to a post',
  })
  @ApiResponse({
    status: 201,
    description: 'Reaction added successfully',
    schema: {
      example: {
        id: 'reaction-uuid',
        type: '👍',
        postId: 'post-uuid',
        userId: 'user-uuid',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addRemoveReaction(
    @CurrentUser('id') userId: string,
    @Body() dto: AddReactionDto,
  ) {
    return this.forumService.addRemoveReaction(userId, dto);
  }

  @Get('tags')
  @ApiOperation({
    summary: 'Get all tags',
    description: 'Retrieve all available thread tags',
  })
  @ApiResponse({
    status: 200,
    description: 'List of tags',
    schema: {
      example: [
        {
          id: 'tag-uuid-1',
          name: 'beginner',
          slug: 'beginner',
          threadCount: 15,
        },
        {
          id: 'tag-uuid-2',
          name: 'tutorial',
          slug: 'tutorial',
          threadCount: 8,
        },
      ],
    },
  })
  getTags() {
    return this.forumService.getTags();
  }

  @Get('tags/:slug')
  @ApiOperation({
    summary: 'Get threads by tag',
    description: 'Retrieve all threads with a specific tag',
  })
  @ApiParam({ name: 'slug', description: 'Tag slug' })
  @ApiResponse({
    status: 200,
    description: 'List of threads',
    schema: {
      example: [
        {
          id: 'thread-uuid',
          title: 'Beginner guide to bounties',
          slug: 'beginner-guide-to-bounties',
          content: 'This is a comprehensive guide...',
          author: {
            username: 'john_doe',
            firstName: 'John',
            lastName: 'Doe',
          },
          postCount: 12,
          viewCount: 156,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  getThreadsByTag(@Param('slug') slug: string) {
    return this.forumService.getThreadsByTag(slug);
  }

  @Post('comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create comment',
    description: 'Create a comment on a post or reply to another comment',
  })
  @ApiResponse({
    status: 201,
    description: 'Comment created successfully',
    schema: {
      example: {
        id: 'comment-uuid',
        content: 'This is a great post!',
        postId: 'post-uuid',
        authorId: 'user-uuid',
        parentId: null,
        author: {
          id: 'user-uuid',
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/pic.jpg',
          role: 'USER',
          postCount: 15,
          reactionCount: 42,
          replyCount: 28,
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post or parent comment not found' })
  createComment(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.forumService.createComment(userId, dto);
  }

  @Get('posts/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get post comments',
    description:
      'Retrieve all comments for a post with nested replies. Authentication is optional - if provided, includes hasReacted field in reactions.',
  })
  @ApiParam({ name: 'id', description: 'Post ID' })
  @ApiResponse({
    status: 200,
    description: 'List of comments with nested replies',
    schema: {
      example: [
        {
          id: 'comment-uuid-1',
          content: 'Great post!',
          postId: 'post-uuid',
          authorId: 'user-uuid-1',
          parentId: null,
          isEdited: false,
          author: {
            id: 'user-uuid-1',
            username: 'john_doe',
            firstName: 'John',
            lastName: 'Doe',
            profilePicture: 'https://example.com/profile.jpg',
            role: 'USER',
            postCount: 15,
            reactionCount: 42,
            replyCount: 28,
          },
          replies: [
            {
              id: 'comment-uuid-2',
              content: 'Thanks!',
              postId: 'post-uuid',
              authorId: 'user-uuid-2',
              parentId: 'comment-uuid-1',
              isEdited: false,
              author: {
                id: 'user-uuid-2',
                username: 'jane_smith',
                firstName: 'Jane',
                lastName: 'Smith',
                profilePicture: null,
                role: 'USER',
                postCount: 8,
                reactionCount: 20,
                replyCount: 15,
              },
              replies: [],
              createdAt: '2024-01-01T00:05:00.000Z',
            },
          ],
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({ status: 404, description: 'Post not found' })
  getPostComments(
    @Param('id') postId: string,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.forumService.getPostComments(postId, currentUserId);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update comment',
    description: 'Update a comment (only by comment author)',
  })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({
    status: 200,
    description: 'Comment updated successfully',
    schema: {
      example: {
        id: 'comment-uuid',
        content: 'Updated comment content...',
        isEdited: true,
        updatedAt: '2024-01-01T12:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the comment author',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  updateComment(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.forumService.updateComment(id, userId, dto);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete comment',
    description: 'Delete a comment (only by comment author)',
  })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({
    status: 204,
    description: 'Comment deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not the comment author',
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  deleteComment(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deleteComment(id, userId);
  }

  @Post('comments/:id/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add/Remove comment reaction',
    description:
      'Add or remove a reaction to a comment. If the reaction already exists, it will be removed.',
  })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiResponse({
    status: 201,
    description: 'Reaction added or removed successfully',
    schema: {
      example: {
        message: 'Reaction added',
        action: 'added',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  addRemoveCommentReaction(
    @Param('id') commentId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddCommentReactionDto,
  ) {
    return this.forumService.addRemoveCommentReaction(userId, commentId, dto);
  }

  @Get('comments/:id/reactions')
  @ApiOperation({
    summary: 'Get comment reactions',
    description: 'Get all reactions for a specific comment, grouped by emoji',
  })
  @ApiParam({ name: 'id', description: 'Comment ID' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User ID to check if they have reacted',
  })
  @ApiResponse({
    status: 200,
    description: 'Comment reactions retrieved successfully',
    schema: {
      example: {
        commentId: 'comment-uuid',
        reactions: [
          {
            emoji: '👍',
            count: 3,
            userIds: ['user-1', 'user-2', 'user-3'],
            hasReacted: false,
          },
          {
            emoji: '❤️',
            count: 2,
            userIds: ['user-4', 'user-5'],
            hasReacted: true,
          },
        ],
        totalReactions: 5,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  getCommentReactions(
    @Param('id') commentId: string,
    @Query('userId') userId?: string,
  ) {
    return this.forumService.getCommentReactions(commentId, userId);
  }

  @Post('threads/:id/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add/Remove thread reaction',
    description:
      'Add or remove a reaction to a thread. If the reaction already exists, it will be removed.',
  })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiResponse({
    status: 201,
    description: 'Reaction added or removed successfully',
    schema: {
      example: {
        message: 'Reaction added',
        action: 'added',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  addRemoveThreadReaction(
    @Param('id') threadId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: AddThreadReactionDto,
  ) {
    return this.forumService.addRemoveThreadReaction(userId, threadId, dto);
  }

  @Get('threads/:id/reactions')
  @ApiOperation({
    summary: 'Get thread reactions',
    description: 'Get all reactions for a specific thread, grouped by emoji',
  })
  @ApiParam({ name: 'id', description: 'Thread ID' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'User ID to check if they have reacted',
  })
  @ApiResponse({
    status: 200,
    description: 'Thread reactions retrieved successfully',
    schema: {
      example: {
        threadId: 'thread-uuid',
        reactions: [
          {
            emoji: '👍',
            count: 5,
            userIds: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
            users: [
              {
                id: 'user-1',
                username: 'john_doe',
                firstName: 'John',
                lastName: 'Doe',
                profilePicture: 'https://example.com/avatar.jpg',
              },
            ],
            hasReacted: true,
          },
          {
            emoji: '❤️',
            count: 3,
            userIds: ['user-6', 'user-7', 'user-8'],
            users: [],
            hasReacted: false,
          },
        ],
        totalReactions: 8,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  getThreadReactions(
    @Param('id') threadId: string,
    @Query('userId') userId?: string,
  ) {
    return this.forumService.getThreadReactions(threadId, userId);
  }
}
