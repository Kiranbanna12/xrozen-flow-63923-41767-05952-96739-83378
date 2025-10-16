/**
 * WebSocket Manager Registry
 * Global registry to access WebSocket manager across the application
 */

import { WebSocketManager } from './websocket';

class WebSocketRegistry {
  private wsManager: WebSocketManager | null = null;

  setManager(manager: WebSocketManager) {
    this.wsManager = manager;
    console.log('🔧 WebSocket manager registered globally');
  }

  getManager(): WebSocketManager | null {
    return this.wsManager;
  }

  isAvailable(): boolean {
    return this.wsManager !== null;
  }

  broadcastMessage(projectId: string, message: any) {
    console.log('🔧 Registry: broadcastMessage called with:', { projectId, messageId: message.id });
    if (this.wsManager) {
      console.log('🔧 Registry: WebSocket manager available, calling broadcastToProject');
      this.wsManager.broadcastToProject(projectId, message);
      console.log('🔧 Registry: broadcastToProject call completed');
    } else {
      console.warn('🔧 Registry: WebSocket manager not available for broadcasting');
    }
  }

  sendToUsers(userIds: string[], projectId: string, message: any) {
    if (this.wsManager) {
      console.log('🔧 Registry: Sending message to specific users via WebSocket manager');
      this.wsManager.sendMessageToUsers(userIds, projectId, message);
    } else {
      console.warn('🔧 Registry: WebSocket manager not available for user messaging');
    }
  }

  broadcastPresence(projectId: string, onlineUsers: string[]) {
    if (this.wsManager) {
      console.log('🔧 Registry: Broadcasting presence update:', { projectId, onlineCount: onlineUsers.length });
      this.wsManager.broadcastToProject(projectId, {
        event: 'presence:change',
        online_users: onlineUsers,
        conversation_id: projectId,
      });
    }
  }

  broadcastMessageStatus(projectId: string, messageId: string, userId: string, status: string) {
    if (this.wsManager) {
      console.log('🔧 Registry: Broadcasting message status:', { projectId, messageId, userId, status });
      this.wsManager.broadcastToProject(projectId, {
        event: 'message:status',
        message_id: messageId,
        user_id: userId,
        status,
        conversation_id: projectId,
      });
    }
  }

  getOnlineUsers(projectId: string): string[] {
    if (this.wsManager) {
      return this.wsManager.getOnlineUsersInProject(projectId);
    }
    return [];
  }
}

export const wsRegistry = new WebSocketRegistry();