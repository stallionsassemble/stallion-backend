import { Socket } from 'socket.io';

export interface AuthenticatedSocket extends Socket {
  userId: string;
}

export interface PendingMessage {
  userId: string;
  event: string;
  data: any;
  timestamp: Date;
}

export interface SendMessagePayload {
  recipientId: string;
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachments?: any;
}

export interface UpdateMessagePayload {
  messageId: string;
  content: string;
}

export interface DeleteMessagePayload {
  messageId: string;
}

export interface MarkAsReadPayload {
  conversationId: string;
  messageId?: string;
}

export interface TypingPayload {
  conversationId: string;
  isTyping: boolean;
}

export interface JoinConversationPayload {
  conversationId: string;
}

export interface MessageResponse {
  id: string;
  identifier?: string;
  content: string;
  type: string;
  attachments?: any;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    profilePicture: string | null;
  };
  replyToMessageId?: string | null;
  replyToMessage?: {
    id: string;
    content: string;
    isDeleted: boolean;
    senderId: string;
    sender: {
      id: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
    };
  } | null;
}

export interface ConversationResponse {
  id: string;
  type: string;
  name: string | null;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: Array<{
    id: string;
    role: string;
    lastReadAt: Date | null;
    joinedAt: Date;
    userId: string;
    user: {
      id: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      profilePicture: string | null;
    };
  }>;
  messages?: MessageResponse[];
}

export interface UserOnlineStatus {
  userId: string;
  isOnline: boolean;
  lastSeen?: Date;
}

export interface OnlineStatusPayload {
  userIds: string[];
}
