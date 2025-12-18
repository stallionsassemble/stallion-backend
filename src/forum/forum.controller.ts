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
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.forumService.createCategory(dto);
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get all categories',
    description: 'Retrieve all forum categories',
  })
  @ApiResponse({ status: 200, description: 'List of categories' })
  getCategories() {
    return this.forumService.getCategories();
  }

  @Get('categories/:slug')
  @ApiOperation({
    summary: 'Get category by slug',
    description: 'Retrieve a specific category with its threads',
  })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  @ApiResponse({ status: 200, description: 'Category details' })
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
  @ApiResponse({ status: 201, description: 'Thread created successfully' })
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
  @ApiResponse({ status: 200, description: 'Search results' })
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
  @ApiResponse({ status: 200, description: 'Thread details with posts' })
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
  @ApiResponse({ status: 200, description: 'Thread updated successfully' })
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
  @ApiResponse({ status: 200, description: 'Thread deleted successfully' })
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
  @ApiResponse({ status: 201, description: 'Post created successfully' })
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
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
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
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
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
  @ApiResponse({ status: 201, description: 'Reaction added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  addReaction(@CurrentUser('id') userId: string, @Body() dto: AddReactionDto) {
    return this.forumService.addReaction(userId, dto);
  }

  @Get('tags')
  @ApiOperation({
    summary: 'Get all tags',
    description: 'Retrieve all available thread tags',
  })
  @ApiResponse({ status: 200, description: 'List of tags' })
  getTags() {
    return this.forumService.getTags();
  }

  @Get('tags/:slug')
  @ApiOperation({
    summary: 'Get threads by tag',
    description: 'Retrieve all threads with a specific tag',
  })
  @ApiParam({ name: 'slug', description: 'Tag slug' })
  @ApiResponse({ status: 200, description: 'List of threads' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  getThreadsByTag(@Param('slug') slug: string) {
    return this.forumService.getThreadsByTag(slug);
  }
}
