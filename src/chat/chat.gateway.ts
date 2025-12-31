import {
  HttpException,
  Logger,
  OnModuleDestroy,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EnvConfig } from 'src/config/env.config';
import { ChatService } from './chat.service';
import {
  AuthenticatedPayload,
  ClientEvents,
  ConversationUpdatePayload,
  DeleteEventPayload,
  MessageDeliveredPayload,
  MessageDeliveryResponse,
  ReadEventPayload,
  ServerEvents,
  TypingEventPayload,
} from './constants/ws-events';
import {
  DeleteMessageWsDto,
  GetOnlineStatusWsDto,
  MarkAsReadWsDto,
  SendMessageWsDto,
  TypingWsDto,
  UpdateMessageWsDto,
} from './dto/websocket-events.dto';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { WsThrottleGuard } from './guards/ws-throttle.guard';
import type { AuthenticatedSocket } from './interfaces/chat.interfaces';
import { ChatNotificationService } from './services/chat-notification.service';
import { ChatStateService } from './services/chat-state.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chatService: ChatService,
    private chatState: ChatStateService,
    private chatNotification: ChatNotificationService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Initialize gateway and clear stale Redis state
   */
  async afterInit() {
    this.logger.log('ChatGateway initializing...');

    try {
      // Clear all socket connections from previous server instance
      await this.chatState.clearAllSockets();
      this.logger.log('Cleared stale socket connections from Redis');
    } catch (error) {
      this.logger.error(`Error clearing Redis state on init: ${error.message}`);
    }
  }

  async handleConnection(client: AuthenticatedSocket) {
    this.logger.log(`Client attempting connection: ${client.id}`);

    try {
      // Extract and verify JWT token
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`No token provided for connection ${client.id}`);
        client.disconnect();
        return;
      }

      // Verify JWT and extract userId
      const userId = await this.verifyTokenAndGetUserId(token);

      if (!userId) {
        this.logger.warn(`Invalid token for connection ${client.id}`);
        client.disconnect();
        return;
      }

      // Set userId on socket
      client.userId = userId;

      // Add socket to user's socket set
      await this.chatState.addUserSocket(userId, client.id);

      this.logger.log(`User ${userId} authenticated on socket ${client.id}`);

      // Get pending message count
      const pendingCount = await this.chatState.getPendingMessageCount(userId);

      // Emit successful authentication
      const authPayload: AuthenticatedPayload = {
        success: true,
        message: 'Authenticated successfully',
        pendingMessages: pendingCount,
      };
      client.emit(ServerEvents.AUTHENTICATED, authPayload);

      // Deliver pending messages asynchronously
      if (pendingCount > 0) {
        this.deliverPendingMessages(userId).catch((error) => {
          this.logger.error(
            `Failed to deliver pending messages to ${userId}: ${error.message}`,
          );
        });
      }

      // Notify contacts asynchronously
      this.notifyUserStatusChange(userId, true).catch((error) => {
        this.logger.error(
          `Failed to notify status change for ${userId}: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Authentication error for ${client.id}: ${error.message}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const userId = client.userId;

    if (userId) {
      try {
        // Remove socket and check if user is fully offline
        const isFullyOffline = await this.chatState.removeUserSocket(
          userId,
          client.id,
        );

        if (isFullyOffline) {
          this.logger.log(`User ${userId} is now offline`);

          // Set last seen
          await this.chatState.setLastSeen(userId);

          // Notify contacts asynchronously (don't block disconnect)
          this.notifyUserStatusChange(userId, false).catch((error) => {
            this.logger.error(
              `Failed to notify status change for ${userId}: ${error.message}`,
            );
          });
        }
      } catch (error) {
        this.logger.error(
          `Error handling disconnect for ${userId}: ${error.message}`,
        );
      }
    }
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.SEND_MESSAGE)
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageWsDto,
  ) {
    const userId = client.userId;

    try {
      const message = await this.chatService.sendDirectMessage(userId, data);

      // Only emit directly to recipient (no room emission to avoid duplicates)
      const delivered = await this.emitToUser(
        data.recipientId,
        ServerEvents.NEW_MESSAGE,
        message,
      );

      // If recipient is offline, queue the message
      if (!delivered) {
        await this.chatState.queuePendingMessage(
          data.recipientId,
          ServerEvents.NEW_MESSAGE,
          message,
        );

        this.logger.log(`Message queued for offline user ${data.recipientId}`);
      } else {
        // Notify sender that message was delivered
        const deliveredPayload: MessageDeliveredPayload = {
          messageId: message.id,
          conversationId: message.conversationId,
          deliveredAt: new Date(),
        };
        await this.emitToUser(
          userId,
          ServerEvents.MESSAGE_DELIVERED,
          deliveredPayload,
        );
      }

      // Notify about conversation update
      const conversationUpdate: ConversationUpdatePayload = {
        conversationId: message.conversationId,
        lastMessage: message,
      };
      await this.emitToUser(
        data.recipientId,
        ServerEvents.CONVERSATION_UPDATED,
        conversationUpdate,
      );

      const response: MessageDeliveryResponse = {
        success: true,
        message,
        delivered,
      };
      return response;
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.UPDATE_MESSAGE)
  async handleUpdateMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: UpdateMessageWsDto,
  ) {
    const userId = client.userId;

    try {
      const message = await this.chatService.updateMessage(
        data.messageId,
        userId,
        data.content,
      );

      // Notify other participant (no room emission)
      const otherUserId = await this.chatNotification.getConversationRecipient(
        message.conversationId,
        userId,
      );

      if (otherUserId) {
        const delivered = await this.emitToUser(
          otherUserId,
          ServerEvents.MESSAGE_UPDATED,
          message,
        );

        if (!delivered) {
          await this.chatState.queuePendingMessage(
            otherUserId,
            ServerEvents.MESSAGE_UPDATED,
            message,
          );
        }
      }

      return { success: true, message };
    } catch (error) {
      this.logger.error(`Error updating message: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.DELETE_MESSAGE)
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: DeleteMessageWsDto,
  ) {
    const userId = client.userId;

    try {
      // Get message to verify ownership and get conversationId
      const messageData = await this.chatService['prisma'].message.findUnique({
        where: { id: data.messageId },
        select: {
          id: true,
          senderId: true,
          conversationId: true,
        },
      });

      if (!messageData) {
        throw new WsException('Message not found');
      }

      if (messageData.senderId !== userId) {
        throw new WsException('Unauthorized');
      }

      await this.chatService.deleteMessage(data.messageId, userId);

      const deleteEvent: DeleteEventPayload = { messageId: data.messageId };

      // Notify other participant (no room emission)
      const otherUserId = await this.chatNotification.getConversationRecipient(
        messageData.conversationId,
        userId,
      );

      if (otherUserId) {
        const delivered = await this.emitToUser(
          otherUserId,
          ServerEvents.MESSAGE_DELETED,
          deleteEvent,
        );

        if (!delivered) {
          await this.chatState.queuePendingMessage(
            otherUserId,
            ServerEvents.MESSAGE_DELETED,
            deleteEvent,
          );
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting message: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.MARK_AS_READ)
  async handleMarkAsRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MarkAsReadWsDto,
  ) {
    const userId = client.userId;

    try {
      await this.chatService.markAsRead(
        data.conversationId,
        userId,
        data.messageId,
      );

      const readEvent: ReadEventPayload = {
        conversationId: data.conversationId,
        userId,
        messageId: data.messageId,
      };

      // Notify other participant (no room emission)
      const otherUserId = await this.chatNotification.getConversationRecipient(
        data.conversationId,
        userId,
      );

      if (otherUserId) {
        await this.emitToUser(
          otherUserId,
          ServerEvents.MESSAGE_READ,
          readEvent,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.TYPING)
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TypingWsDto,
  ) {
    const userId = client.userId;

    try {
      const typingEvent: TypingEventPayload = {
        conversationId: data.conversationId,
        userId,
        isTyping: data.isTyping,
      };

      // Send directly to other participant (not queued - ephemeral event)
      const otherUserId = await this.chatNotification.getConversationRecipient(
        data.conversationId,
        userId,
      );

      if (otherUserId) {
        await this.emitToUser(
          otherUserId,
          ServerEvents.USER_TYPING,
          typingEvent,
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error(`Error marking as read: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  /**
   * Handle request to get online status of users
   */
  @UseGuards(WsAuthGuard, WsThrottleGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          return Object.values(error.constraints || {}).join(', ');
        });
        return new WsException(messages.join('; '));
      },
    }),
  )
  @SubscribeMessage(ClientEvents.GET_ONLINE_STATUS)
  async handleGetOnlineStatus(
    @ConnectedSocket() _client: AuthenticatedSocket,
    @MessageBody() data: GetOnlineStatusWsDto,
  ) {
    try {
      const statuses = await this.chatState.getUsersOnlineStatus(data.userIds);
      return { success: true, statuses };
    } catch (error) {
      this.logger.error(`Error getting online status: ${error.message}`);
      throw new WsException(this.getErrorMessage(error));
    }
  }

  /**
   * Emit event to a specific user
   * Returns true if user is online and message was delivered
   */
  private async emitToUser(
    userId: string,
    event: string,
    data: any,
  ): Promise<boolean> {
    const socketIds = await this.chatState.getUserSockets(userId);

    if (socketIds.length > 0) {
      socketIds.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
      return true;
    }

    return false;
  }

  /**
   * Deliver all pending messages when user comes online
   */
  private async deliverPendingMessages(userId: string) {
    try {
      const pending = await this.chatState.getPendingMessages(userId);

      if (pending.length === 0) {
        return;
      }

      this.logger.log(
        `Delivering ${pending.length} pending messages to user ${userId}`,
      );

      // Deliver all pending messages
      for (const message of pending) {
        await this.emitToUser(userId, message.event, message.data);

        // If this was a new message event, notify the sender it was delivered
        if (
          message.event === ServerEvents.NEW_MESSAGE &&
          message.data?.id &&
          message.data?.conversationId &&
          message.data?.senderId
        ) {
          const deliveredPayload: MessageDeliveredPayload = {
            messageId: message.data.id,
            conversationId: message.data.conversationId,
            deliveredAt: new Date(),
          };
          await this.emitToUser(
            message.data.senderId,
            ServerEvents.MESSAGE_DELIVERED,
            deliveredPayload,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error delivering pending messages to ${userId}: ${error.message}`,
      );
    }
  }

  /**
   * Check if a user is currently online
   */
  async isUserOnline(userId: string): Promise<boolean> {
    return this.chatState.isUserOnline(userId);
  }

  /**
   * Get online status for multiple users
   */
  async getUsersOnlineStatus(userIds: string[]) {
    return this.chatState.getUsersOnlineStatus(userIds);
  }

  /**
   * Extract JWT token from WebSocket handshake
   */
  private extractTokenFromHandshake(client: any): string | undefined {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.split(' ')[1];
    return token;
  }

  /**
   * Verify JWT token and extract userId
   */
  private async verifyTokenAndGetUserId(token: string): Promise<string | null> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.getOrThrow<string>(EnvConfig.JWT_SECRET),
      });
      return payload.sub || null;
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Cleanup on module destroy (server shutdown)
   */
  async onModuleDestroy() {
    this.logger.log('ChatGateway shutting down, cleaning up connections...');

    try {
      // Get all connected users
      const connectedUserIds = await this.chatState.getAllConnectedUserIds();

      if (connectedUserIds.length > 0) {
        this.logger.log(
          `Setting last seen for ${connectedUserIds.length} connected users`,
        );

        // Set last seen for all connected users
        await Promise.all(
          connectedUserIds.map((userId) => this.chatState.setLastSeen(userId)),
        );
      }

      // Clear all socket connections from Redis
      await this.chatState.clearAllSockets();

      this.logger.log('ChatGateway cleanup completed');
    } catch (error) {
      this.logger.error(`Error during ChatGateway cleanup: ${error.message}`);
    }
  }

  /**
   * Safely format error messages for clients
   * Only expose HttpException messages, hide internal errors
   */
  private getErrorMessage(error: any): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && 'message' in response) {
        const msg = (response as any).message;
        return Array.isArray(msg) ? msg.join(', ') : String(msg);
      }
      return error.message;
    }
    return 'Something went wrong';
  }

  /**
   * Notify user's contacts when their online status changes
   */
  private async notifyUserStatusChange(userId: string, isOnline: boolean) {
    try {
      // Get all contacts
      const contactIds = await this.chatNotification.getUserContacts(userId);

      if (contactIds.length === 0) {
        return;
      }

      // Create status update
      const lastSeen = isOnline
        ? undefined
        : await this.chatState.getLastSeen(userId);
      const statusUpdate = this.chatNotification.createStatusUpdate(
        userId,
        isOnline,
        lastSeen,
      );

      // Notify each contact
      let notifiedCount = 0;
      for (const contactId of contactIds) {
        const online = await this.emitToUser(
          contactId,
          ServerEvents.USER_STATUS_CHANGED,
          statusUpdate,
        );
        if (online) notifiedCount++;
      }

      if (notifiedCount) {
        this.logger.log(
          `Notified ${notifiedCount} contacts about ${userId} going ${isOnline ? 'online' : 'offline'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error notifying status change for user ${userId}: ${error.message}`,
      );
      // Don't throw - this is a non-critical operation
    }
  }
}
