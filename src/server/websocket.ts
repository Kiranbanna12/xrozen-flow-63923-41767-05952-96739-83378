/**
 * WebSocket Server for Real-time Features
 * Replaces Supabase Realtime functionality
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './utils/logger.util';

interface AuthenticatedWebSocket extends WebSocket {
  userId: string;
  projectId?: string;
  isAlive: boolean;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, request) => {
      try {
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const token = url.searchParams.get('token');
        const projectId = url.searchParams.get('project_id');

        if (!token) {
          ws.close(1008, 'No token provided');
          return;
        }

        // For now, extract userId from token (simplified)
        // In production, use proper JWT verification
        const userId = this.extractUserIdFromToken(token);
        if (!userId) {
          ws.close(1008, 'Invalid token');
          return;
        }

        const client = ws as AuthenticatedWebSocket;
        client.userId = userId;
        client.projectId = projectId || undefined;
        client.isAlive = true;

        // Add to clients map
        if (!this.clients.has(client.userId)) {
          this.clients.set(client.userId, new Set());
        }
        this.clients.get(client.userId)!.add(client);

        logger.info(`WebSocket connected: User ${client.userId}, Project: ${client.projectId}`);

        // Broadcast presence update if project is specified
        if (client.projectId) {
          setTimeout(() => {
            const onlineUsers = this.getOnlineUsersInProject(client.projectId!);
            this.sendToProject(client.projectId!, 'chat:update', {
              event: 'presence:change',
              online_users: onlineUsers,
              conversation_id: client.projectId
            });
            logger.info(`Initial presence broadcast for project ${client.projectId}: ${onlineUsers.length} users online`);
          }, 500); // Small delay to ensure client is fully set up
        }

        // Heartbeat
        client.on('pong', () => {
          client.isAlive = true;
        });

        client.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(client, message);
          } catch (error) {
            logger.error('Invalid WebSocket message:', error);
          }
        });

        client.on('close', () => {
          const projectId = client.projectId;
          
          this.clients.get(client.userId)?.delete(client);
          if (this.clients.get(client.userId)?.size === 0) {
            this.clients.delete(client.userId);
          }
          logger.info(`WebSocket disconnected: User ${client.userId}`);
          
          // Broadcast updated presence when user disconnects
          if (projectId) {
            setTimeout(() => {
              const onlineUsers = this.getOnlineUsersInProject(projectId);
              this.sendToProject(projectId, 'chat:update', {
                event: 'presence:change',
                online_users: onlineUsers,
                conversation_id: projectId
              });
              logger.info(`Presence broadcast after disconnect for project ${projectId}: ${onlineUsers.length} users online`);
            }, 100);
          }
        });

        client.on('error', (error) => {
          logger.error(`WebSocket error for user ${client.userId}:`, error);
        });
      } catch (error) {
        logger.error('WebSocket connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  private extractUserIdFromToken(token: string): string | null {
    try {
      // Simple base64 decode for JWT payload
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      return payload.userId || payload.sub || null;
    } catch {
      return null;
    }
  }

  private handleMessage(client: AuthenticatedWebSocket, message: any) {
    logger.info(`Message from ${client.userId}:`, message);
    
    // Handle different message types
    switch (message.event) {
      case 'ping':
        this.sendToUser(client.userId, 'pong', { timestamp: Date.now() });
        break;
      case 'subscribe:chat':
        client.projectId = message.data?.project_id;
        logger.info(`User ${client.userId} subscribed to project ${client.projectId}`);
        break;
      case 'typing:indicator':
        this.handleTypingIndicator(client, message.data);
        break;
      case 'user:presence':
        this.handlePresence(client, message.data);
        break;
      case 'message:status':
        this.handleMessageStatus(client, message.data);
        break;
      case 'call:signal':
        this.handleCallSignal(client, message.data);
        break;
      default:
        logger.warn(`Unknown message event: ${message.event}`);
    }
  }

  private handlePresence(client: AuthenticatedWebSocket, data: any) {
    if (!data.conversation_id) return;
    
    const projectId = data.conversation_id;
    
    // Update client's project ID if status is online
    if (data.status === 'online') {
      client.projectId = projectId;
      logger.info(`User ${client.userId} set online for project ${projectId}`);
    }
    
    const onlineUsers = this.getOnlineUsersInProject(projectId);
    
    logger.info(`Presence update for project ${projectId}: ${onlineUsers.length} users online`, onlineUsers);
    
    // Broadcast updated presence to all users in project (including sender)
    this.sendToProject(projectId, 'chat:update', {
      event: 'presence:change',
      online_users: onlineUsers,
      conversation_id: projectId
    });
    
    logger.info(`Broadcasted presence to project ${projectId}: ${onlineUsers.length} users`);
  }

  private handleMessageStatus(client: AuthenticatedWebSocket, data: any) {
    if (!data.conversation_id || !data.message_id || !data.status) return;
    
    // Only broadcast status if user is actually online
    if (!this.isUserConnected(client.userId)) {
      logger.warn(`User ${client.userId} not connected, skipping status update`);
      return;
    }
    
    // Broadcast message status to all users in project (including sender)
    this.sendToProject(data.conversation_id, 'chat:update', {
      event: 'message:status',
      messageId: data.message_id,
      userId: client.userId,
      status: data.status,
      conversation_id: data.conversation_id
    });
    
    logger.info(`Message ${data.message_id} marked as ${data.status} by user ${client.userId} (online: ${this.isUserConnected(client.userId)})`);
  }

  private handleCallSignal(client: AuthenticatedWebSocket, data: any) {
    if (!data.conversation_id) {
      logger.warn('Call signal missing conversation_id');
      return;
    }
    
    logger.info(`📞 Call signal from ${client.userId}: ${data.type}`);
    
    // Forward call signal to other participants in the project
    // Add sender info to the signal
    const signalData = {
      ...data,
      senderId: client.userId,
      // Sender name is already included from the frontend
    };
    
    // If there's a recipientId, send only to that user
    if (data.recipientId) {
      logger.info(`📞 Sending call signal to specific user: ${data.recipientId}`);
      this.sendToUser(data.recipientId, 'chat:update', {
        event: 'call:signal',
        ...signalData,
        conversation_id: data.conversation_id
      });
    } else {
      // Send to all users in project except sender
      logger.info(`📞 Broadcasting call signal to project: ${data.conversation_id}`);
      this.sendToProject(data.conversation_id, 'chat:update', {
        event: 'call:signal',
        ...signalData,
        conversation_id: data.conversation_id
      }, client.userId);
    }
    
    logger.info(`📞 Call signal relayed successfully`);
  }

  private handleTypingIndicator(client: AuthenticatedWebSocket, data: any) {
    if (!client.projectId || !data.conversation_id) return;
    
    // Broadcast typing indicator to other users in the same project
    this.sendToProject(client.projectId, 'chat:update', {
      event: 'typing:change',
      typing_users: data.is_typing ? [{ user_id: client.userId }] : [],
      conversation_id: data.conversation_id
    }, client.userId);
  }

  private startHeartbeat() {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const client = ws as AuthenticatedWebSocket;
        if (!client.isAlive) {
          logger.info(`Terminating inactive WebSocket: User ${client.userId}`);
          client.terminate();
          return;
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000); // 30 seconds
  }

  /**
   * Send message to specific user
   */
  public sendToUser(userId: string, event: string, data: any) {
    const userClients = this.clients.get(userId);
    if (userClients && userClients.size > 0) {
      const message = JSON.stringify({ event, data, timestamp: Date.now() });
      userClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send(message);
          } catch (error) {
            logger.error(`Failed to send to user ${userId}:`, error);
          }
        }
      });
      logger.info(`Sent ${event} to user ${userId} (${userClients.size} connections)`);
    } else {
      logger.warn(`No active connections for user ${userId}`);
    }
  }

  /**
   * Broadcast to all connected clients
   */
  public broadcast(event: string, data: any) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    let sentCount = 0;
    
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          sentCount++;
        } catch (error) {
          logger.error('Failed to broadcast message:', error);
        }
      }
    });
    
    logger.info(`Broadcast ${event} to ${sentCount} clients`);
  }

  /**
   * Send to all users in a specific project
   */
  public sendToProject(projectId: string, event: string, data: any, excludeUserId?: string) {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    let sentCount = 0;
    
    console.log('🔧 WebSocket: Sending to project:', projectId, 'event:', event);
    console.log('🔧 WebSocket: Total users connected:', this.clients.size);
    
    this.clients.forEach((userClients, userId) => {
      // Skip excluded user (typically the sender)
      if (excludeUserId && userId === excludeUserId) {
        console.log('🔧 WebSocket: Skipping excluded user:', userId);
        return;
      }
      
      console.log('🔧 WebSocket: Checking user:', userId, 'client count:', userClients.size);
      
      userClients.forEach((client) => {
        console.log('🔧 WebSocket: Client state:', client.readyState, 'project:', client.projectId);
        
        if (client.readyState === WebSocket.OPEN && 
            (client.projectId === projectId || !client.projectId)) {
          try {
            client.send(message);
            sentCount++;
            console.log('🔧 WebSocket: Message sent to user:', userId);
          } catch (error) {
            logger.error(`Failed to send to user ${userId}:`, error);
          }
        }
      });
    });
    
    console.log(`🔧 WebSocket: Sent ${event} to project ${projectId} (${sentCount} clients)`);
    logger.info(`Sent ${event} to project ${projectId} (${sentCount} clients)`);
  }

  /**
   * Broadcast message to project participants
   */
  public broadcastToProject(projectId: string, message: any) {
    console.log('🔧 WebSocket: Broadcasting to project:', projectId);
    console.log('🔧 WebSocket: Message:', message.id);
    console.log('🔧 WebSocket: Connected users count:', this.clients.size);
    
    this.sendToProject(projectId, 'chat:update', {
      event: 'message:new',
      message: message,
      conversation_id: projectId
    });
  }

  /**
   * Send message to specific users in a project
   */
  public sendMessageToUsers(userIds: string[], projectId: string, message: any) {
    const eventData = {
      event: 'message:new', 
      message: message,
      conversation_id: projectId
    };
    
    userIds.forEach(userId => {
      this.sendToUser(userId, 'chat:update', eventData);
    });
  }
  public sendToUsers(userIds: string[], event: string, data: any) {
    userIds.forEach((userId) => this.sendToUser(userId, event, data));
  }

  /**
   * Get connected users count
   */
  public getConnectedUsersCount(): number {
    return this.clients.size;
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    const userClients = this.clients.get(userId);
    return userClients !== undefined && userClients.size > 0;
  }

  /**
   * Get online users in a specific project
   */
  public getOnlineUsersInProject(projectId: string): string[] {
    const onlineUsers: string[] = [];
    
    this.clients.forEach((clientSet, userId) => {
      // Check if any of the user's clients are connected to this project
      for (const client of clientSet) {
        if (client.projectId === projectId && client.readyState === WebSocket.OPEN) {
          onlineUsers.push(userId);
          break; // Only count user once even if multiple connections
        }
      }
    });
    
    return onlineUsers;
  }

  /**
   * Get all online users (across all projects)
   */
  public getAllOnlineUsers(): string[] {
    return Array.from(this.clients.keys()).filter(userId => this.isUserConnected(userId));
  }

  /**
   * Gracefully close all connections
   */
  public close() {
    logger.info('Closing WebSocket server...');
    this.wss.clients.forEach((client) => {
      client.close(1001, 'Server shutting down');
    });
    this.wss.close();
    this.clients.clear();
  }
}
