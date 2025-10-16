/**
 * Project Sharing Routes
 * Handles project sharing, access control, and tracking
 */

import { Router, Request, Response, NextFunction } from 'express';
import Database from 'better-sqlite3';
import { getDatabaseConfig } from '@/config/database.config';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { getWebSocketManager } from '../index';

// Initialize database connection
const config = getDatabaseConfig();
const db = new Database(config.filename);

const router = Router();

// Middleware to make auth optional
const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try to authenticate but don't fail if it doesn't work
    authMiddleware(req, res, (err?: any) => {
      // Continue even if auth fails
      next();
    });
  } else {
    next();
  }
};

/**
 * Generate a unique share token
 */
function generateShareToken(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let token = '';
  
  // Generate a 32-character token
  for (let i = 0; i < 32; i++) {
    token += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  // Check if token already exists
  const existing = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);
  
  if (existing) {
    // Recursively try again if token exists
    return generateShareToken();
  }
  
  return token;
}

/**
 * GET /api/projects/:projectId/shares
 * Get all shares for a project
 */
router.get('/projects/:projectId/shares', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    console.log('🔧 GET /projects/:projectId/shares - User:', userId, 'Project:', projectId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    console.log('🔧 Project found:', !!project);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // TODO: Add proper permission check after testing
    // For now, allow any authenticated user to view shares

    // Get all shares for the project
    const shares = db.prepare('SELECT * FROM project_shares WHERE project_id = ? ORDER BY created_at DESC').all(projectId);

    console.log('🔧 Shares found:', shares?.length || 0);

    res.json({
      success: true,
      data: shares || []
    });
  } catch (error: any) {
    console.error('🔧 Error fetching project shares:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project shares',
      details: error.message
    });
  }
});

/**
 * POST /api/project-shares
 * Create a new share link
 */
router.post('/project-shares', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, can_view, can_edit, can_chat } = req.body;
    const userId = req.user?.userId;

    console.log('🔧 POST /project-shares - User:', userId, 'Project:', project_id, 'Body:', req.body);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);

    console.log('🔧 Project found:', !!project, 'project_id:', project_id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // TODO: Add proper permission check after testing
    // For now, allow any authenticated user to create shares

    // Generate unique token
    const shareToken = generateShareToken();
    console.log('🔧 Generated share token:', shareToken);

    // Create share
    const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO project_shares (id, project_id, creator_id, share_token, can_view, can_edit, can_chat, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      project_id,
      userId,
      shareToken,
      can_view !== false ? 1 : 0,
      can_edit ? 1 : 0,
      can_chat ? 1 : 0,
      1,
      now,
      now
    );

    // Fetch the created share
    const createdShare = db.prepare('SELECT * FROM project_shares WHERE id = ?').get(id);

    console.log('🔧 Share created successfully:', createdShare);

    res.json({
      success: true,
      data: createdShare
    });
  } catch (error: any) {
    console.error('🔧 Error creating project share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project share',
      details: error.message
    });
  }
});

/**
 * PUT /api/project-shares/:shareId
 * Update a share link
 */
router.put('/project-shares/:shareId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { shareId } = req.params;
    const userId = req.user?.userId;
    const updateData = req.body;

    // Verify user owns the share
    const share = db.prepare('SELECT * FROM project_shares WHERE id = ? AND creator_id = ?').get(shareId, userId);

    if (!share) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to update this share'
      });
    }

    // Build update query dynamically
    const fields: string[] = [];
    const values: any[] = [];
    
    if (updateData.can_view !== undefined) {
      fields.push('can_view = ?');
      values.push(updateData.can_view ? 1 : 0);
    }
    if (updateData.can_edit !== undefined) {
      fields.push('can_edit = ?');
      values.push(updateData.can_edit ? 1 : 0);
    }
    if (updateData.can_chat !== undefined) {
      fields.push('can_chat = ?');
      values.push(updateData.can_chat ? 1 : 0);
    }
    if (updateData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updateData.is_active ? 1 : 0);
    }
    
    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(shareId);

    const stmt = db.prepare(`UPDATE project_shares SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    // Fetch updated share
    const updatedShare = db.prepare('SELECT * FROM project_shares WHERE id = ?').get(shareId);

    res.json({
      success: true,
      data: updatedShare
    });
  } catch (error: any) {
    console.error('Error updating project share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update project share'
    });
  }
});

/**
 * DELETE /api/project-shares/:shareId
 * Delete a share link
 */
router.delete('/project-shares/:shareId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { shareId } = req.params;
    const userId = req.user?.userId;

    // Verify user owns the share
    const share = db.prepare('SELECT * FROM project_shares WHERE id = ? AND creator_id = ?').get(shareId, userId);

    if (!share) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to delete this share'
      });
    }

    // Delete share
    db.prepare('DELETE FROM project_shares WHERE id = ?').run(shareId);

    res.json({
      success: true,
      message: 'Share deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting project share:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project share'
    });
  }
});

/**
 * GET /api/project-shares/token/:token
 * Get share information by token with project details (public endpoint)
 */
router.get('/project-shares/token/:token', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    // Get share by token
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);

    if (!share) {
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    if (!(share as any).is_active) {
      return res.status(403).json({
        success: false,
        error: 'This share link has been deactivated'
      });
    }

    // Get project details
    const project = db.prepare(`
      SELECT p.*,
             e.full_name as editor_name,
             e.email as editor_email,
             c.full_name as client_name,
             c.email as client_email,
             creator.full_name as creator_name
      FROM projects p
      LEFT JOIN editors e ON p.editor_id = e.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN profiles creator ON p.creator_id = creator.id
      WHERE p.id = ?
    `).get((share as any).project_id);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...share,
        project: project
      }
    });
  } catch (error: any) {
    console.error('Error fetching share by token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch share information'
    });
  }
});

/**
 * POST /api/project-shares/token/:token/log-access
 * Log access to a shared project
 */
router.post('/project-shares/token/:token/log-access', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const { user_agent, ip_address } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('📊 Logging share access:', { 
      token: token?.substring(0, 10) + '...', 
      userId,
      authenticated: !!userId 
    });

    // Get share by token
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);

    if (!share) {
      console.error('❌ Share not found for token:', token);
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    console.log('✅ Share found:', {
      shareId: (share as any).id,
      projectId: (share as any).project_id,
      isActive: (share as any).is_active
    });

    // Get project to check if user is the creator
    const project = db.prepare('SELECT creator_id FROM projects WHERE id = ?').get((share as any).project_id);
    
    // 🔒 CRITICAL FIX: Do NOT log access if user is the project creator
    // This prevents the creator's own projects from appearing in their "shared" list
    if (userId && project && (project as any).creator_id === userId) {
      console.log('⚠️ Skipping access log: User is the project creator');
      return res.json({
        success: true,
        message: 'Access logged successfully (creator - no log needed)'
      });
    }

    // Check if this user has already accessed this share (to avoid duplicates)
    if (userId) {
      const existingLog = db.prepare(`
        SELECT id FROM project_share_access_log 
        WHERE share_id = ? AND user_id = ?
      `).get((share as any).id, userId);

      console.log('🔍 Checking existing log:', { 
        shareId: (share as any).id, 
        userId, 
        exists: !!existingLog 
      });

      if (existingLog) {
        console.log('✅ User already has access log, updating timestamp');
        // Update the accessed_at timestamp
        db.prepare(`
          UPDATE project_share_access_log 
          SET accessed_at = ?, user_agent = ?, ip_address = ?
          WHERE share_id = ? AND user_id = ?
        `).run(
          new Date().toISOString(),
          user_agent || req.headers['user-agent'] || null,
          ip_address || req.ip || null,
          (share as any).id,
          userId
        );

        console.log('✅ Access log updated successfully');

        return res.json({
          success: true,
          message: 'Access logged successfully (updated existing)'
        });
      }
    }

    // Log new access (only for non-creators)
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    console.log('📝 Creating new access log:', {
      logId,
      shareId: (share as any).id,
      userId: userId || null,
      projectId: (share as any).project_id
    });

    const stmt = db.prepare(`
      INSERT INTO project_share_access_log (id, share_id, user_id, guest_identifier, accessed_at, user_agent, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      logId,
      (share as any).id,
      userId || null,
      !userId ? (req.ip || 'unknown') : null,
      now,
      user_agent || req.headers['user-agent'] || null,
      ip_address || req.ip || null
    );

    console.log('✅ Access logged successfully:', { logId, userId: userId || 'guest', projectId: (share as any).project_id });

    res.json({
      success: true,
      message: 'Access logged successfully'
    });
  } catch (error: any) {
    console.error('❌ Error logging share access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log access'
    });
  }
});

/**
 * GET /api/projects/:projectId/share-access-logs
 * Get access logs for a project's shares
 */
router.get('/projects/:projectId/share-access-logs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    console.log('🔧 GET /projects/:projectId/share-access-logs - User:', userId, 'Project:', projectId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Check if project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    console.log('🔧 Project found for access logs:', !!project);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // TODO: Add proper permission check after testing

    // Get all shares for the project
    const shares = db.prepare('SELECT * FROM project_shares WHERE project_id = ?').all(projectId);

    if (!shares || shares.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    const shareIds = shares.map((s: any) => s.id);

    // Get access logs for all shares
    const placeholders = shareIds.map(() => '?').join(',');
    const logs = db.prepare(`
      SELECT * FROM project_share_access_log 
      WHERE share_id IN (${placeholders})
      ORDER BY accessed_at DESC
    `).all(...shareIds);

    // Enrich with user profile data if available
    const enrichedLogs = logs.map((log: any) => {
      if (log.user_id) {
        const profile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(log.user_id);
        if (profile) {
          log.profile = profile;
        }
      }
      return log;
    });

    res.json({
      success: true,
      data: enrichedLogs
    });
  } catch (error: any) {
    console.error('Error fetching share access logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch access logs'
    });
  }
});

/**
 * POST /api/project-chat-members
 * Join a project chat
 */
router.post('/project-chat-members', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, share_id, guest_name } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    // Verify share if provided
    if (share_id) {
      const share = db.prepare('SELECT * FROM project_shares WHERE id = ?').get(share_id);

      if (!share || !(share as any).can_chat) {
        return res.status(403).json({
          success: false,
          error: 'You do not have permission to join this chat'
        });
      }
    }

    // 🔒 CRITICAL FIX: Check if user is the project creator
    // The creator should NOT be added as a chat member via share link
    if (userId) {
      const project = db.prepare('SELECT creator_id FROM projects WHERE id = ?').get(project_id);
      
      if (project && (project as any).creator_id === userId) {
        console.log('⚠️ Skipping chat member add: User is the project creator');
        return res.json({
          success: true,
          data: { 
            is_creator: true, 
            message: 'Project creator does not need to join via share link' 
          },
          message: 'Already a member (creator)'
        });
      }
    }

    // Check if already a member
    let existingMember;
    if (userId) {
      existingMember = db.prepare('SELECT * FROM project_chat_members WHERE project_id = ? AND user_id = ?').get(project_id, userId);
    } else {
      existingMember = db.prepare('SELECT * FROM project_chat_members WHERE project_id = ? AND guest_name = ?').get(project_id, guest_name);
    }

    if (existingMember) {
      return res.json({
        success: true,
        data: existingMember,
        message: 'Already a member'
      });
    }

    // Add member
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT INTO project_chat_members (id, project_id, user_id, guest_name, share_id, joined_at, last_seen_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      memberId,
      project_id,
      userId || null,
      !userId ? guest_name : null,
      share_id || null,
      now,
      now,
      1
    );

    const newMember = db.prepare('SELECT * FROM project_chat_members WHERE id = ?').get(memberId);

    // Create system message for join notification
    try {
      let displayName = guest_name;
      if (userId) {
        const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?').get(userId);
        if (profile) {
          displayName = (profile as any).full_name || (profile as any).email;
        }
      }

      const systemMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const systemMessageData = JSON.stringify({
        type: 'join',
        user_name: displayName,
        user_id: userId
      });

      db.prepare(`
        INSERT INTO messages (
          id, project_id, sender_id, content, is_system_message, 
          system_message_type, system_message_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        systemMessageId,
        project_id,
        userId || null,
        `${displayName} joined the chat`,
        1,
        'join',
        systemMessageData,
        now
      );

      console.log('✅ System message created for join notification');

      // Broadcast join notification via WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.sendToProject(project_id, 'chat:message', {
          id: systemMessageId,
          project_id,
          sender_id: userId || null,
          content: `${displayName} joined the chat`,
          is_system_message: true,
          system_message_type: 'join',
          system_message_data: systemMessageData,
          created_at: now
        });
        console.log('✅ WebSocket join notification sent');
      }
    } catch (error) {
      console.error('⚠️ Failed to create system message:', error);
      // Don't fail the request if system message fails
    }

    res.json({
      success: true,
      data: newMember
    });
  } catch (error: any) {
    console.error('Error joining project chat:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join project chat'
    });
  }
});

/**
 * GET /api/projects/:projectId/chat-members
 * Get chat members for a project
 */
router.get('/projects/:projectId/chat-members', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const members = db.prepare('SELECT * FROM project_chat_members WHERE project_id = ? AND is_active = 1').all(projectId);

    res.json({
      success: true,
      data: members || []
    });
  } catch (error: any) {
    console.error('Error fetching chat members:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat members'
    });
  }
});

/**
 * DELETE /api/projects/:projectId/chat-members/:memberId
 * Remove a member from project chat (admin only)
 */
router.delete('/projects/:projectId/chat-members/:memberId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, memberId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('🗑️ Removing chat member:', { projectId, memberId, adminUserId: userId });

    // Get project to verify admin status
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Check if user is project creator (admin)
    if ((project as any).creator_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only project admin can remove members'
      });
    }

    // Get member info before deletion
    const member = db.prepare('SELECT * FROM project_chat_members WHERE id = ? AND project_id = ?').get(memberId, projectId);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: 'Member not found'
      });
    }

    // Don't allow removing yourself
    if ((member as any).user_id === userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove yourself from chat'
      });
    }

    // Deactivate member instead of deleting (for history)
    const now = new Date().toISOString();
    db.prepare('UPDATE project_chat_members SET is_active = 0, removed_by = ?, removed_at = ? WHERE id = ?')
      .run(userId, now, memberId);

    // Create system message for leave notification
    try {
      let displayName = (member as any).guest_name;
      if ((member as any).user_id) {
        const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?').get((member as any).user_id);
        if (profile) {
          displayName = (profile as any).full_name || (profile as any).email;
        }
      }

      const systemMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const systemMessageData = JSON.stringify({
        type: 'leave',
        user_name: displayName,
        user_id: (member as any).user_id
      });

      db.prepare(`
        INSERT INTO messages (
          id, project_id, sender_id, content, is_system_message, 
          system_message_type, system_message_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        systemMessageId,
        projectId,
        userId,
        `${displayName} was removed from the chat`,
        1,
        'leave',
        systemMessageData,
        now
      );

      console.log('✅ System message created for leave notification');

      // Broadcast member removal via WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.sendToProject(projectId, 'chat:member_removed', {
          member_id: memberId,
          user_id: (member as any).user_id,
          user_name: displayName,
          removed_by: userId
        });
        console.log('✅ WebSocket broadcast sent for member removal');
      }
    } catch (error) {
      console.error('⚠️ Failed to create system message:', error);
      // Don't fail the request if system message fails
    }

    console.log('✅ Member removed successfully');

    res.json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error: any) {
    console.error('Error removing chat member:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove chat member'
    });
  }
});

/**
 * POST /api/shared-project-feedback
 * Add feedback from shared project users
 */
router.post('/shared-project-feedback', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { version_id, comment_text, share_token, timestamp_seconds } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('📝 Adding shared project feedback:', { 
      version_id, 
      share_token: share_token?.substring(0, 10) + '...', 
      userId,
      has_user: !!userId 
    });

    // Verify share token has edit permission
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(share_token);

    if (!share) {
      console.error('❌ Share token not found:', share_token);
      return res.status(404).json({
        success: false,
        error: 'Share token not found'
      });
    }

    if (!(share as any).can_edit) {
      console.error('❌ No edit permission for share token');
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to add feedback'
      });
    }

    // Require authentication for feedback
    if (!userId) {
      console.error('❌ User not authenticated');
      return res.status(401).json({
        success: false,
        error: 'Please login to add feedback'
      });
    }

    // Add feedback
    const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    console.log('✅ Adding feedback to database:', {
      feedbackId,
      version_id,
      userId,
      comment_length: comment_text?.length,
      timestamp_seconds
    });

    try {
      const stmt = db.prepare(`
        INSERT INTO video_feedback (id, version_id, user_id, comment_text, timestamp_seconds, is_resolved, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        feedbackId,
        version_id,
        userId,
        comment_text,
        timestamp_seconds || null,
        0,
        now,
        now
      );

      console.log('✅ Feedback inserted successfully');

      const feedback = db.prepare('SELECT * FROM video_feedback WHERE id = ?').get(feedbackId);

      console.log('✅ Feedback retrieved:', !!feedback);

      res.json({
        success: true,
        data: feedback
      });
    } catch (dbError: any) {
      console.error('❌ Database error inserting feedback:', dbError.message);
      throw dbError;
    }
  } catch (error: any) {
    console.error('❌ Error adding shared project feedback:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to add feedback',
      details: error.message
    });
  }
});

/**
 * GET /api/project-shares/token/:token/versions
 * Get project versions via share token (public endpoint)
 */
router.get('/project-shares/token/:token/versions', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;

    // Verify share token
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);

    if (!share || !(share as any).is_active) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or inactive share link'
      });
    }

    if (!(share as any).can_view) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view versions'
      });
    }

    // Get versions
    const versions = db.prepare(`
      SELECT * FROM video_versions 
      WHERE project_id = ? 
      ORDER BY version_number DESC
    `).all((share as any).project_id);

    res.json({
      success: true,
      data: versions || []
    });
  } catch (error: any) {
    console.error('Error fetching shared project versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch versions'
    });
  }
});

/**
 * GET /api/project-shares/token/:token/versions/:versionId
 * Get a specific version via share token (public endpoint)
 */
router.get('/project-shares/token/:token/versions/:versionId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token, versionId } = req.params;

    // Verify share token
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);

    if (!share || !(share as any).is_active) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or inactive share link'
      });
    }

    if (!(share as any).can_view) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view versions'
      });
    }

    // Get the specific version
    const version = db.prepare(`
      SELECT * FROM video_versions 
      WHERE id = ? AND project_id = ?
    `).get(versionId, (share as any).project_id);

    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    // Get the project details as well
    const project = db.prepare(`
      SELECT p.*,
             e.full_name as editor_name,
             e.email as editor_email,
             c.full_name as client_name,
             c.email as client_email,
             creator.full_name as creator_name
      FROM projects p
      LEFT JOIN editors e ON p.editor_id = e.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN profiles creator ON p.creator_id = creator.id
      WHERE p.id = ?
    `).get((share as any).project_id);

    res.json({
      success: true,
      data: {
        ...version,
        project: project
      }
    });
  } catch (error: any) {
    console.error('Error fetching shared version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version'
    });
  }
});

/**
 * GET /api/project-shares/token/:token/versions/:versionId/feedback
 * Get feedback for a version via share token (public endpoint)
 */
router.get('/project-shares/token/:token/versions/:versionId/feedback', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { token, versionId } = req.params;

    // Verify share token
    const share = db.prepare('SELECT * FROM project_shares WHERE share_token = ?').get(token);

    if (!share || !(share as any).is_active) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or inactive share link'
      });
    }

    if (!(share as any).can_view) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to view feedback'
      });
    }

    // Verify version belongs to the shared project
    const version = db.prepare(`
      SELECT * FROM video_versions 
      WHERE id = ? AND project_id = ?
    `).get(versionId, (share as any).project_id);

    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    // Get feedback for the version
    const feedback = db.prepare(`
      SELECT f.*,
             p.full_name as user_name,
             p.email as user_email
      FROM video_feedback f
      LEFT JOIN profiles p ON f.user_id = p.id
      WHERE f.version_id = ?
      ORDER BY f.timestamp_seconds ASC, f.created_at ASC
    `).all(versionId);

    res.json({
      success: true,
      data: feedback || []
    });
  } catch (error: any) {
    console.error('Error fetching shared version feedback:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feedback'
    });
  }
});

/**
 * GET /api/my-shared-projects
 * Get all projects shared with the current user (requires authentication)
 */
router.get('/my-shared-projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  // Disable all caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  try {
    const userId = (req as any).user?.userId;

    console.log('📋 Getting shared projects for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get all project_share_access_log entries for this user to find shared projects
    // OR get projects where user is a chat member (joined via share link)
    const sharedProjectIds = new Set<string>();

    // Method 1: From access logs
    const accessLogs = db.prepare(`
      SELECT DISTINCT ps.project_id
      FROM project_share_access_log psal
      JOIN project_shares ps ON psal.share_id = ps.id
      WHERE psal.user_id = ? AND ps.is_active = 1
    `).all(userId);

    console.log('📊 Found access logs:', accessLogs.length);

    accessLogs.forEach((log: any) => {
      sharedProjectIds.add(log.project_id);
      console.log('  ✓ Project from access log:', log.project_id);
    });

    // Method 2: From chat membership (users who joined via share)
    const chatMemberships = db.prepare(`
      SELECT DISTINCT pcm.project_id
      FROM project_chat_members pcm
      WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
    `).all(userId);

    console.log('💬 Found chat memberships:', chatMemberships.length);

    chatMemberships.forEach((membership: any) => {
      sharedProjectIds.add(membership.project_id);
      console.log('  ✓ Project from chat membership:', membership.project_id);
    });

    console.log('✅ Total unique shared projects:', sharedProjectIds.size);

    // If no shared projects found, return empty array
    if (sharedProjectIds.size === 0) {
      console.log('⚠️ No shared projects found for user');
      // Don't cache empty results
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.json({
        success: true,
        data: []
      });
    }

    // Get project details for all shared projects
    const projectIdsArray = Array.from(sharedProjectIds);
    const placeholders = projectIdsArray.map(() => '?').join(',');
    
    const projects = db.prepare(`
      SELECT p.*,
             e.full_name as editor_name,
             e.email as editor_email,
             c.full_name as client_name,
             c.email as client_email,
             creator.full_name as creator_name
      FROM projects p
      LEFT JOIN editors e ON p.editor_id = e.id
      LEFT JOIN clients c ON p.client_id = c.id
      LEFT JOIN profiles creator ON p.creator_id = creator.id
      WHERE p.id IN (${placeholders})
      ORDER BY p.created_at DESC
    `).all(...projectIdsArray);

    // Add share info for each project
    const projectsWithShareInfo = projects.map((project: any) => {
      // Get active share for this user
      const share = db.prepare(`
        SELECT ps.*
        FROM project_shares ps
        LEFT JOIN project_share_access_log psal ON ps.id = psal.share_id
        WHERE ps.project_id = ? 
          AND ps.is_active = 1 
          AND (psal.user_id = ? OR ps.id IN (
            SELECT share_id FROM project_chat_members WHERE user_id = ? AND project_id = ?
          ))
        LIMIT 1
      `).get(project.id, userId, userId, project.id);

      return {
        ...project,
        is_shared: true,
        share_info: share
      };
    });

    console.log('✅ Returning shared projects:', projectsWithShareInfo.length);

    // Prevent caching for fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
      success: true,
      data: projectsWithShareInfo
    });
  } catch (error: any) {
    console.error('❌ Error fetching shared projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shared projects'
    });
  }
});

/**
 * POST /api/projects/:projectId/chat-join-request
 * Create a join request for project chat
 */
router.post('/projects/:projectId/chat-join-request', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('📝 Creating chat join request:', { projectId, userId });

    // Check if user was removed from chat
    const removedMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 0
    `).get(projectId, userId);

    // Check if already has active membership
    const activeMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(projectId, userId);

    if (activeMember) {
      return res.json({
        success: true,
        data: { status: 'already_member' }
      });
    }

    // Check if pending request already exists
    const existingRequest = db.prepare(`
      SELECT * FROM chat_join_requests 
      WHERE project_id = ? AND user_id = ? AND status = 'pending'
    `).get(projectId, userId);

    if (existingRequest) {
      return res.json({
        success: true,
        data: existingRequest
      });
    }

    // Create join request
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO chat_join_requests (
        id, project_id, user_id, status, requested_at
      ) VALUES (?, ?, ?, 'pending', ?)
    `).run(requestId, projectId, userId, now);

    // Create system message for join request
    try {
      const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?').get(userId);
      const displayName = (profile as any)?.full_name || (profile as any)?.email || 'User';

      const systemMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const systemMessageData = JSON.stringify({
        type: 'join_request',
        user_name: displayName,
        user_id: userId,
        request_id: requestId
      });

      db.prepare(`
        INSERT INTO messages (
          id, project_id, sender_id, content, is_system_message, 
          system_message_type, system_message_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        systemMessageId,
        projectId,
        userId,
        `${displayName} requested to join the chat`,
        1,
        'join_request',
        systemMessageData,
        now
      );

      console.log('✅ System message created for join request');
      
      // Broadcast join request to all project members via WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?').get(userId);
        const displayName = (profile as any)?.full_name || (profile as any)?.email || 'User';
        
        wsManager.sendToProject(projectId, 'chat:join_request', {
          request_id: requestId,
          user_id: userId,
          user_name: displayName,
          requested_at: now
        });
        console.log('✅ WebSocket broadcast sent for join request');
      }
    } catch (error) {
      console.error('⚠️ Failed to create system message:', error);
    }

    const newRequest = db.prepare('SELECT * FROM chat_join_requests WHERE id = ?').get(requestId);

    res.json({
      success: true,
      data: newRequest
    });
  } catch (error: any) {
    console.error('Error creating join request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create join request'
    });
  }
});

/**
 * GET /api/projects/:projectId/chat-join-requests
 * Get pending join requests for a project (any chat member can view)
 */
router.get('/projects/:projectId/chat-join-requests', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    // Verify project exists
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Check if user is project creator OR a chat member
    const isCreator = (project as any).creator_id === userId;
    const member = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(projectId, userId);

    if (!isCreator && !member) {
      return res.status(403).json({
        success: false,
        error: 'Only chat members can view join requests'
      });
    }

    const requests = db.prepare(`
      SELECT * FROM chat_join_requests 
      WHERE project_id = ? AND status = 'pending'
      ORDER BY requested_at DESC
    `).all(projectId);

    res.json({
      success: true,
      data: requests || []
    });
  } catch (error: any) {
    console.error('Error fetching join requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch join requests'
    });
  }
});

/**
 * POST /api/projects/:projectId/chat-join-requests/:requestId/approve
 * Approve a join request (admin only)
 */
router.post('/projects/:projectId/chat-join-requests/:requestId/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requestId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('✅ Approving join request:', { projectId, requestId, approvingUserId: userId });

    // Verify user is a chat member (any member can approve)
    const member = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(projectId, userId);
    
    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Only chat members can approve join requests'
      });
    }

    // Get project for logging
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get request
    const request = db.prepare('SELECT * FROM chat_join_requests WHERE id = ? AND project_id = ?')
      .get(requestId, projectId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    if ((request as any).status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Request already processed'
      });
    }

    const now = new Date().toISOString();

    // Update request status
    db.prepare(`
      UPDATE chat_join_requests 
      SET status = 'approved', responded_at = ?, responded_by = ?
      WHERE id = ?
    `).run(now, userId, requestId);

    // Add user as chat member
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    db.prepare(`
      INSERT INTO project_chat_members (
        id, project_id, user_id, guest_name, joined_at, is_active
      ) VALUES (?, ?, ?, NULL, ?, 1)
    `).run(memberId, projectId, (request as any).user_id, now);

    // Also ensure user has project access entry for proper message retrieval
    const existingAccess = db.prepare('SELECT * FROM project_access WHERE project_id = ? AND user_id = ?')
      .get(projectId, (request as any).user_id);
    
    if (!existingAccess) {
      console.log('✅ Creating project_access entry for chat member');
      const accessId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      db.prepare(`
        INSERT INTO project_access (id, project_id, user_id, accessed_at)
        VALUES (?, ?, ?, ?)
      `).run(accessId, projectId, (request as any).user_id, now);
    }

    // Create system message for approval
    try {
      const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?')
        .get((request as any).user_id);
      const displayName = (profile as any)?.full_name || (profile as any)?.email || 'User';

      // Get approver name
      const approverProfile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?')
        .get(userId);
      const approverName = (approverProfile as any)?.full_name || (approverProfile as any)?.email || 'Someone';

      const systemMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const systemMessageData = JSON.stringify({
        type: 'join_approved',
        user_name: displayName,
        user_id: (request as any).user_id,
        approved_by: userId,
        approved_by_name: approverName
      });

      db.prepare(`
        INSERT INTO messages (
          id, project_id, sender_id, content, is_system_message, 
          system_message_type, system_message_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        systemMessageId,
        projectId,
        userId,
        `${displayName} was approved by ${approverName}`,
        1,
        'join_approved',
        systemMessageData,
        now
      );

      console.log('✅ System message created for approval');
      
      // Broadcast approval to all project members via WebSocket
      const wsManager = getWebSocketManager();
      if (wsManager) {
        wsManager.sendToProject(projectId, 'chat:request_approved', {
          request_id: requestId,
          user_id: (request as any).user_id,
          user_name: displayName,
          approved_by: userId,
          approved_by_name: approverName
        });
        console.log('✅ WebSocket broadcast sent for approval');
      }
    } catch (error) {
      console.error('⚠️ Failed to create system message:', error);
    }

    res.json({
      success: true,
      message: 'Request approved successfully'
    });
  } catch (error: any) {
    console.error('Error approving join request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve join request'
    });
  }
});

/**
 * POST /api/projects/:projectId/chat-join-requests/:requestId/reject
 * Reject a join request (admin only)
 */
router.post('/projects/:projectId/chat-join-requests/:requestId/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requestId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    console.log('❌ Rejecting join request:', { projectId, requestId, rejectingUserId: userId });

    // Verify user is a chat member (any member can reject)
    const member = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(projectId, userId);
    
    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Only chat members can reject join requests'
      });
    }

    // Get project for logging
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get request
    const request = db.prepare('SELECT * FROM chat_join_requests WHERE id = ? AND project_id = ?')
      .get(requestId, projectId);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found'
      });
    }

    const now = new Date().toISOString();

    // Update request status
    db.prepare(`
      UPDATE chat_join_requests 
      SET status = 'rejected', responded_at = ?, responded_by = ?
      WHERE id = ?
    `).run(now, userId, requestId);

    // Broadcast rejection via WebSocket to update UI for all users
    try {
      const wsManager = getWebSocketManager();
      if (wsManager) {
        const profile = db.prepare('SELECT full_name, email FROM profiles WHERE id = ?')
          .get((request as any).user_id);
        const displayName = (profile as any)?.full_name || (profile as any)?.email || 'User';

        wsManager.sendToProject(projectId, 'chat:request_rejected', {
          request_id: requestId,
          user_id: (request as any).user_id,
          user_name: displayName,
          rejected_by: userId
        });
        console.log('✅ WebSocket broadcast sent for rejection');
      }
    } catch (error) {
      console.error('⚠️ Failed to send WebSocket broadcast:', error);
    }

    res.json({
      success: true,
      message: 'Request rejected successfully'
    });
  } catch (error: any) {
    console.error('Error rejecting join request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject join request'
    });
  }
});

/**
 * GET /api/projects/:projectId/chat-access-status
 * Check if user has chat access or needs to request
 */
router.get('/projects/:projectId/chat-access-status', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.userId || (req as any).user?.id;

    // Check if user is project creator
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if ((project as any)?.creator_id === userId) {
      return res.json({
        success: true,
        data: { status: 'admin', hasAccess: true }
      });
    }

    // Check if active member
    const activeMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(projectId, userId);

    if (activeMember) {
      return res.json({
        success: true,
        data: { status: 'member', hasAccess: true }
      });
    }

    // Check if has pending request
    const pendingRequest = db.prepare(`
      SELECT * FROM chat_join_requests 
      WHERE project_id = ? AND user_id = ? AND status = 'pending'
    `).get(projectId, userId);

    if (pendingRequest) {
      return res.json({
        success: true,
        data: { status: 'pending', hasAccess: false, request: pendingRequest }
      });
    }

    // Check if was removed
    const removedMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 0
    `).get(projectId, userId);

    if (removedMember) {
      return res.json({
        success: true,
        data: { status: 'removed', hasAccess: false }
      });
    }

    // Check if rejected
    const rejectedRequest = db.prepare(`
      SELECT * FROM chat_join_requests 
      WHERE project_id = ? AND user_id = ? AND status = 'rejected'
      ORDER BY requested_at DESC LIMIT 1
    `).get(projectId, userId);

    if (rejectedRequest) {
      return res.json({
        success: true,
        data: { status: 'rejected', hasAccess: false }
      });
    }

    // User can request to join
    res.json({
      success: true,
      data: { status: 'can_request', hasAccess: false }
    });
  } catch (error: any) {
    console.error('Error checking chat access:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check chat access'
    });
  }
});

export default router;
