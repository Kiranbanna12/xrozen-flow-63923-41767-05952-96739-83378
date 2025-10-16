import { apiClient } from "@/lib/api-client";

export type NotificationType = 
  | 'project_created'
  | 'project_assigned'
  | 'project_status_changed'
  | 'version_added'
  | 'deadline_approaching'
  | 'deadline_overdue'
  | 'feedback_added'
  | 'feedback_replied'
  | 'correction_requested'
  | 'project_approved'
  | 'project_rejected'
  | 'invoice_generated'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_failed'
  | 'chat_message'
  | 'subscription_expiring'
  | 'subscription_renewed'
  | 'system_alert'
  | 'user_mentioned';

export type NotificationPriority = 'info' | 'important' | 'critical';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string | null;
  metadata?: any;
  read: boolean;
  created_at: string;
  read_at?: string | null;
  expires_at?: string | null;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  link?: string;
  metadata?: Record<string, any>;
  expiresInDays?: number;
}

export const notificationService = {
  /**
   * Create a new notification for a user
   */
  async create(params: CreateNotificationParams): Promise<Notification | null> {
    try {
      const expiresAt = params.expiresInDays 
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const notification = await apiClient.createNotification({
        user_id: params.userId,
        type: params.type === 'project_created' ? 'success' : 
              params.type === 'project_assigned' ? 'info' :
              params.type === 'version_added' ? 'warning' :
              params.type === 'feedback_added' ? 'warning' :
              params.type === 'correction_requested' ? 'error' :
              params.type === 'project_approved' ? 'success' :
              params.type === 'project_rejected' ? 'error' :
              params.type === 'invoice_generated' ? 'info' :
              params.type === 'payment_received' ? 'success' :
              params.type === 'payment_failed' ? 'error' :
              params.type === 'chat_message' ? 'info' :
              params.type === 'deadline_approaching' ? 'warning' :
              params.type === 'deadline_overdue' ? 'error' :
              params.type === 'system_alert' ? 'info' :
              'info',
        title: params.title,
        message: params.message,
        priority: params.priority || 'info',
        link: params.link,
        metadata: params.metadata || {},
        expires_at: expiresAt,
      });

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  },

  /**
   * Create notifications for multiple users
   */
  async createBulk(userIds: string[], params: Omit<CreateNotificationParams, 'userId'>): Promise<boolean> {
    try {
      const promises = userIds.map(userId => 
        this.create({ ...params, userId })
      );
      
      const results = await Promise.all(promises);
      return results.every(result => result !== null);
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      return false;
    }
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      await apiClient.markNotificationAsRead(notificationId);
      return true;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(): Promise<boolean> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return false;

      await apiClient.markAllNotificationsAsRead();
      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  },

  /**
   * Delete a notification
   */
  async delete(notificationId: string): Promise<boolean> {
    try {
      await apiClient.deleteNotification(notificationId);
      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  },

  /**
   * Delete all notifications for current user
   */
  async deleteAll(): Promise<boolean> {
    try {
      await apiClient.deleteAllNotifications();
      return true;
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      return false;
    }
  },

  /**
   * Get unread count for current user
   */
  async getUnreadCount(): Promise<number> {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return 0;

      const notifications = await apiClient.getNotifications();
      return notifications?.filter(n => !n.read).length || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  },

  /**
   * Get user's notifications with pagination
   */
  async getNotifications(limit: number = 50, offset: number = 0) {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return { data: [], count: 0 };

      const notifications = await apiClient.getNotifications();
      const paginatedData = notifications.slice(offset, offset + limit);
      
      return { data: paginatedData, count: notifications.length };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { data: [], count: 0 };
    }
  },
};
