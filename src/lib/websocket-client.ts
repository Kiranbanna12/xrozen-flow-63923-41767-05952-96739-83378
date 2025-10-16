/**
 * WebSocket Client for Real-time Features
 * Replaces Supabase Realtime with native WebSocket connection
 */

import { apiClient } from './api-client';

type EventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private currentProjectId: string | undefined = undefined;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private missedHeartbeats = 0;

  connect(projectId?: string) {
    if (this.ws || this.isConnecting) return;
    
    // Store project ID for reconnection
    this.currentProjectId = projectId;
    
    // Use API client to check authentication properly
    if (!apiClient.isAuthenticated()) {
      console.warn('🔧 WebSocket: Not authenticated, skipping WebSocket connection');
      return;
    }

    const token = apiClient.getAuthToken();
    if (!token) {
      console.warn('🔧 WebSocket: No auth token available, skipping WebSocket connection');
      return;
    }

    this.isConnecting = true;
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
    const connectionUrl = projectId 
      ? `${wsUrl}?token=${token}&project_id=${projectId}`
      : `${wsUrl}?token=${token}`;
    
    try {
      console.log('🔧 WebSocket: Connecting with token and project:', projectId);
      this.ws = new WebSocket(connectionUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to project:', projectId);
        console.log('🔧 WebSocket: Connection established successfully');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.missedHeartbeats = 0;
        
        // Notify all listeners about connection
        const handlers = this.handlers.get('connection:open') || [];
        handlers.forEach((handler) => handler({ connected: true }));
        
        // Subscribe to chat updates for this project
        if (projectId) {
          console.log('🔧 WebSocket: Subscribing to chat for project:', projectId);
          this.send('subscribe:chat', { project_id: projectId });
        }
        
        // Start heartbeat for mobile browsers
        this.startHeartbeat();
        
        // Setup visibility change handler
        this.setupVisibilityHandler();
      };

      this.ws.onmessage = (event) => {
        try {
          const { event: eventType, data } = JSON.parse(event.data);
          
          // Handle pong response to reset heartbeat counter
          if (eventType === 'pong') {
            this.missedHeartbeats = 0;
            console.log('🔧 WebSocket: Pong received, connection alive');
            return;
          }
          
          console.log('🔧 WebSocket: Received event:', eventType, data);
          const handlers = this.handlers.get(eventType) || [];
          handlers.forEach((handler) => handler(data));
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('❌ WebSocket disconnected');
        
        // Notify all listeners about disconnection
        const handlers = this.handlers.get('connection:close') || [];
        handlers.forEach((handler) => handler({ connected: false }));
        
        this.ws = null;
        this.isConnecting = false;
        this.reconnect(projectId);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        
        // Notify all listeners about error
        const handlers = this.handlers.get('connection:error') || [];
        handlers.forEach((handler) => handler({ error }));
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  private reconnect(projectId?: string) {
    // Only reconnect if we're still authenticated
    if (!apiClient.isAuthenticated()) {
      console.log('🔧 WebSocket: Not authenticated, skipping reconnection');
      return;
    }
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      console.log(`🔧 WebSocket: Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect(projectId);
      }, delay);
    } else {
      console.error('🔧 WebSocket: Max reconnection attempts reached');
    }
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) || [];
    this.handlers.set(event, handlers.filter((h) => h !== handler));
  }

  send(event: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ event, data });
      console.log('🔧 WebSocket: Sending message:', event, data);
      this.ws.send(message);
    } else {
      console.warn('🔧 WebSocket: Cannot send message - connection not open. State:', this.ws?.readyState);
      console.warn('🔧 WebSocket: Message was:', event, data);
    }
  }

  private startHeartbeat() {
    // Clear existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Send heartbeat every 30 seconds to keep connection alive on mobile
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.missedHeartbeats++;
        
        // If too many heartbeats missed, reconnect
        if (this.missedHeartbeats >= 3) {
          console.warn('🔧 WebSocket: Too many missed heartbeats, reconnecting...');
          this.disconnect();
          this.connect(this.currentProjectId);
          return;
        }
        
        this.send('ping', { timestamp: Date.now() });
      }
    }, 30000); // 30 seconds
  }

  private setupVisibilityHandler() {
    // Handle page visibility changes (mobile background/foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔧 WebSocket: Page visible, checking connection...');
        // Check if connection is still alive
        if (!this.isConnected()) {
          console.log('🔧 WebSocket: Connection lost, reconnecting...');
          this.disconnect();
          this.connect(this.currentProjectId);
        } else {
          // Send a ping to verify connection
          this.send('ping', { timestamp: Date.now() });
        }
      }
    };

    // Handle window focus (browser tab switched)
    const handleFocus = () => {
      console.log('🔧 WebSocket: Window focused, checking connection...');
      if (!this.isConnected()) {
        console.log('🔧 WebSocket: Connection lost, reconnecting...');
        this.disconnect();
        this.connect(this.currentProjectId);
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      console.log('🔧 WebSocket: Network online, reconnecting...');
      this.disconnect();
      this.connect(this.currentProjectId);
    };

    // Remove old listeners first
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('online', handleOnline);

    // Add new listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.ws?.close();
    this.ws = null;
    this.isConnecting = false;
    this.currentProjectId = undefined;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const websocketClient = new WebSocketClient();
