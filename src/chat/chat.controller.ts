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
  async createConversation(@Request() req, @Body() dto: CreateConversationDto) {
    const conversation = await this.chatService.createConversation(
      req.user.userId,
      dto,
    );

    for (const participant of conversation.participants) {
      if (participant.userId !== req.user.userId) {
        this.chatGateway.notifyNewConversation(
          participant.userId,
          conversation,
        );
      }
    }

    return conversation;
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: RequestUser) {
    return this.chatService.getConversations(user.id);
  }

  @Get('conversations/:id')
  getConversation(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.getConversation(id, user.id);
  }

  @Post('conversations/:id/participants')
  addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto) {
    return this.chatService.addParticipants(id, dto);
  }

  @Post('conversations/:id/leave')
  leaveConversation(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.leaveConversation(id, user.id);
  }

  @Post('messages')
  sendMessage(@CurrentUser() user: RequestUser, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(user.id, dto);
  }

  @Put('messages/:id')
  updateMessage(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.chatService.updateMessage(id, user.id, dto);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.deleteMessage(id, user.id);
  }

  @Post('conversations/:id/read')
  markAsRead(
    @Param('id') conversationId: string,
    @CurrentUser() user: RequestUser,
    @Body() body?: { messageId?: string },
  ) {
    return this.chatService.markAsRead(
      conversationId,
      user.id,
      body?.messageId,
    );
  }

  @Get('conversations/:id/unread-count')
  getUnreadCount(
    @Param('id') conversationId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getUnreadCount(conversationId, user.id);
  }

  @Get('conversations/:id/search')
  searchMessages(
    @Param('id') conversationId: string,
    @Query('q') query: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.searchMessages(conversationId, user.id, query);
  }
}
