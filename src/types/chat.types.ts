/**
 * Chat Types for Enhanced Messaging System
 */

export type ConversationType = 'project' | 'direct' | 'group';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export interface Conversation {
  id: string;
  conversation_type: ConversationType;
  name?: string;
  project_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants?: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  user?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  file_url?: string;
  reply_to_message_id?: string;
  is_pinned: boolean;
  is_starred: boolean;
  is_deleted: boolean;
  reactions: Record<string, string[]>; // emoji -> user_ids
  created_at: string;
  updated_at: string;
  edited: boolean;
  sender?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
  reply_to?: Message;
  status?: MessageStatus;
  delivered_to?: string[];
  read_by?: string[];
}

export interface MessageStatusRecord {
  id: string;
  message_id: string;
  user_id: string;
  status: MessageStatus;
  timestamp: string;
}

export interface TypingIndicator {
  id: string;
  conversation_id: string;
  user_id: string;
  is_typing: boolean;
  last_updated: string;
  user?: {
    full_name?: string;
  };
}

export interface MessageMention {
  id: string;
  message_id: string;
  mentioned_user_id: string;
  created_at: string;
}
