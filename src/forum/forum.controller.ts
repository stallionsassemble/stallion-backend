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
import { AddReactionDto } from './dto/add-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { ForumService } from './forum.service';

@ApiTags('Forum')
@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

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
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.forumService.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieve all forum categories',
  })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
    schema: {
      example: [
        {
          id: 'cat-uuid-1',
          name: 'General Discussion',
          slug: 'general-discussion',
          description: 'General topics and discussions',
          icon: '💬',
          threadCount: 42,
          postCount: 156,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'cat-uuid-2',
          name: 'Technical Help',
          slug: 'technical-help',
          description: 'Get help with technical issues',
          icon: '🛠️',
          threadCount: 28,
          postCount: 89,
          createdAt: '2024-01-02T00:00:00.000Z',
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
    description: 'Retrieve a specific category with its threads',
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
  getCategory(@Param('slug') slug: string) {
    return this.forumService.getCategory(slug);
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

  @Get('threads/search')
  @ApiOperation({
    summary: 'Search threads',
    description: 'Search for threads by query and optional category filter',
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
  ) {
    return this.forumService.searchThreads(query, categoryId);
  }

  @Get('threads/:slug')
  @ApiOperation({
    summary: 'Get thread by slug',
    description: 'Retrieve a specific thread with all its posts',
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
          username: 'john_doe',
          firstName: 'John',
          lastName: 'Doe',
          profilePicture: 'https://example.com/profile.jpg',
        },
        posts: [
          {
            id: 'post-uuid',
            content: 'Welcome! Here is how you can get started...',
            authorId: 'user-uuid-2',
            threadId: 'thread-uuid',
            createdAt: '2024-01-01T01:00:00.000Z',
            author: {
              username: 'helper',
              firstName: 'Helper',
              lastName: 'User',
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
  getThread(@Param('slug') slug: string) {
    return this.forumService.getThread(slug);
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
    status: 200,
    description: 'Thread deleted successfully',
    schema: {
      example: {
        message: 'Thread deleted successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Thread not found' })
  deleteThread(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deleteThread(id, userId);
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
    status: 200,
    description: 'Post deleted successfully',
    schema: {
      example: {
        message: 'Post deleted successfully',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  deletePost(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deletePost(id, userId);
  }

  @Post('reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Add reaction',
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
  addReaction(@CurrentUser('id') userId: string, @Body() dto: AddReactionDto) {
    return this.forumService.addReaction(userId, dto);
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
}
