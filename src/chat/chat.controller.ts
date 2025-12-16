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
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { AddParticipantsDto } from './dto/add-participants.dto';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Post('conversations')
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
  getConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getConversations(userId);
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chatService.getConversation(id, userId);
  }

  @Post('conversations/:id/participants')
  addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto) {
    return this.chatService.addParticipants(id, dto);
  }

  @Post('conversations/:id/leave')
  leaveConversation(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.leaveConversation(id, userId);
  }

  @Post('messages')
  sendMessage(@CurrentUser('id') userId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(userId, dto);
  }

  @Put('messages/:id')
  updateMessage(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.updateMessage(id, userId, dto);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.chatService.deleteMessage(id, userId);
  }

  @Post('conversations/:id/read')
  markAsRead(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
    @Body() body?: { messageId?: string },
  ) {
    return this.chatService.markAsRead(conversationId, userId, body?.messageId);
  }

  @Get('conversations/:id/unread-count')
  getUnreadCount(
    @Param('id') conversationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.getUnreadCount(conversationId, userId);
  }

  @Get('conversations/:id/search')
  searchMessages(
    @Param('id') conversationId: string,
    @Query('q') query: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.chatService.searchMessages(conversationId, userId, query);
  }
}
