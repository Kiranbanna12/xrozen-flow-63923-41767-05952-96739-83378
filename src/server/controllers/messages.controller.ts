/**
 * Messages Controller - Handle messaging operations
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';
import { wsRegistry } from '../websocket-registry';

export class MessagesController {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Get messages (optionally filtered by project)
   */
  getMessages = async (req: Request, res: Response) => {
    try {
      const { project_id } = req.query;
      const userId = (req as any).user.userId;

      console.log('🔧 getMessages called - project_id:', project_id, 'userId:', userId);

      // Set cache control headers to prevent stale data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      // If project_id is provided, check if user is creator or active member
      if (project_id) {
        console.log('🔧🔧🔧 UPDATED CONTROLLER CODE RUNNING - VERSION 2.0 🔧🔧🔧');
        // Check if user is creator or active member
        const db = this.getDb();
        const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
        console.log('🔧 Project found:', project ? 'YES' : 'NO');
        console.log('🔧 Project creator_id:', project?.creator_id);
        
        const isCreator = project && (project as any).creator_id === userId;
        console.log('🔧 Is creator?', isCreator);
        
        const isMember = db.prepare('SELECT * FROM project_chat_members WHERE project_id = ? AND user_id = ? AND is_active = 1').get(project_id, userId);
        console.log('🔧 Is member?', isMember ? 'YES' : 'NO', 'Member data:', isMember);

        // Also check if user has project access through project_access table
        const hasProjectAccess = db.prepare('SELECT * FROM project_access WHERE project_id = ? AND user_id = ?').get(project_id, userId);
        console.log('🔧 Has project access?', hasProjectAccess ? 'YES' : 'NO');

        if (isCreator || isMember || hasProjectAccess) {
          console.log('✅✅✅ User has access - fetching ALL messages for project chat ✅✅✅');
          // Show ALL messages in the project (group chat)
          const messages = db.prepare(`
            SELECT m.*,
                   sender.full_name as sender_name,
                   recipient.full_name as recipient_name
            FROM messages m
            LEFT JOIN profiles sender ON m.sender_id = sender.id
            LEFT JOIN profiles recipient ON m.recipient_id = recipient.id
            WHERE m.project_id = ?
            ORDER BY m.created_at ASC
          `).all(project_id);
          
          // Parse JSON columns (delivered_to and read_by)
          const messagesWithStatus = messages.map((msg: any) => ({
            ...msg,
            delivered_to: msg.delivered_to ? JSON.parse(msg.delivered_to) : [],
            read_by: msg.read_by ? JSON.parse(msg.read_by) : []
          }));
          
          console.log('🔧 Messages found:', messages.length);
          if (messages.length > 0) {
            console.log('🔧 First message ID:', messages[0].id, 'content:', messages[0].content);
            console.log('🔧 Last message ID:', messages[messages.length - 1].id, 'content:', messages[messages.length - 1].content);
          }
          return res.json(successResponse(messagesWithStatus));
        } else {
          // Not a member, deny access
          console.log('❌ Access denied - user is not creator or member');
          return res.status(403).json(errorResponse('You do not have access to this project chat'));
        }
      } else {
        // Direct messages: Show only messages where user is sender or recipient
        const messages = this.getDb().prepare(`
          SELECT m.*,
                 sender.full_name as sender_name,
                 recipient.full_name as recipient_name
          FROM messages m
          LEFT JOIN profiles sender ON m.sender_id = sender.id
          LEFT JOIN profiles recipient ON m.recipient_id = recipient.id
          WHERE (m.sender_id = ? OR m.recipient_id = ?)
          ORDER BY m.created_at ASC
        `).all(userId, userId);
        return res.json(successResponse(messages));
      }
    } catch (error: any) {
      console.error('Get messages error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new message
   */
  createMessage = async (req: Request, res: Response) => {
    try {
      console.log('Creating message with data:', req.body);
      const userId = (req as any).user.userId;
      console.log('User ID:', userId);
      
      const messageData = {
        project_id: req.body.project_id || req.body.conversation_id || null,
        content: req.body.content,
        message_type: req.body.message_type || 'text',
        file_url: req.body.file_url || null,
        sender_id: userId,
        recipient_id: req.body.recipient_id || null,
        reply_to_message_id: req.body.reply_to_message_id || null,
        created_at: new Date().toISOString()
      };

      console.log('Processed message data:', messageData);

      // Test WebSocket registry availability immediately
      console.log('🔧 Testing WebSocket registry availability...');
      console.log('🔧 Registry available:', wsRegistry.isAvailable());

      const requiredFields = ['content'];
      for (const field of requiredFields) {
        if (!messageData[field]) {
          console.error(`Missing required field: ${field}`);
          return res.status(400).json(errorResponse(`Missing required field: ${field}`));
        }
      }

      // If no explicit recipient and we have a project_id, find project participants
      if (!messageData.recipient_id && messageData.project_id) {
        const project = this.getDb().prepare(`
          SELECT client_id, editor_id FROM projects WHERE id = ?
        `).get(messageData.project_id);
        
        if (project) {
          // Set recipient as the other participant (not the sender)
          messageData.recipient_id = messageData.sender_id === project.client_id 
            ? project.editor_id 
            : project.client_id;
        }
      }

      const id = randomUUID();
      console.log('Generated message ID:', id);

      // Initialize delivered_to and read_by as empty arrays
      const delivered_to = JSON.stringify([]);
      const read_by = JSON.stringify([]);

      this.getDb().prepare(`
        INSERT INTO messages (
          id, project_id, sender_id, recipient_id, content, message_type, file_url, 
          is_read, created_at, status, delivered_to, read_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        messageData.project_id,
        messageData.sender_id,
        messageData.recipient_id,
        messageData.content,
        messageData.message_type,
        messageData.file_url,
        0, // is_read as integer
        messageData.created_at,
        'sent', // Set status as sent initially
        delivered_to,
        read_by
      );

      console.log('Message inserted successfully');

      const newMessage: any = this.getDb().prepare(`
        SELECT m.*,
               sender.full_name as sender_name,
               recipient.full_name as recipient_name
        FROM messages m
        LEFT JOIN profiles sender ON m.sender_id = sender.id
        LEFT JOIN profiles recipient ON m.recipient_id = recipient.id
        WHERE m.id = ?
      `).get(id);

      // Parse JSON columns for response
      const messageWithStatus = {
        ...newMessage,
        delivered_to: newMessage.delivered_to ? JSON.parse(newMessage.delivered_to) : [],
        read_by: newMessage.read_by ? JSON.parse(newMessage.read_by) : []
      };

      console.log('Retrieved new message:', messageWithStatus);

      // Broadcast message to WebSocket clients
      console.log('🔧 About to broadcast message:', messageWithStatus.id);
      this.broadcastMessage(messageWithStatus);
      console.log('🔧 Broadcast call completed');

      return res.status(201).json(successResponse(messageWithStatus));
    } catch (error: any) {
      console.error('Create message error:', error);
      console.error('Error stack:', error.stack);
      console.error('Request body:', req.body);
      console.error('User ID:', (req as any).user?.userId);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Broadcast message to WebSocket clients
   */
  private broadcastMessage(message: any) {
    try {
      console.log('🔧 Broadcasting message:', message.id, 'to project:', message.project_id);
      console.log('🔧 Message data:', {
        id: message.id,
        content: message.content,
        sender_id: message.sender_id,
        recipient_id: message.recipient_id,
        project_id: message.project_id
      });
      
      console.log('🔧 WebSocket registry available:', wsRegistry.isAvailable());

      // Broadcast to all users in the project
      if (message.project_id) {
        console.log('🔧 Broadcasting to project:', message.project_id);
        wsRegistry.broadcastMessage(message.project_id, message);
      }

      // Also send directly to sender and recipient if specified
      if (message.recipient_id) {
        console.log('🔧 Sending to recipient:', message.recipient_id);
        wsRegistry.sendToUsers([message.recipient_id], message.project_id, message);
      }
      
      console.log('🔧 Message broadcasting completed');
    } catch (error) {
      console.error('🔧 Error broadcasting message:', error);
    }
  }

  /**
   * Mark message as read
   */
  markAsRead = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;
      const { status } = req.body; // 'delivered' or 'read'

      const message: any = this.getDb().prepare(`
        SELECT * FROM messages WHERE id = ?
      `).get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Don't update status for own messages
      if (message.sender_id === userId) {
        return res.json(successResponse(message));
      }

      // Parse current arrays
      let delivered_to = [];
      let read_by = [];
      
      try {
        delivered_to = message.delivered_to ? JSON.parse(message.delivered_to) : [];
        read_by = message.read_by ? JSON.parse(message.read_by) : [];
      } catch (e) {
        console.error('Error parsing status arrays:', e);
      }

      // Update arrays based on status
      if (status === 'delivered' && !delivered_to.includes(userId)) {
        delivered_to.push(userId);
        console.log('🔧 Message', id, 'delivered to user', userId);
      } else if (status === 'read') {
        // Add to both arrays if not present
        if (!delivered_to.includes(userId)) {
          delivered_to.push(userId);
        }
        if (!read_by.includes(userId)) {
          read_by.push(userId);
          console.log('🔧 Message', id, 'read by user', userId);
        }
      }

      // Update database
      this.getDb().prepare(`
        UPDATE messages 
        SET delivered_to = ?, 
            read_by = ?,
            status = CASE 
              WHEN ? > 0 THEN 'read'
              WHEN ? > 0 THEN 'delivered'
              ELSE 'sent'
            END
        WHERE id = ?
      `).run(
        JSON.stringify(delivered_to),
        JSON.stringify(read_by),
        read_by.length,
        delivered_to.length,
        id
      );

      const updatedMessage: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);
      
      // Parse JSON for response
      const responseMessage = {
        ...updatedMessage,
        delivered_to: JSON.parse(updatedMessage.delivered_to || '[]'),
        read_by: JSON.parse(updatedMessage.read_by || '[]')
      };

      return res.json(successResponse(responseMessage));
    } catch (error: any) {
      console.error('Mark message as read error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get message delivery and read status info
   */
  getMessageInfo = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      // Get the message
      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Check if user is the sender
      if (message.sender_id !== userId) {
        return res.status(403).json(errorResponse('Unauthorized to view message info'));
      }

      // Parse delivered_to and read_by from database
      const deliveredToIds = message.delivered_to ? JSON.parse(message.delivered_to) : [];
      const readByIds = message.read_by ? JSON.parse(message.read_by) : [];

      // Get user details for delivered users
      const delivered_to = deliveredToIds.map((uid: string) => {
        const profile: any = this.getDb().prepare('SELECT id, email, full_name, avatar_url FROM profiles WHERE id = ?').get(uid);
        return {
          user_id: uid,
          timestamp: message.created_at,
          user: profile || { id: uid, email: 'Unknown', full_name: 'Unknown' }
        };
      });

      // Get user details for read users
      const read_by = readByIds.map((uid: string) => {
        const profile: any = this.getDb().prepare('SELECT id, email, full_name, avatar_url FROM profiles WHERE id = ?').get(uid);
        return {
          user_id: uid,
          timestamp: message.created_at,
          user: profile || { id: uid, email: 'Unknown', full_name: 'Unknown' }
        };
      });

      return res.json(successResponse({
        delivered_to,
        read_by
      }));
    } catch (error: any) {
      console.error('Get message info error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Pin/Unpin a message
   */
  togglePin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Check if user has permission (creator or admin)
      const project: any = this.getDb().prepare('SELECT * FROM projects WHERE id = ?').get(message.project_id);
      if (project.creator_id !== userId) {
        return res.status(403).json(errorResponse('Only project creator can pin messages'));
      }

      const newPinnedState = message.is_pinned ? 0 : 1;
      this.getDb().prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').run(newPinnedState, id);

      const updatedMessage = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      // Broadcast the update
      this.broadcastMessage({ ...updatedMessage, type: 'message_updated' });

      return res.json(successResponse(updatedMessage));
    } catch (error: any) {
      console.error('Toggle pin error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Star/Unstar a message
   */
  toggleStar = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      const newStarredState = message.is_starred ? 0 : 1;
      this.getDb().prepare('UPDATE messages SET is_starred = ? WHERE id = ?').run(newStarredState, id);

      const updatedMessage = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      return res.json(successResponse(updatedMessage));
    } catch (error: any) {
      console.error('Toggle star error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete a message
   */
  deleteMessage = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { deleteForEveryone } = req.body;
      const userId = (req as any).user.userId;

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      if (deleteForEveryone) {
        // Only sender can delete for everyone
        if (message.sender_id !== userId) {
          return res.status(403).json(errorResponse('Only sender can delete for everyone'));
        }

        // Check if message is within 1 hour
        const messageTime = new Date(message.created_at).getTime();
        const now = Date.now();
        const hourInMs = 60 * 60 * 1000;

        if (now - messageTime > hourInMs) {
          return res.status(403).json(errorResponse('Can only delete for everyone within 1 hour'));
        }

        // Soft delete - replace content
        this.getDb().prepare(`
          UPDATE messages 
          SET content = 'This message was deleted', 
              is_deleted = 1,
              deleted_at = datetime('now'),
              deleted_by = ?
          WHERE id = ?
        `).run(userId, id);

        const updatedMessage = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);
        this.broadcastMessage({ ...updatedMessage, type: 'message_deleted' });

        return res.json(successResponse({ deleted: true, forEveryone: true }));
      } else {
        // Delete for me - just hide from this user
        // In a real app, you'd have a user_deleted_messages table
        return res.json(successResponse({ deleted: true, forEveryone: false }));
      }
    } catch (error: any) {
      console.error('Delete message error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Report a message
   */
  reportMessage = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.userId;

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Create report (you'd need a message_reports table)
      const reportId = randomUUID();
      
      // For now, just log it - in real app, insert into message_reports table
      console.log('Message reported:', { reportId, messageId: id, reason, reportedBy: userId });

      return res.json(successResponse({ 
        reported: true, 
        message: 'Message has been reported to administrators' 
      }));
    } catch (error: any) {
      console.error('Report message error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * React to a message with emoji
   */
  reactToMessage = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;
      const userId = (req as any).user.userId;

      if (!emoji) {
        return res.status(400).json(errorResponse('Emoji is required'));
      }

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Parse existing reactions
      let reactions: any = {};
      if (message.reactions) {
        try {
          reactions = JSON.parse(message.reactions);
        } catch (e) {
          reactions = {};
        }
      }

      // Toggle reaction
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      const userIndex = reactions[emoji].indexOf(userId);
      if (userIndex > -1) {
        // Remove reaction
        reactions[emoji].splice(userIndex, 1);
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      } else {
        // Add reaction
        reactions[emoji].push(userId);
      }

      // Update message
      this.getDb().prepare(`
        UPDATE messages SET reactions = ? WHERE id = ?
      `).run(JSON.stringify(reactions), id);

      const updatedMessage = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);
      this.broadcastMessage({ ...updatedMessage, type: 'message_updated' });

      return res.json(successResponse(updatedMessage));
    } catch (error: any) {
      console.error('React to message error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Edit a message
   */
  editMessage = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { content } = req.body;
      const userId = (req as any).user.userId;

      if (!content || !content.trim()) {
        return res.status(400).json(errorResponse('Content is required'));
      }

      const message: any = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);

      if (!message) {
        return res.status(404).json(errorResponse('Message not found'));
      }

      // Only sender can edit
      if (message.sender_id !== userId) {
        return res.status(403).json(errorResponse('Only sender can edit message'));
      }

      // Check if message is within 15 minutes
      const messageTime = new Date(message.created_at).getTime();
      const now = Date.now();
      const fifteenMinutesInMs = 15 * 60 * 1000;

      if (now - messageTime > fifteenMinutesInMs) {
        return res.status(403).json(errorResponse('Can only edit within 15 minutes'));
      }

      // Update message
      this.getDb().prepare(`
        UPDATE messages 
        SET content = ?, 
            is_edited = 1,
            edited_at = datetime('now')
        WHERE id = ?
      `).run(content.trim(), id);

      const updatedMessage = this.getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id);
      this.broadcastMessage({ ...updatedMessage, type: 'message_updated' });

      return res.json(successResponse(updatedMessage));
    } catch (error: any) {
      console.error('Edit message error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get unread message counts for all projects user has access to
   */
  getUnreadCounts = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const db = this.getDb();

      // Get all projects where user is creator, member, or has access
      const projectsQuery = `
        SELECT DISTINCT p.id, p.name
        FROM projects p
        LEFT JOIN project_chat_members pcm ON p.id = pcm.project_id AND pcm.user_id = ? AND pcm.is_active = 1
        LEFT JOIN project_access pa ON p.id = pa.project_id AND pa.user_id = ?
        WHERE p.creator_id = ? OR pcm.user_id IS NOT NULL OR pa.user_id IS NOT NULL
      `;
      
      const projects = db.prepare(projectsQuery).all(userId, userId, userId);
      
      // Get unread counts for each project
      const unreadCounts = projects.map((project: any) => {
        // Get last read timestamp for this project
        const lastRead = db.prepare(`
          SELECT last_read_at FROM project_last_read 
          WHERE project_id = ? AND user_id = ?
        `).get(project.id, userId) as any;

        // If never read, count all messages except user's own
        // If has read, count messages after last_read_at
        let unreadCount = 0;
        
        if (!lastRead) {
          unreadCount = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE project_id = ? AND sender_id != ?
          `).get(project.id, userId).count;
        } else {
          unreadCount = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE project_id = ? 
              AND sender_id != ? 
              AND created_at > ?
          `).get(project.id, userId, lastRead.last_read_at).count;
        }

        // Get latest message timestamp
        const latestMessage = db.prepare(`
          SELECT created_at, content FROM messages 
          WHERE project_id = ? 
          ORDER BY created_at DESC 
          LIMIT 1
        `).get(project.id) as any;

        return {
          project_id: project.id,
          project_name: project.name,
          unread_count: unreadCount,
          last_message_at: latestMessage?.created_at || null,
          last_message_preview: latestMessage?.content?.substring(0, 50) || null
        };
      });

      // Calculate total unread
      const totalUnread = unreadCounts.reduce((sum, p) => sum + p.unread_count, 0);

      return res.json(successResponse({
        projects: unreadCounts,
        total_unread: totalUnread
      }));
    } catch (error: any) {
      console.error('Get unread counts error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Mark all messages in a project as read by updating last_read_at
   */
  markProjectAsRead = async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user.userId;
      const db = this.getDb();

      // Check if user has access to this project
      const hasAccess = db.prepare(`
        SELECT 1 FROM projects p
        LEFT JOIN project_chat_members pcm ON p.id = pcm.project_id AND pcm.user_id = ? AND pcm.is_active = 1
        LEFT JOIN project_access pa ON p.id = pa.project_id AND pa.user_id = ?
        WHERE p.id = ? AND (p.creator_id = ? OR pcm.user_id IS NOT NULL OR pa.user_id IS NOT NULL)
      `).get(userId, userId, projectId, userId);

      if (!hasAccess) {
        return res.status(403).json(errorResponse('You do not have access to this project'));
      }

      const now = new Date().toISOString();

      // Upsert last_read_at
      const existing = db.prepare(`
        SELECT id FROM project_last_read WHERE project_id = ? AND user_id = ?
      `).get(projectId, userId);

      if (existing) {
        db.prepare(`
          UPDATE project_last_read 
          SET last_read_at = ?, updated_at = ? 
          WHERE project_id = ? AND user_id = ?
        `).run(now, now, projectId, userId);
      } else {
        const { randomUUID } = await import('crypto');
        db.prepare(`
          INSERT INTO project_last_read (id, project_id, user_id, last_read_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), projectId, userId, now, now, now);
      }

      return res.json(successResponse({ 
        project_id: projectId, 
        marked_read_at: now 
      }));
    } catch (error: any) {
      console.error('Mark project as read error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
