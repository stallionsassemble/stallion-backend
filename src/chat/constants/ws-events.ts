/**
 * WebSocket Event Constants
 * Centralized management of all WebSocket events for type safety and maintainability
 */

/**
 * Client → Server Events
 * Events that clients send to the server
 */
export const ClientEvents = {
  JOIN_CONVERSATION: 'joinConversation',
  LEAVE_CONVERSATION: 'leaveConversation',
  SEND_MESSAGE: 'sendMessage',
  UPDATE_MESSAGE: 'updateMessage',
  DELETE_MESSAGE: 'deleteMessage',
  MARK_AS_READ: 'markAsRead',
  TYPING: 'typing',
  GET_ONLINE_STATUS: 'getOnlineStatus',
} as const;

/**
 * Server → Client Events
 * Events that the server emits to clients
 */
export const ServerEvents = {
  // Authentication
  AUTHENTICATED: 'authenticated',

  // Messages
  NEW_MESSAGE: 'newMessage',
  MESSAGE_UPDATED: 'messageUpdated',
  MESSAGE_DELETED: 'messageDeleted',
  MESSAGE_READ: 'messageRead',
  MESSAGE_DELIVERED: 'messageDelivered',

  // Conversations
  NEW_CONVERSATION: 'newConversation',
  CONVERSATION_UPDATED: 'conversationUpdated',

  // User Status
  USER_STATUS_CHANGED: 'userStatusChanged',
  USER_TYPING: 'userTyping',
} as const;

/**
 * Type-safe event names
 */
export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEventName = (typeof ServerEvents)[keyof typeof ServerEvents];

/**
 * Event payload interfaces for type safety
 */
export interface AuthenticatedPayload {
  success: true;
  message: string;
  pendingMessages: number;
}

export interface MessageDeliveryResponse {
  success: boolean;
  message?: any;
  delivered?: boolean;
  error?: string;
}

export interface ConversationUpdatePayload {
  conversationId: string;
  lastMessage: any;
}

export interface TypingEventPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface ReadEventPayload {
  conversationId: string;
  userId: string;
  messageId?: string;
}

export interface DeleteEventPayload {
  messageId: string;
}

export interface MessageDeliveredPayload {
  messageId: string;
  conversationId: string;
  deliveredAt: Date;
}
