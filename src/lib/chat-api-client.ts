/**
 * Enhanced Chat API Client
 * Handles all chat-related API calls
 */

import { apiClient } from './api-client';
import type { Conversation, Message, MessageStatus, ConversationType } from '@/types/chat.types';

class ChatAPIClient {
  private baseUrl = '/api';

  // Conversations  
  async getConversations(): Promise<Conversation[]> {
    // For now, return empty array - will be implemented with backend
    return [];
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    // Placeholder - will be implemented with backend
    throw new Error('Not implemented yet');
  }

  async createConversation(data: {
    conversation_type: ConversationType;
    name?: string;
    project_id?: string;
    participant_ids: string[];
  }): Promise<Conversation> {
    // Placeholder - will be implemented with backend
    throw new Error('Not implemented yet');
  }

  async addParticipants(conversationId: string, userIds: string[]): Promise<void> {
    // Placeholder - will be implemented with backend
  }

  // Messages
  async getMessages(conversationId: string, limit = 50, offset = 0): Promise<Message[]> {
    return apiClient.getMessages(conversationId);
  }

  async sendMessage(data: {
    conversation_id: string;
    content: string;
    message_type?: string;
    file_url?: string;
    reply_to_message_id?: string;
    mentioned_user_ids?: string[];
  }): Promise<Message> {
    console.log('🔧 ChatAPI: Sending message:', data);
    
    // Map conversation_id to project_id for backend compatibility
    const messageData = {
      project_id: data.conversation_id,
      content: data.content,
      message_type: data.message_type || 'text',
      file_url: data.file_url,
      reply_to_message_id: data.reply_to_message_id,
      mentioned_user_ids: data.mentioned_user_ids
    };
    
    const response = await apiClient.createMessage(messageData);
    console.log('🔧 ChatAPI: Message sent successfully:', response);
    return response;
  }



  async sendSystemMessage(conversationId: string, data: {
    content: string;
    message_type: string;
    metadata?: any;
  }): Promise<Message> {
    console.log('🔧 ChatAPI: Sending system message:', data);
    
    const messageData = {
      project_id: conversationId,
      content: data.content,
      message_type: data.message_type,
      metadata: data.metadata,
    };
    
    const response = await apiClient.createMessage(messageData);
    console.log('🔧 ChatAPI: System message sent successfully:', response);
    return response;
  }

  // Message Status
  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    // Placeholder - will be implemented with backend
  }

  async getMessageInfo(messageId: string): Promise<{
    delivered_to: Array<{ user_id: string; timestamp: string; user: any }>;
    read_by: Array<{ user_id: string; timestamp: string; user: any }>;
  }> {
    try {
      // Use the apiClient's new public method
      return await apiClient.getMessageInfo(messageId);
    } catch (error) {
      console.error('Failed to get message info:', error);
      // Return empty arrays as fallback
      return {
        delivered_to: [],
        read_by: []
      };
    }
  }

  // Message Actions
  async pinMessage(messageId: string): Promise<any> {
    return apiClient.pinMessage(messageId);
  }

  async starMessage(messageId: string): Promise<any> {
    return apiClient.starMessage(messageId);
  }

  async deleteMessage(messageId: string, deleteForEveryone: boolean = false): Promise<any> {
    return apiClient.deleteMessage(messageId, deleteForEveryone);
  }

  async reportMessage(messageId: string, reason: string): Promise<any> {
    return apiClient.reportMessage(messageId, reason);
  }

  async reactToMessage(messageId: string, emoji: string): Promise<any> {
    return apiClient.reactToMessage(messageId, emoji);
  }

  async editMessage(messageId: string, content: string): Promise<any> {
    return apiClient.editMessage(messageId, content);
  }

  // Typing Indicators
  async setTypingStatus(conversationId: string, isTyping: boolean): Promise<void> {
    // Placeholder - will be implemented with backend
  }

  // Search
  async searchUsers(query: string): Promise<Array<{ id: string; email: string; full_name?: string; avatar_url?: string }>> {
    // Placeholder - will be implemented with backend
    return [];
  }
}

export const chatApiClient = new ChatAPIClient();
