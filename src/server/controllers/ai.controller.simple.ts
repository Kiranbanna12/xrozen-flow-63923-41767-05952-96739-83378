/**
 * Simplified AI Controller - Basic Implementation
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { randomUUID } from 'crypto';

export class AIController {
  private db: Database.Database;

  constructor() {
    const connectionManager = ConnectionManager.getInstance();
    this.db = connectionManager.getConnection();
  }

  /**
   * XrozenAI Chat - Simplified version that works without external APIs
   */
  chat = async (req: Request, res: Response): Promise<void> => {
    console.log('🔍 AI Chat endpoint called with user:', (req as any).user?.userId);
    console.log('📝 Request body:', req.body);
    console.log('🔑 Auth header present:', !!req.headers.authorization);
    
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        console.log('❌ No userId found in request');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { message, conversationId, messages } = req.body;
      console.log('📝 Message received:', { message, conversationId, messagesCount: messages?.length });

      if (!message) {
        console.log('❌ No message provided');
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Build context from user's data
      console.log('📋 Building user context...');
      
      const profile = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
      console.log('👤 Profile found:', !!profile);
      
      const projects = this.db.prepare('SELECT * FROM projects WHERE creator_id = ? ORDER BY created_at DESC LIMIT 10').all(userId);
      console.log('📊 Projects found:', projects.length);

      // Provide a helpful response based on user context
      let assistantMessage = '';
      
      if (message.toLowerCase().includes('project')) {
        assistantMessage = `I can help you with projects! You currently have ${projects.length} projects. Would you like me to create a new project, or would you like to see details about existing ones?`;
      } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
        assistantMessage = `Hello! I'm XrozenAI, your intelligent assistant for the Xrozen Workflow platform. I can help you:

• Create and manage video editing projects
• Track editors and clients  
• Handle payments and invoices
• Provide insights about your workflow

What would you like to do today?`;
      } else {
        assistantMessage = `I understand you said: "${message}". I'm currently running in basic mode. I can help you with:

• Managing your ${projects.length} projects
• Creating new projects or adding clients/editors
• Answering questions about your workflow

What specific task would you like help with?`;
      }

      // Create or update conversation
      let convId = conversationId;
      if (!convId) {
        convId = randomUUID();
        this.db.prepare(`
          INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at)
          VALUES (?, ?, ?, datetime('now'), datetime('now'))
        `).run(convId, userId, message.slice(0, 50));
        console.log('✅ Created new conversation:', convId);
      }

      // Save messages
      if (convId) {
        const userMsgId = randomUUID();
        const assistantMsgId = randomUUID();
        
        this.db.prepare(`
          INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, 'user', ?, datetime('now'))
        `).run(userMsgId, convId, message);
        
        this.db.prepare(`
          INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, 'assistant', ?, datetime('now'))
        `).run(assistantMsgId, convId, assistantMessage);
        
        console.log('✅ Saved messages to database');
      }

      console.log('✅ Sending response to client');
      res.json({ 
        response: assistantMessage,
        conversationId: convId
      });

    } catch (error) {
      console.error('❌ Error in XrozenAI chat method:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        userId: (req as any).user?.userId,
        body: req.body
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          endpoint: '/ai/chat'
        });
      }
    }
  };

  /**
   * Get AI conversation history
   */
  getConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversations = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
      `).all(userId);

      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  };

  /**
   * Create new conversation
   */
  createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { title } = req.body;
      const convId = randomUUID();
      
      this.db.prepare(`
        INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(convId, userId, title || 'New Conversation');

      const conversation = this.db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(convId);
      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  /**
   * Delete conversation
   */
  deleteConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { conversationId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify user owns this conversation
      const conversation = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE id = ? AND user_id = ?
      `).get(conversationId, userId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Delete messages first
      this.db.prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(conversationId);
      
      // Delete conversation
      this.db.prepare('DELETE FROM ai_conversations WHERE id = ?').run(conversationId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  };

  /**
   * Get messages for a conversation
   */
  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { conversationId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify user owns this conversation
      const conversation = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE id = ? AND user_id = ?
      `).get(conversationId, userId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const messages = this.db.prepare(`
        SELECT * FROM ai_messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
      `).all(conversationId);

      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  };
}