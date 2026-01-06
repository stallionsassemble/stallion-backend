import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { ConversationIdParamDto } from './dto/conversation-id-param.dto';
import { SearchMessagesQueryDto } from './dto/search-messages-query.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Get user conversations',
    description: 'Retrieve all conversations for the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'List of conversations',
    schema: {
      example: [
        {
          id: 'conv-uuid-1',
          name: 'Project Discussion',
          isGroup: true,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          participants: [
            {
              userId: 'user-uuid-1',
              user: {
                username: 'john_doe',
                firstName: 'John',
                lastName: 'Doe',
              },
            },
          ],
          messages: [
            {
              id: 'msg-uuid',
              content: 'Hello everyone!',
              createdAt: '2024-01-01T12:00:00.000Z',
              senderId: 'user-uuid-1',
            },
          ],
          unreadCount: 3,
        },
      ],
    },
  })
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
  @ApiResponse({
    status: 200,
    description: 'Conversation details',
    schema: {
      example: {
        id: 'conv-uuid',
        name: 'Project Discussion',
        isGroup: true,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        participants: [
          {
            userId: 'user-uuid-1',
            user: {
              username: 'john_doe',
              firstName: 'John',
              lastName: 'Doe',
              profilePicture: 'https://example.com/profile.jpg',
            },
          },
        ],
        messages: [
          {
            id: 'msg-uuid',
            content: 'Hello everyone!',
            senderId: 'user-uuid-1',
            conversationId: 'conv-uuid',
            createdAt: '2024-01-01T12:00:00.000Z',
            updatedAt: '2024-01-01T12:00:00.000Z',
            isRead: false,
            sender: {
              username: 'john_doe',
              firstName: 'John',
              lastName: 'Doe',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getConversation(
    @Param() params: ConversationIdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getConversation(params.id, userId);
  }

  @Get('conversations/:id/unread-count')
  @ApiOperation({
    summary: 'Get unread count',
    description: 'Get the number of unread messages in a conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved',
    schema: {
      example: {
        conversationId: 'conv-uuid',
        unreadCount: 7,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(
    @Param() params: ConversationIdParamDto,
    @CurrentUser('id') userId: string,
  ) {
    return {
      count: await this.chatService.getUnreadCount(params.id, userId),
    };
  }

  @Get('conversations/:id/search')
  @ApiOperation({
    summary: 'Search messages',
    description: 'Search for messages within a conversation',
  })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      example: [
        {
          id: 'msg-uuid-1',
          content: 'This message contains the search term',
          senderId: 'user-uuid',
          conversationId: 'conv-uuid',
          createdAt: '2024-01-01T12:00:00.000Z',
          sender: {
            username: 'john_doe',
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  searchMessages(
    @Param() params: ConversationIdParamDto,
    @Query() query: SearchMessagesQueryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.searchMessages(params.id, userId, query.q);
  }
}
