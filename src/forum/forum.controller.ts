import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AddReactionDto } from './dto/add-reaction.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { ForumService } from './forum.service';

@Controller('forum')
export class ForumController {
  constructor(private readonly forumService: ForumService) {}

  @Post('categories')
  @UseGuards(JwtAuthGuard)
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.forumService.createCategory(dto);
  }

  @Get('categories')
  getCategories() {
    return this.forumService.getCategories();
  }

  @Get('categories/:slug')
  getCategory(@Param('slug') slug: string) {
    return this.forumService.getCategory(slug);
  }

  @Post('threads')
  @UseGuards(JwtAuthGuard)
  createThread(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forumService.createThread(userId, dto);
  }

  @Get('threads/search')
  searchThreads(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.forumService.searchThreads(query, categoryId);
  }

  @Get('threads/:slug')
  getThread(@Param('slug') slug: string) {
    return this.forumService.getThread(slug);
  }

  @Put('threads/:id')
  @UseGuards(JwtAuthGuard)
  updateThread(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forumService.updateThread(id, userId, dto);
  }

  @Delete('threads/:id')
  @UseGuards(JwtAuthGuard)
  deleteThread(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deleteThread(id, userId);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  createPost(@CurrentUser('id') userId: string, @Body() dto: CreatePostDto) {
    return this.forumService.createPost(userId, dto);
  }

  @Put('posts/:id')
  @UseGuards(JwtAuthGuard)
  updatePost(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(id, userId, dto);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  deletePost(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.forumService.deletePost(id, userId);
  }

  @Post('reactions')
  @UseGuards(JwtAuthGuard)
  addReaction(@CurrentUser('id') userId: string, @Body() dto: AddReactionDto) {
    return this.forumService.addReaction(userId, dto);
  }

  @Get('tags')
  getTags() {
    return this.forumService.getTags();
  }

  @Get('tags/:slug')
  getThreadsByTag(@Param('slug') slug: string) {
    return this.forumService.getThreadsByTag(slug);
  }
}
