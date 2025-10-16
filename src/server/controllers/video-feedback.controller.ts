/**
 * Video Feedback Controller - Handle video feedback operations
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { getDatabaseConfig } from '@/config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

export class VideoFeedbackController {
  private db: Database.Database;

  constructor() {
    const config = getDatabaseConfig();
    this.db = new Database(config.filename);
  }

  /**
   * Get feedback for a video version
   */
  getFeedback = async (req: Request, res: Response) => {
    try {
      console.log('🔧 VideoFeedback: getFeedback called with versionId:', req.params.versionId);
      const { versionId } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      // Verify user has access to this version's project
      const version = this.db.prepare(`
        SELECT v.*, p.creator_id 
        FROM video_versions v
        JOIN projects p ON v.project_id = p.id
        WHERE v.id = ?
      `).get(versionId);

      if (!version) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      // Check if user is project owner OR has shared access to this project
      const hasAccess = this.db.prepare(`
        SELECT 1 FROM (
          -- User is project owner
          SELECT 1 WHERE ? = ?
          UNION
          -- User has access via project_share_access_log
          SELECT 1 FROM project_share_access_log psal
          JOIN project_shares ps ON psal.share_id = ps.id
          WHERE ps.project_id = ? AND psal.user_id = ? AND ps.is_active = 1
          UNION
          -- User is chat member
          SELECT 1 FROM project_chat_members pcm
          WHERE pcm.project_id = ? AND pcm.user_id = ?
        ) LIMIT 1
      `).get(userId, version.creator_id, version.project_id, userId, version.project_id, userId);

      if (!hasAccess) {
        console.log('🔧 Access denied for user:', userId, 'on project:', version.project_id);
        return res.status(403).json(errorResponse('Unauthorized access to this version'));
      }

      // Get all feedback with user info - organize as threaded comments
      const feedback = this.db.prepare(`
        SELECT f.*,
               u.full_name as user_name,
               u.email as user_email
        FROM video_feedback f
        LEFT JOIN profiles u ON f.user_id = u.id
        WHERE f.version_id = ?
        ORDER BY 
          CASE WHEN f.parent_id IS NULL THEN f.created_at END ASC,
          f.parent_id ASC,
          f.created_at ASC
      `).all(versionId);

      // Organize into threaded structure
      const topLevelComments = feedback.filter(f => !f.parent_id);
      const repliesMap = new Map();
      
      feedback.forEach(f => {
        if (f.parent_id) {
          if (!repliesMap.has(f.parent_id)) {
            repliesMap.set(f.parent_id, []);
          }
          repliesMap.get(f.parent_id).push(f);
        }
      });

      // Attach replies to their parent comments
      const organizedFeedback = topLevelComments.map(comment => ({
        ...comment,
        replies: repliesMap.get(comment.id) || []
      }));

      return res.json(successResponse(organizedFeedback));
    } catch (error: any) {
      console.error('Get feedback error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new feedback
   */
  createFeedback = async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const feedbackData = req.body;

      console.log('🔧 Creating feedback for version:', versionId);
      console.log('🔧 User ID:', userId);
      console.log('🔧 Feedback data:', feedbackData);

      // Verify user has access to this version's project
      const version = this.db.prepare(`
        SELECT v.*, p.creator_id 
        FROM video_versions v
        JOIN projects p ON v.project_id = p.id
        WHERE v.id = ?
      `).get(versionId);

      if (!version) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      // Check if user is project owner OR has shared access to this project
      const hasAccess = this.db.prepare(`
        SELECT 1 FROM (
          -- User is project owner
          SELECT 1 WHERE ? = ?
          UNION
          -- User has access via project_share_access_log
          SELECT 1 FROM project_share_access_log psal
          JOIN project_shares ps ON psal.share_id = ps.id
          WHERE ps.project_id = ? AND psal.user_id = ? AND ps.is_active = 1
          UNION
          -- User is chat member
          SELECT 1 FROM project_chat_members pcm
          WHERE pcm.project_id = ? AND pcm.user_id = ?
        ) LIMIT 1
      `).get(userId, version.creator_id, version.project_id, userId, version.project_id, userId);

      if (!hasAccess) {
        console.log('🔧 Access denied for user:', userId, 'on project:', version.project_id);
        return res.status(403).json(errorResponse('Unauthorized access to this version'));
      }

      console.log('🔧 User has access to submit feedback');

      const requiredFields = ['comment_text'];
      for (const field of requiredFields) {
        if (!feedbackData[field]) {
          return res.status(400).json(errorResponse(`Missing required field: ${field}`));
        }
      }

      const id = randomUUID();
      const now = new Date().toISOString();

      // Support parent_id for replies
      this.db.prepare(`
        INSERT INTO video_feedback (
          id, version_id, user_id, comment_text, timestamp_seconds, 
          is_resolved, parent_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        versionId,
        userId,
        feedbackData.comment_text,
        feedbackData.timestamp_seconds || null,
        0, // Convert false to 0 for SQLite
        feedbackData.parent_id || null, // Support replies
        now,
        now
      );

      console.log('🔧 Feedback created with ID:', id);

      // Auto-update version status to corrections_needed when feedback is added
      if (version.approval_status === 'approved' || version.approval_status === 'pending') {
        this.db.prepare(`
          UPDATE video_versions 
          SET approval_status = ?, feedback = ?
          WHERE id = ?
        `).run('corrections_needed', 'Feedback received - corrections needed', versionId);
        console.log('🔧 Updated version approval_status to corrections_needed');
      }

      const newFeedback = this.db.prepare(`
        SELECT f.*,
               u.full_name as user_name,
               u.email as user_email
        FROM video_feedback f
        LEFT JOIN profiles u ON f.user_id = u.id
        WHERE f.id = ?
      `).get(id);

      return res.status(201).json(successResponse(newFeedback));
    } catch (error: any) {
      console.error('🔧 Create feedback error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update feedback (resolve/unresolve)
   */
  updateFeedback = async (req: Request, res: Response) => {
    try {
      const { versionId, feedbackId } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;
      const updates = req.body;

      // Verify user has access to this version's project
      const version = this.db.prepare(`
        SELECT v.*, p.creator_id 
        FROM video_versions v
        JOIN projects p ON v.project_id = p.id
        WHERE v.id = ?
      `).get(versionId);

      if (!version) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      // Check if user is project owner OR has shared access to this project
      const hasAccess = this.db.prepare(`
        SELECT 1 FROM (
          -- User is project owner
          SELECT 1 WHERE ? = ?
          UNION
          -- User has access via project_share_access_log
          SELECT 1 FROM project_share_access_log psal
          JOIN project_shares ps ON psal.share_id = ps.id
          WHERE ps.project_id = ? AND psal.user_id = ? AND ps.is_active = 1
          UNION
          -- User is chat member
          SELECT 1 FROM project_chat_members pcm
          WHERE pcm.project_id = ? AND pcm.user_id = ?
        ) LIMIT 1
      `).get(userId, version.creator_id, version.project_id, userId, version.project_id, userId);

      if (!hasAccess) {
        return res.status(403).json(errorResponse('Unauthorized'));
      }

      // Check feedback exists
      const feedback = this.db.prepare(`
        SELECT * FROM video_feedback 
        WHERE id = ? AND version_id = ?
      `).get(feedbackId, versionId);

      if (!feedback) {
        return res.status(404).json(errorResponse('Feedback not found'));
      }

      const allowedFields = ['is_resolved', 'comment_text'];
      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      // Track edit history if comment_text is being updated
      let editHistoryUpdate = '';
      let editHistoryValue = null;
      
      if (updates.comment_text && feedback.comment_text !== updates.comment_text) {
        const now = new Date().toISOString();
        const editEntry = {
          editedAt: now,
          previousText: feedback.comment_text
        };
        
        // Get existing history or create new array
        let history = [];
        if (feedback.edit_history) {
          try {
            history = JSON.parse(feedback.edit_history);
          } catch (e) {
            history = [];
          }
        }
        
        // Add new edit to history
        history.push(editEntry);
        editHistoryValue = JSON.stringify(history);
        editHistoryUpdate = ', edit_history = ?';
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      // Convert boolean to number for SQLite compatibility
      const values = updateFields.map(field => {
        const value = updates[field];
        // Convert boolean to 0/1 for SQLite
        if (field === 'is_resolved') {
          return value ? 1 : 0;
        }
        return value;
      });

      const finalQuery = `
        UPDATE video_feedback 
        SET ${setClause}${editHistoryUpdate}, updated_at = ?
        WHERE id = ?
      `;
      
      const finalValues = editHistoryValue 
        ? [...values, editHistoryValue, new Date().toISOString(), feedbackId]
        : [...values, new Date().toISOString(), feedbackId];

      this.db.prepare(finalQuery).run(...finalValues);

      const updatedFeedback = this.db.prepare(`
        SELECT f.*,
               u.full_name as user_name,
               u.email as user_email
        FROM video_feedback f
        LEFT JOIN profiles u ON f.user_id = u.id
        WHERE f.id = ?
      `).get(feedbackId);

      return res.json(successResponse(updatedFeedback));
    } catch (error: any) {
      console.error('Update feedback error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete feedback
   */
  deleteFeedback = async (req: Request, res: Response) => {
    try {
      const { versionId, feedbackId } = req.params;
      const userId = (req as any).user?.userId || (req as any).user?.id;

      // Verify user has access to this version's project
      const version = this.db.prepare(`
        SELECT v.*, p.creator_id 
        FROM video_versions v
        JOIN projects p ON v.project_id = p.id
        WHERE v.id = ?
      `).get(versionId);

      if (!version) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      // Check if user is project owner OR has shared access to this project
      const hasAccess = this.db.prepare(`
        SELECT 1 FROM (
          -- User is project owner
          SELECT 1 WHERE ? = ?
          UNION
          -- User has access via project_share_access_log
          SELECT 1 FROM project_share_access_log psal
          JOIN project_shares ps ON psal.share_id = ps.id
          WHERE ps.project_id = ? AND psal.user_id = ? AND ps.is_active = 1
          UNION
          -- User is chat member
          SELECT 1 FROM project_chat_members pcm
          WHERE pcm.project_id = ? AND pcm.user_id = ?
        ) LIMIT 1
      `).get(userId, version.creator_id, version.project_id, userId, version.project_id, userId);

      if (!hasAccess) {
        return res.status(403).json(errorResponse('Unauthorized'));
      }

      // Check feedback exists
      const feedback = this.db.prepare(`
        SELECT * FROM video_feedback 
        WHERE id = ? AND version_id = ?
      `).get(feedbackId, versionId);

      if (!feedback) {
        return res.status(404).json(errorResponse('Feedback not found'));
      }

      // Delete feedback and all its replies (CASCADE will handle this)
      this.db.prepare('DELETE FROM video_feedback WHERE id = ?').run(feedbackId);

      return res.json(successResponse({ 
        message: 'Feedback deleted successfully',
        deletedId: feedbackId 
      }));
    } catch (error: any) {
      console.error('Delete feedback error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get feedback summary for a project (all versions)
   */
  getProjectFeedbackSummary = async (req: Request, res: Response) => {
    try {
      console.log('🔧 VideoFeedback: getProjectFeedbackSummary called for projectId:', req.params.projectId);
      const { projectId } = req.params;
      const userId = (req as any).user?.userId;

      console.log('🔧 VideoFeedback: User ID:', userId);

      if (!userId) {
        console.error('🔧 VideoFeedback: No user ID found');
        return res.status(401).json(errorResponse('User not authenticated'));
      }

      // Verify user has access to this project
      const project = this.db.prepare(`
        SELECT * FROM projects WHERE id = ? AND creator_id = ?
      `).get(projectId, userId);

      console.log('🔧 VideoFeedback: Project found:', !!project);

      if (!project) {
        return res.status(404).json(errorResponse('Project not found or unauthorized'));
      }

      const feedbackSummary = this.db.prepare(`
        SELECT 
          v.id as version_id,
          v.version_number,
          v.approval_status,
          COUNT(f.id) as total_feedback,
          COUNT(CASE WHEN f.is_resolved = 0 THEN 1 END) as unresolved_feedback
        FROM video_versions v
        LEFT JOIN video_feedback f ON v.id = f.version_id
        WHERE v.project_id = ?
        GROUP BY v.id, v.version_number, v.approval_status
        ORDER BY v.version_number DESC
      `).all(projectId);

      console.log('🔧 VideoFeedback: Feedback summary:', feedbackSummary);

      return res.json(successResponse(feedbackSummary));
    } catch (error: any) {
      console.error('🔧 VideoFeedback: Get project feedback summary error:', error);
      console.error('🔧 VideoFeedback: Error stack:', error.stack);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}