/**
 * Notifications Controller - Handle notification operations
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';

export class NotificationsController {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Get user notifications
   */
  getNotifications = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const notifications = this.getDb().prepare(`
        SELECT 
          id,
          recipient_user_id as user_id,
          sender_user_id,
          title,
          message,
          notification_type as type,
          read_status as read,
          metadata,
          created_at
        FROM notifications 
        WHERE recipient_user_id = ? 
        ORDER BY created_at DESC
        LIMIT 50
      `).all(userId);

      return res.json(successResponse(notifications));
    } catch (error: any) {
      console.error('Get notifications error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Mark notification as read
   */
  markAsRead = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const notification = this.getDb().prepare(`
        SELECT * FROM notifications WHERE id = ? AND recipient_user_id = ?
      `).get(id, userId);

      if (!notification) {
        return res.status(404).json(errorResponse('Notification not found'));
      }

      this.getDb().prepare(`
        UPDATE notifications SET read_status = 1 WHERE id = ?
      `).run(id);

      const updated = this.getDb().prepare(`
        SELECT 
          id,
          recipient_user_id as user_id,
          sender_user_id,
          title,
          message,
          notification_type as type,
          read_status as read,
          metadata,
          created_at
        FROM notifications WHERE id = ?
      `).get(id);

      return res.json(successResponse(updated));
    } catch (error: any) {
      console.error('Mark notification as read error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Mark all notifications as read
   */
  markAllAsRead = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      this.getDb().prepare(`
        UPDATE notifications SET read_status = 1 WHERE recipient_user_id = ? AND read_status = 0
      `).run(userId);

      return res.json(successResponse({ message: 'All notifications marked as read' }));
    } catch (error: any) {
      console.error('Mark all notifications as read error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create a new notification
   */
  createNotification = async (req: Request, res: Response) => {
    try {
      const notificationData = req.body;
      const id = randomUUID();

      this.getDb().prepare(`
        INSERT INTO notifications (
          id, recipient_user_id, sender_user_id, title, message, notification_type, read_status, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        notificationData.user_id || notificationData.recipient_user_id,
        notificationData.sender_user_id || null,
        notificationData.title || '',
        notificationData.message,
        notificationData.type || notificationData.notification_type || 'info',
        0,
        notificationData.metadata ? JSON.stringify(notificationData.metadata) : null,
        new Date().toISOString()
      );

      const newNotification = this.getDb().prepare(`
        SELECT 
          id,
          recipient_user_id as user_id,
          sender_user_id,
          title,
          message,
          notification_type as type,
          read_status as read,
          metadata,
          created_at
        FROM notifications WHERE id = ?
      `).get(id);

      return res.status(201).json(successResponse(newNotification));
    } catch (error: any) {
      console.error('Create notification error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete a notification
   */
  deleteNotification = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const notification = this.getDb().prepare(`
        SELECT * FROM notifications WHERE id = ? AND recipient_user_id = ?
      `).get(id, userId);

      if (!notification) {
        return res.status(404).json(errorResponse('Notification not found'));
      }

      this.getDb().prepare('DELETE FROM notifications WHERE id = ?').run(id);

      return res.json(successResponse({ message: 'Notification deleted successfully' }));
    } catch (error: any) {
      console.error('Delete notification error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete all notifications for user
   */
  deleteAllNotifications = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      this.getDb().prepare('DELETE FROM notifications WHERE recipient_user_id = ?').run(userId);

      return res.json(successResponse({ message: 'All notifications deleted successfully' }));
    } catch (error: any) {
      console.error('Delete all notifications error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get unread notification count
   */
  getUnreadCount = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const result = this.getDb().prepare(`
        SELECT COUNT(*) as count FROM notifications 
        WHERE recipient_user_id = ? AND read_status = 0
      `).get(userId) as { count: number };

      return res.json(successResponse({ count: result.count }));
    } catch (error: any) {
      console.error('Get unread count error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
