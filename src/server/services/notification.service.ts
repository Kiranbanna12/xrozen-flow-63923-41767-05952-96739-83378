/**
 * Notification Service - Handle notification creation and delivery
 */

import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { randomUUID } from 'crypto';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'project' | 'assignment' | 'payment';

export interface NotificationData {
  user_id: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
  metadata?: any;
}

export class NotificationService {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Create a new notification
   */
  async createNotification(data: NotificationData): Promise<any> {
    try {
      const id = randomUUID();
      const now = new Date().toISOString();

      console.log('📢 Creating notification:', data);

      this.getDb().prepare(`
        INSERT INTO notifications (
          id, user_id, title, message, type, is_read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        data.user_id,
        data.title,
        data.message,
        data.type || 'info',
        false,
        now
      );

      const notification = this.getDb().prepare(`
        SELECT * FROM notifications WHERE id = ?
      `).get(id);

      console.log('📢 Notification created:', notification);

      // TODO: Add real-time WebSocket notification here
      // wsServer.sendToUser(data.user_id, 'notification', notification);

      return notification;
    } catch (error) {
      console.error('❌ Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send project assignment notification
   */
  async notifyProjectAssignment(editorUserId: string, projectName: string, projectId: string): Promise<void> {
    await this.createNotification({
      user_id: editorUserId,
      title: 'New Project Assignment',
      message: `You have been assigned to work on "${projectName}". Check the project details and get started!`,
      type: 'project',
      link: `/projects/${projectId}`
    });
  }

  /**
   * Send new editor added notification
   */
  async notifyNewEditorAdded(creatorUserId: string, editorName: string, editorEmail: string): Promise<void> {
    await this.createNotification({
      user_id: creatorUserId,
      title: 'Editor Added Successfully',
      message: `Editor "${editorName}" (${editorEmail}) has been added to your team and can now receive project assignments.`,
      type: 'success',
      link: '/editors'
    });
  }

  /**
   * Send new client added notification
   */
  async notifyNewClientAdded(creatorUserId: string, clientName: string, clientEmail: string): Promise<void> {
    await this.createNotification({
      user_id: creatorUserId,
      title: 'Client Added Successfully',
      message: `Client "${clientName}" (${clientEmail}) has been added to your client list and can now be assigned to projects.`,
      type: 'success',
      link: '/clients'
    });
  }

  /**
   * Send project creation notification to assigned editor
   */
  async notifyProjectCreated(projectData: any): Promise<void> {
    try {
      // If project has an assigned editor, notify them
      if (projectData.editor_id) {
        // Get editor's user_id
        const editor = this.getDb().prepare(`
          SELECT user_id FROM editors WHERE id = ?
        `).get(projectData.editor_id);

        if (editor?.user_id) {
          await this.notifyProjectAssignment(editor.user_id, projectData.name, projectData.id);
        }
      }

      // If project has an assigned client, notify them
      if (projectData.client_id) {
        const client = this.getDb().prepare(`
          SELECT user_id FROM clients WHERE id = ?
        `).get(projectData.client_id);

        if (client?.user_id) {
          await this.createNotification({
            user_id: client.user_id,
            title: 'New Project Created',
            message: `A new project "${projectData.name}" has been created for you. You can track its progress and provide feedback.`,
            type: 'project',
            link: `/projects/${projectData.id}`
          });
        }
      }
    } catch (error) {
      console.error('❌ Error sending project notifications:', error);
    }
  }

  /**
   * Send project update notification
   */
  async notifyProjectUpdated(projectData: any, updatedFields: string[]): Promise<void> {
    try {
      const updateDescription = updatedFields.join(', ');
      
      // Notify editor if assigned
      if (projectData.editor_id) {
        const editor = this.getDb().prepare(`
          SELECT user_id FROM editors WHERE id = ?
        `).get(projectData.editor_id);

        if (editor?.user_id) {
          await this.createNotification({
            user_id: editor.user_id,
            title: 'Project Updated',
            message: `Project "${projectData.name}" has been updated. Changes: ${updateDescription}`,
            type: 'info',
            link: `/projects/${projectData.id}`
          });
        }
      }

      // Notify client if assigned
      if (projectData.client_id) {
        const client = this.getDb().prepare(`
          SELECT user_id FROM clients WHERE id = ?
        `).get(projectData.client_id);

        if (client?.user_id) {
          await this.createNotification({
            user_id: client.user_id,
            title: 'Project Updated',
            message: `Your project "${projectData.name}" has been updated. Changes: ${updateDescription}`,
            type: 'info',
            link: `/projects/${projectData.id}`
          });
        }
      }
    } catch (error) {
      console.error('❌ Error sending project update notifications:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();