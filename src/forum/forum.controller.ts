import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { type RequestUser } from 'src/auth/interfaces/jwt-payload.interface';
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
  createThread(@CurrentUser() user: RequestUser, @Body() dto: CreateThreadDto) {
    return this.forumService.createThread(user.id, dto);
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
    @Request() req,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forumService.updateThread(id, req.user.userId, dto);
  }

  @Delete('threads/:id')
  @UseGuards(JwtAuthGuard)
  deleteThread(@Param('id') id: string, @Request() req) {
    return this.forumService.deleteThread(id, req.user.userId);
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  createPost(@Request() req, @Body() dto: CreatePostDto) {
    return this.forumService.createPost(req.user.userId, dto);
  }

  @Put('posts/:id')
  @UseGuards(JwtAuthGuard)
  updatePost(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forumService.updatePost(id, req.user.userId, dto);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  deletePost(@Param('id') id: string, @Request() req) {
    return this.forumService.deletePost(id, req.user.userId);
  }

  @Post('reactions')
  @UseGuards(JwtAuthGuard)
  addReaction(@CurrentUser() user: RequestUser, @Body() dto: AddReactionDto) {
    return this.forumService.addReaction(user.id, dto);
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
