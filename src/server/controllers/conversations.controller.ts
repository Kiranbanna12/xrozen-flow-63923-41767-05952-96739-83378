/**
 * Conversations Controller - Handle conversation operations
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';

export class ConversationsController {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Get all conversations for current user
   */
  getConversations = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      const conversations = this.getDb().prepare(`
        SELECT DISTINCT 
          c.*,
          (
            SELECT COUNT(*) 
            FROM messages m
            LEFT JOIN message_status ms ON m.id = ms.message_id AND ms.user_id = ?
            WHERE m.conversation_id = c.id 
            AND m.sender_id != ?
            AND (ms.status IS NULL OR ms.status != 'read')
          ) as unread_count
        FROM conversations c
        LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = ?
        ORDER BY c.updated_at DESC
      `).all(userId, userId, userId);

      // Get last message for each conversation
      const conversationsWithMessages = conversations.map((conv: any) => {
        const lastMessage = this.getDb().prepare(`
          SELECT m.*, p.full_name as sender_name, p.avatar_url as sender_avatar
          FROM messages m
          LEFT JOIN profiles p ON m.sender_id = p.id
          WHERE m.conversation_id = ?
          ORDER BY m.created_at DESC
          LIMIT 1
        `).get(conv.id);

        return {
          ...conv,
          lastMessage,
        };
      });

      return res.json(successResponse(conversationsWithMessages));
    } catch (error: any) {
      console.error('Get conversations error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get single conversation with participants
   */
  getConversation = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      // Check if user is participant
      const isParticipant = this.getDb().prepare(`
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = ? AND user_id = ?
      `).get(id, userId);

      if (!isParticipant) {
        return res.status(403).json(errorResponse('Access denied'));
      }

      const conversation = this.getDb().prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(id);

      if (!conversation) {
        return res.status(404).json(errorResponse('Conversation not found'));
      }

      // Get participants
      const participants = this.getDb().prepare(`
        SELECT cp.*, p.full_name, p.email, p.avatar_url
        FROM conversation_participants cp
        LEFT JOIN profiles p ON cp.user_id = p.id
        WHERE cp.conversation_id = ?
      `).all(id);

      return res.json(successResponse({
        ...conversation,
        participants,
      }));
    } catch (error: any) {
      console.error('Get conversation error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new conversation
   */
  createConversation = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { conversation_type, name, project_id, participant_ids } = req.body;

      if (!conversation_type || !participant_ids || participant_ids.length === 0) {
        return res.status(400).json(errorResponse('Missing required fields'));
      }

      const conversationId = randomUUID();
      const now = new Date().toISOString();

      // Create conversation
      this.getDb().prepare(`
        INSERT INTO conversations (
          id, conversation_type, name, project_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        conversationId,
        conversation_type,
        name || null,
        project_id || null,
        userId,
        now,
        now
      );

      // Add creator as participant
      const allParticipants = [userId, ...participant_ids];
      const uniqueParticipants = [...new Set(allParticipants)];

      for (const participantId of uniqueParticipants) {
        this.getDb().prepare(`
          INSERT INTO conversation_participants (
            id, conversation_id, user_id, joined_at
          ) VALUES (?, ?, ?, ?)
        `).run(randomUUID(), conversationId, participantId, now);
      }

      const newConversation = this.getDb().prepare(`
        SELECT * FROM conversations WHERE id = ?
      `).get(conversationId);

      return res.status(201).json(successResponse(newConversation));
    } catch (error: any) {
      console.error('Create conversation error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add participants to conversation
   */
  addParticipants = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user_ids } = req.body;
      const userId = (req as any).user.userId;

      if (!user_ids || user_ids.length === 0) {
        return res.status(400).json(errorResponse('Missing user_ids'));
      }

      // Check if requester is participant
      const isParticipant = this.getDb().prepare(`
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = ? AND user_id = ?
      `).get(id, userId);

      if (!isParticipant) {
        return res.status(403).json(errorResponse('Access denied'));
      }

      const now = new Date().toISOString();

      for (const participantId of user_ids) {
        // Check if already participant
        const exists = this.getDb().prepare(`
          SELECT 1 FROM conversation_participants 
          WHERE conversation_id = ? AND user_id = ?
        `).get(id, participantId);

        if (!exists) {
          this.getDb().prepare(`
            INSERT INTO conversation_participants (
              id, conversation_id, user_id, joined_at
            ) VALUES (?, ?, ?, ?)
          `).run(randomUUID(), id, participantId, now);
        }
      }

      return res.json(successResponse({ message: 'Participants added successfully' }));
    } catch (error: any) {
      console.error('Add participants error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Set typing status
   */
  setTypingStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { is_typing } = req.body;
      const userId = (req as any).user.userId;

      // Check if user is participant
      const isParticipant = this.getDb().prepare(`
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = ? AND user_id = ?
      `).get(id, userId);

      if (!isParticipant) {
        return res.status(403).json(errorResponse('Access denied'));
      }

      const now = new Date().toISOString();

      // Upsert typing indicator
      const existing = this.getDb().prepare(`
        SELECT id FROM typing_indicators 
        WHERE conversation_id = ? AND user_id = ?
      `).get(id, userId);

      if (existing) {
        this.getDb().prepare(`
          UPDATE typing_indicators 
          SET is_typing = ?, last_updated = ?
          WHERE id = ?
        `).run(is_typing ? 1 : 0, now, (existing as any).id);
      } else {
        this.getDb().prepare(`
          INSERT INTO typing_indicators (
            id, conversation_id, user_id, is_typing, last_updated
          ) VALUES (?, ?, ?, ?, ?)
        `).run(randomUUID(), id, userId, is_typing ? 1 : 0, now);
      }

      // TODO: Broadcast via WebSocket
      // wsServer.broadcast('typing:change', { conversation_id: id, user_id: userId, is_typing });

      return res.json(successResponse({ message: 'Typing status updated' }));
    } catch (error: any) {
      console.error('Set typing status error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get typing indicators for conversation
   */
  getTypingIndicators = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      // Check if user is participant
      const isParticipant = this.getDb().prepare(`
        SELECT 1 FROM conversation_participants 
        WHERE conversation_id = ? AND user_id = ?
      `).get(id, userId);

      if (!isParticipant) {
        return res.status(403).json(errorResponse('Access denied'));
      }

      const indicators = this.getDb().prepare(`
        SELECT ti.*, p.full_name
        FROM typing_indicators ti
        LEFT JOIN profiles p ON ti.user_id = p.id
        WHERE ti.conversation_id = ? 
        AND ti.user_id != ?
        AND ti.is_typing = 1
        AND ti.last_updated > datetime('now', '-10 seconds')
      `).all(id, userId);

      return res.json(successResponse(indicators));
    } catch (error: any) {
      console.error('Get typing indicators error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
