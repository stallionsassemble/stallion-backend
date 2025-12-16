import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { WsAuthGuard } from './guards/ws-auth.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  constructor(private chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const userId = (client as any).userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    (client as any).userId = data.userId;

    if (!this.userSockets.has(data.userId)) {
      this.userSockets.set(data.userId, new Set());
    }
    this.userSockets.get(data.userId)!.add(client.id);

    this.logger.log(`User ${data.userId} authenticated on socket ${client.id}`);
    return { success: true, message: 'Authenticated successfully' };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await client.join(`conversation:${data.conversationId}`);
    this.logger.log(
      `Client ${client.id} joined conversation ${data.conversationId}`,
    );
    return { success: true, conversationId: data.conversationId };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    await client.leave(`conversation:${data.conversationId}`);
    this.logger.log(
      `Client ${client.id} left conversation ${data.conversationId}`,
    );
    return { success: true };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = (client as any).userId;

    try {
      const message = await this.chatService.sendMessage(userId, dto);

      this.server
        .to(`conversation:${dto.conversationId}`)
        .emit('newMessage', message);

      const conversation = await this.chatService.getConversation(
        dto.conversationId,
        userId,
      );

      for (const participant of conversation.participants) {
        if (participant.userId !== userId) {
          this.emitToUser(participant.userId, 'conversationUpdated', {
            conversationId: dto.conversationId,
            lastMessage: message,
          });
        }
      }

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('updateMessage')
  async handleUpdateMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; dto: UpdateMessageDto },
  ) {
    const userId = (client as any).userId;

    try {
      const message = await this.chatService.updateMessage(
        data.messageId,
        userId,
        data.dto,
      );

      this.server
        .to(`conversation:${message.conversationId}`)
        .emit('messageUpdated', message);

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Error updating message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string },
  ) {
    const userId = (client as any).userId;

    try {
      const message = await this.chatService.deleteMessage(
        data.messageId,
        userId,
      );

      this.server
        .to(`conversation:${(message as any).conversationId}`)
        .emit('messageDeleted', { messageId: data.messageId });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId?: string },
  ) {
    const userId = (client as any).userId;

    try {
      await this.chatService.markAsRead(
        data.conversationId,
        userId,
        data.messageId,
      );

      this.server
        .to(`conversation:${data.conversationId}`)
        .emit('messageRead', {
          conversationId: data.conversationId,
          userId,
          messageId: data.messageId,
        });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const userId = (client as any).userId;

    client.to(`conversation:${data.conversationId}`).emit('userTyping', {
      conversationId: data.conversationId,
      userId,
      isTyping: data.isTyping,
    });

    return { success: true };
  }

  emitToUser(userId: string, event: string, data: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
    }
  }

  notifyNewConversation(userId: string, conversation: any) {
    this.emitToUser(userId, 'newConversation', conversation);
  }
}
