/**
 * Real-time Unread Count Hook
 * Listens to WebSocket for instant notification updates
 */

import { useState, useEffect } from 'react';
import { websocketClient } from '@/lib/websocket-client';
import { apiClient } from '@/lib/api-client';

interface UnreadData {
  projects: Array<{
    project_id: string;
    project_name: string;
    unread_count: number;
    last_message_preview: string;
    last_message_at: string;
  }>;
  total_unread: number;
}

export const useRealtimeUnreadCount = () => {
  const [unreadData, setUnreadData] = useState<UnreadData>({ projects: [], total_unread: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    loadUnreadCounts();
  }, []);

  // WebSocket listener for real-time updates
  useEffect(() => {
    const handleChatUpdate = (data: any) => {
      console.log('🔔 Unread hook: Chat update received:', data);
      
      // Reload counts when new message arrives
      if (data.event === 'message:new') {
        console.log('🔔 New message detected, refreshing unread counts');
        loadUnreadCounts();
      }
    };

    // Listen to chat updates
    websocketClient.on('chat:update', handleChatUpdate);

    return () => {
      websocketClient.off('chat:update', handleChatUpdate);
    };
  }, []);

  const loadUnreadCounts = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      const data = await apiClient.getUnreadCounts();
      console.log('🔔 Loaded unread counts:', data);
      setUnreadData(data);
    } catch (error) {
      console.error('Failed to load unread counts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCounts = () => {
    console.log('🔔 Manual refresh triggered');
    loadUnreadCounts();
  };

  return {
    unreadData,
    totalUnread: unreadData.total_unread,
    isLoading,
    refreshCounts
  };
};
