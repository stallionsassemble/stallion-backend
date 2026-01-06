import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { DiscussionsService } from './discussions.service';
import { BountyIdParamDto } from './dto/bounty-id-param.dto';
import {
  AddDiscussionReactionDto,
  CreateDiscussionDto,
  CreateReplyDto,
} from './dto/create-discussion.dto';
import { DiscussionIdParamDto } from './dto/discussion-id-param.dto';
import { ProjectIdParamDto } from './dto/project-id-param.dto';
import { ReplyIdParamDto } from './dto/reply-id-param.dto';

@ApiTags('Discussions')
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a discussion',
    description: 'Create a discussion for a bounty or project',
  })
  @ApiResponse({ status: 201, description: 'Discussion created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Bounty or project not found' })
  createDiscussion(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDiscussionDto,
  ) {
    return this.discussionsService.createDiscussion(userId, dto);
  }

  @Get('bounty/:bountyId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get bounty discussions',
    description:
      'Get all discussions for a bounty with nested replies and reactions',
  })
  @ApiParam({ name: 'bountyId', description: 'Bounty ID' })
  @ApiResponse({
    status: 200,
    description: 'Discussions retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Bounty not found' })
  getBountyDiscussions(
    @Param() params: BountyIdParamDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.discussionsService.getBountyDiscussions(
      params.bountyId,
      currentUserId,
    );
  }

  @Get('project/:projectId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Get project discussions',
    description:
      'Get all discussions for a project with nested replies and reactions',
  })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  @ApiResponse({
    status: 200,
    description: 'Discussions retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  getProjectDiscussions(
    @Param() params: ProjectIdParamDto,
    @CurrentUser('id') currentUserId?: string,
  ) {
    return this.discussionsService.getProjectDiscussions(
      params.projectId,
      currentUserId,
    );
  }

  @Post('bounty/:discussionId/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reply to bounty discussion',
    description: 'Create a reply to a bounty discussion',
  })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({ status: 201, description: 'Reply created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  replyToBountyDiscussion(
    @CurrentUser('id') userId: string,
    @Param() params: DiscussionIdParamDto,
    @Body() dto: CreateReplyDto,
  ) {
    return this.discussionsService.createReply(
      userId,
      params.discussionId,
      dto,
      'bounty',
    );
  }

  @Post('project/:discussionId/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Reply to project discussion',
    description: 'Create a reply to a project discussion',
  })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({ status: 201, description: 'Reply created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  replyToProjectDiscussion(
    @CurrentUser('id') userId: string,
    @Param() params: DiscussionIdParamDto,
    @Body() dto: CreateReplyDto,
  ) {
    return this.discussionsService.createReply(
      userId,
      params.discussionId,
      dto,
      'project',
    );
  }

  @Post('bounty/:discussionId/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'React to bounty discussion',
    description: 'Add or remove a reaction to a bounty discussion',
  })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({
    status: 201,
    description: 'Reaction added or removed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  reactToBountyDiscussion(
    @CurrentUser('id') userId: string,
    @Param() params: DiscussionIdParamDto,
    @Body() dto: AddDiscussionReactionDto,
  ) {
    return this.discussionsService.toggleDiscussionReaction(
      userId,
      params.discussionId,
      dto,
      'bounty',
    );
  }

  @Post('project/:discussionId/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'React to project discussion',
    description: 'Add or remove a reaction to a project discussion',
  })
  @ApiParam({ name: 'discussionId', description: 'Discussion ID' })
  @ApiResponse({
    status: 201,
    description: 'Reaction added or removed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Discussion not found' })
  reactToProjectDiscussion(
    @CurrentUser('id') userId: string,
    @Param() params: DiscussionIdParamDto,
    @Body() dto: AddDiscussionReactionDto,
  ) {
    return this.discussionsService.toggleDiscussionReaction(
      userId,
      params.discussionId,
      dto,
      'project',
    );
  }

  @Post('reply/:replyId/react')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'React to reply',
    description: 'Add or remove a reaction to a discussion reply',
  })
  @ApiParam({ name: 'replyId', description: 'Reply ID' })
  @ApiResponse({
    status: 201,
    description: 'Reaction added or removed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Reply not found' })
  reactToReply(
    @CurrentUser('id') userId: string,
    @Param() params: ReplyIdParamDto,
    @Body() dto: AddDiscussionReactionDto,
  ) {
    return this.discussionsService.toggleReplyReaction(
      userId,
      params.replyId,
      dto,
    );
  }
}
