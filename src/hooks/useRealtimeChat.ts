/**
 * Real-time Chat Hook
 * Handles WebSocket connections and real-time updates
 */

import { useEffect, useState, useCallback } from 'react';
import { websocketClient } from '@/lib/websocket-client';
import type { Message, TypingIndicator } from '@/types/chat.types';

interface UseRealtimeChatOptions {
  conversationId: string;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
  onTypingChange?: (typingUsers: TypingIndicator[]) => void;
  onJoinRequest?: (data: any) => void;
  onRequestApproved?: (data: any) => void;
  onRequestRejected?: (data: any) => void;
  onMemberRemoved?: (data: any) => void;
  onPresenceChange?: (onlineUsers: string[]) => void;
  onMessageStatusChange?: (data: { messageId: string; status: string; userId: string }) => void;
  onCallSignal?: (data: any) => void;
}

export const useRealtimeChat = ({
  conversationId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
  onTypingChange,
  onJoinRequest,
  onRequestApproved,
  onRequestRejected,
  onMemberRemoved,
  onPresenceChange,
  onMessageStatusChange,
  onCallSignal,
}: UseRealtimeChatOptions) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!conversationId) return;

    // Connect WebSocket with project ID
    websocketClient.connect(conversationId);

    // Initial connection check
    setIsConnected(websocketClient.isConnected());

    // Subscribe to conversation channel
    const handleMessage = (data: any) => {
      console.log('🔧 Chat Hook: Received WebSocket data:', data);
      
      if (data.conversation_id !== conversationId) {
        console.log('🔧 Chat Hook: Message not for this conversation, ignoring');
        return;
      }

      switch (data.event) {
        case 'message:new':
          console.log('🔧 Chat Hook: New message received:', data.message);
          onNewMessage?.(data.message);
          break;
        case 'message:update':
          console.log('🔧 Chat Hook: Message updated:', data.message);
          onMessageUpdate?.(data.message);
          break;
        case 'message:delete':
          console.log('🔧 Chat Hook: Message deleted:', data.message_id);
          onMessageDelete?.(data.message_id);
          break;
        case 'typing:change':
          console.log('🔧 Chat Hook: Typing status changed:', data.typing_users);
          onTypingChange?.(data.typing_users);
          break;
        case 'presence:change':
          console.log('🔧 Chat Hook: Presence changed:', data.online_users);
          onPresenceChange?.(data.online_users);
          break;
        case 'message:status':
          console.log('🔧 Chat Hook: Message status changed:', data);
          onMessageStatusChange?.(data);
          break;
        case 'call:signal':
          console.log('📞 Chat Hook: Call signal received:', data);
          onCallSignal?.(data);
          break;
        default:
          console.log('🔧 Chat Hook: Unknown event type:', data.event);
      }
    };

    const handleJoinRequest = (data: any) => {
      console.log('🔧 Chat Hook: Join request received:', data);
      onJoinRequest?.(data);
    };

    const handleRequestApproved = (data: any) => {
      console.log('🔧 Chat Hook: Request approved:', data);
      onRequestApproved?.(data);
    };

    const handleRequestRejected = (data: any) => {
      console.log('🔧 Chat Hook: Request rejected:', data);
      onRequestRejected?.(data);
    };

    const handleMemberRemoved = (data: any) => {
      console.log('🔧 Chat Hook: Member removed:', data);
      onMemberRemoved?.(data);
    };

    websocketClient.on('chat:update', handleMessage);
    websocketClient.on('chat:join_request', handleJoinRequest);
    websocketClient.on('chat:request_approved', handleRequestApproved);
    websocketClient.on('chat:request_rejected', handleRequestRejected);
    websocketClient.on('chat:member_removed', handleMemberRemoved);

    // Listen to connection events
    const handleConnectionOpen = () => {
      console.log('🔧 Chat Hook: Connection opened');
      setIsConnected(true);
    };

    const handleConnectionClose = () => {
      console.log('🔧 Chat Hook: Connection closed');
      setIsConnected(false);
    };

    websocketClient.on('connection:open', handleConnectionOpen);
    websocketClient.on('connection:close', handleConnectionClose);

    // Check connection status more frequently on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const checkFrequency = isMobile ? 500 : 1000; // 500ms on mobile, 1s on desktop

    // Check connection status periodically
    const checkInterval = setInterval(() => {
      const connected = websocketClient.isConnected();
      setIsConnected(connected);
      console.log('🔧 Chat Hook: Connection status check:', connected);
    }, checkFrequency);

    // Also check on visibility change for mobile
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔧 Chat Hook: Page visible, checking connection...');
        const connected = websocketClient.isConnected();
        setIsConnected(connected);
        
        // Force reconnect if not connected
        if (!connected) {
          console.log('🔧 Chat Hook: Not connected, forcing reconnect...');
          websocketClient.connect(conversationId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      websocketClient.off('chat:update', handleMessage);
      websocketClient.off('chat:join_request', handleJoinRequest);
      websocketClient.off('chat:request_approved', handleRequestApproved);
      websocketClient.off('chat:request_rejected', handleRequestRejected);
      websocketClient.off('chat:member_removed', handleMemberRemoved);
      websocketClient.off('connection:open', handleConnectionOpen);
      websocketClient.off('connection:close', handleConnectionClose);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(checkInterval);
    };
  }, [conversationId, onNewMessage, onMessageUpdate, onMessageDelete, onTypingChange, onJoinRequest, onRequestApproved, onRequestRejected, onMemberRemoved]);

  const sendTypingIndicator = useCallback((isTyping: boolean) => {
    websocketClient.send('typing:indicator', {
      conversation_id: conversationId,
      is_typing: isTyping,
    });
  }, [conversationId]);

  const sendPresence = useCallback((status: 'online' | 'offline') => {
    websocketClient.send('user:presence', {
      conversation_id: conversationId,
      status,
    });
  }, [conversationId]);

  const sendMessageStatus = useCallback(async (messageId: string, status: 'delivered' | 'read') => {
    // Send via WebSocket for real-time updates
    websocketClient.send('message:status', {
      conversation_id: conversationId,
      message_id: messageId,
      status,
    });
    
    // Also update in database via API
    try {
      const response = await fetch(`/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      
      if (!response.ok) {
        console.error('Failed to update message status in database');
      } else {
        console.log('✅ Message status updated in database:', messageId, status);
      }
    } catch (error) {
      console.error('Error updating message status:', error);
    }
  }, [conversationId]);

  const sendCallSignal = useCallback((signal: any) => {
    console.log('📞 Chat Hook: Sending call signal:', signal);
    websocketClient.send('call:signal', {
      conversation_id: conversationId,
      ...signal,
    });
  }, [conversationId]);

  return {
    isConnected,
    sendTypingIndicator,
    sendPresence,
    sendMessageStatus,
    sendCallSignal,
  };
};
