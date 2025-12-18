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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('conversations')
  @ApiOperation({
    summary: 'Create conversation',
    description: 'Create a new chat conversation with participants',
  })
  @ApiResponse({
    status: 201,
    description: 'Conversation created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createConversation(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    const conversation = await this.chatService.createConversation(userId, dto);

    for (const participant of conversation.participants) {
      if (participant.userId !== userId) {
        this.chatGateway.notifyNewConversation(
          participant.userId,
          conversation,
        );
      }
    }

    return conversation;
  }

  @Get('conversations')
  @ApiOperation({
    summary: 'Get user conversations',
    description: 'Retrieve all conversations for the authenticated user',
  })
  @ApiResponse({ status: 200, description: 'List of conversations' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get('conversations/:id')
  @ApiOperation({
    summary: 'Get conversation details',
    description: 'Retrieve a specific conversation with messages',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Conversation details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getConversation(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chatService.getConversation(id, userId);
  }

  @Post('conversations/:id/participants')
  @ApiOperation({
    summary: 'Add participants',
    description: 'Add new participants to an existing conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 201, description: 'Participants added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto) {
    return this.chatService.addParticipants(id, dto);
  }

  @Post('conversations/:id/leave')
  @ApiOperation({
    summary: 'Leave conversation',
    description: 'Remove yourself from a conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Left conversation successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  leaveConversation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.leaveConversation(id, userId);
  }

  @Post('messages')
  @ApiOperation({
    summary: 'Send message',
    description: 'Send a new message in a conversation',
  })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Patch('messages/:id')
  @ApiOperation({
    summary: 'Update message',
    description: 'Edit an existing message',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  updateMessage(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.updateMessage(id, userId, dto);
  }

  @Delete('messages/:id')
  @ApiOperation({
    summary: 'Delete message',
    description: 'Delete a message from a conversation',
  })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  deleteMessage(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chatService.deleteMessage(id, userId);
  }

  @Post('conversations/:id/read')
  @ApiOperation({
    summary: 'Mark as read',
    description: 'Mark messages in a conversation as read',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Marked as read successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
    @Body() body?: { messageId?: string },
  ) {
    return this.chatService.markAsRead(conversationId, userId, body?.messageId);
  }

  @Get('conversations/:id/unread-count')
  @ApiOperation({
    summary: 'Get unread count',
    description: 'Get the number of unread messages in a conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getUnreadCount(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getUnreadCount(conversationId, userId);
  }

  @Get('conversations/:id/search')
  @ApiOperation({
    summary: 'Search messages',
    description: 'Search for messages within a conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  searchMessages(
    @Param('id') conversationId: string,
    @Query('q') query: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.searchMessages(conversationId, userId, query);
  }
}
