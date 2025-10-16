/**
 * Video Versions Controller - Handle video version management
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { getDatabaseConfig } from '@/config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

export class VideoVersionsController {
  private db: Database.Database;

  constructor() {
    const config = getDatabaseConfig();
    this.db = new Database(config.filename);
  }

  /**
   * Get video versions for a project
   */
  getVideoVersions = async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user.userId;

      console.log('Getting video versions for project:', projectId, 'user:', userId);

      // Check if project exists
      const project = this.db.prepare(`
        SELECT * FROM projects WHERE id = ?
      `).get(projectId);

      if (!project) {
        console.log('Project not found:', projectId);
        return res.status(404).json(errorResponse('Project not found'));
      }

      console.log('Project found:', project.name);

      // Get versions for the project
      const versions = this.db.prepare(`
        SELECT v.*,
               u.full_name as uploader_name
        FROM video_versions v
        LEFT JOIN profiles u ON v.uploader_id = u.id
        WHERE v.project_id = ?
        ORDER BY v.version_number DESC
      `).all(projectId);

      console.log('Found versions:', versions.length);
      return res.json(successResponse(versions));
    } catch (error: any) {
      console.error('Get video versions error:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new video version
   */
  createVideoVersion = async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const userId = (req as any).user.userId;
      const versionData = req.body;

      // Check if project exists
      const project = this.db.prepare(`
        SELECT * FROM projects WHERE id = ?
      `).get(projectId);

      if (!project) {
        return res.status(404).json(errorResponse('Project not found'));
      }

      // Get next version number
      const lastVersion = this.db.prepare(`
        SELECT MAX(version_number) as max_version FROM video_versions WHERE project_id = ?
      `).get(projectId) as { max_version: number | null };

      const versionNumber = (lastVersion.max_version || 0) + 1;

      const id = randomUUID();

      this.db.prepare(`
        INSERT INTO video_versions (
          id, project_id, version_number, file_url, uploader_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        projectId,
        versionNumber,
        versionData.preview_url || null,
        userId,
        'pending'
      );

      const newVersion = this.db.prepare('SELECT * FROM video_versions WHERE id = ?').get(id);

      return res.status(201).json(successResponse(newVersion));
    } catch (error: any) {
      console.error('Create video version error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update video version
   */
  updateVideoVersion = async (req: Request, res: Response) => {
    try {
      const { projectId, versionId } = req.params;
      const userId = (req as any).user.userId;
      const updates = req.body;

      // Check if project exists
      const project = this.db.prepare(`
        SELECT * FROM projects WHERE id = ?
      `).get(projectId);

      if (!project) {
        return res.status(404).json(errorResponse('Project not found'));
      }

      const existing = this.db.prepare(`
        SELECT * FROM video_versions WHERE id = ? AND project_id = ?
      `).get(versionId, projectId);

      if (!existing) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      const allowedFields = [
        'file_url', 'approval_status', 'feedback', 'final_url'
      ];

      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => updates[field]);

      this.db.prepare(`
        UPDATE video_versions 
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...values, versionId);

      const updatedVersion = this.db.prepare('SELECT * FROM video_versions WHERE id = ?').get(versionId);

      return res.json(successResponse(updatedVersion));
    } catch (error: any) {
      console.error('Update video version error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete video version
   */
  deleteVideoVersion = async (req: Request, res: Response) => {
    try {
      const { projectId, versionId } = req.params;
      const userId = (req as any).user.userId;

      // Check if project exists
      const project = this.db.prepare(`
        SELECT * FROM projects WHERE id = ?
      `).get(projectId);

      if (!project) {
        return res.status(404).json(errorResponse('Project not found'));
      }

      const existing = this.db.prepare(`
        SELECT * FROM video_versions WHERE id = ? AND project_id = ?
      `).get(versionId, projectId);

      if (!existing) {
        return res.status(404).json(errorResponse('Video version not found'));
      }

      this.db.prepare('DELETE FROM video_versions WHERE id = ?').run(versionId);

      return res.json(successResponse({ message: 'Video version deleted successfully' }));
    } catch (error: any) {
      console.error('Delete video version error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
