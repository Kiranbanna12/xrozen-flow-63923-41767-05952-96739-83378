/**
 * Editors Controller - Handle editor management
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';

export class EditorsController {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Get all editors
   */
  getEditors = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      const userCategory = (req as any).user?.user_category;

      console.log('🔒 Getting editors for user:', userId, 'Category:', userCategory);

      let editors;
      if (userCategory === 'agency') {
        // Agencies can see all editors for invoice generation
        editors = this.getDb().prepare(`
          SELECT DISTINCT e.*
          FROM editors e
          ORDER BY e.created_at DESC
        `).all();
        console.log('✅ Found all editors for agency:', editors.length);
      } else {
        // Regular users only see editors they added or are related to
        editors = this.getDb().prepare(`
          SELECT DISTINCT e.*
          FROM editors e
          LEFT JOIN user_relationships ur1 ON e.user_id = ur1.related_user_id AND ur1.user_id = ?
          LEFT JOIN user_relationships ur2 ON e.user_id = ur2.user_id AND ur2.related_user_id = ?
          WHERE e.added_by = ?
             OR ur1.id IS NOT NULL
             OR ur2.id IS NOT NULL
          ORDER BY e.created_at DESC
        `).all(userId, userId, userId);
        console.log('✅ Found editors with proper isolation:', editors.length);
      }

      return res.json(successResponse(editors));
    } catch (error: any) {
      console.error('Get editors error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get single editor
   */
  getEditor = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const editor = this.getDb().prepare(`
        SELECT * FROM editors WHERE id = ?
      `).get(id);

      if (!editor) {
        return res.status(404).json(errorResponse('Editor not found'));
      }

      return res.json(successResponse(editor));
    } catch (error: any) {
      console.error('Get editor error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new editor
   */
  createEditor = async (req: Request, res: Response) => {
    try {
      const editorData = req.body;
      const userId = (req as any).user?.userId; // Get logged-in user ID from auth middleware

      const requiredFields = ['full_name', 'email'];
      for (const field of requiredFields) {
        if (!editorData[field]) {
          return res.status(400).json(errorResponse(`Missing required field: ${field}`));
        }
      }

      const id = randomUUID();
      
      // Check if email already exists in profiles
      console.log(`\n        SELECT id FROM profiles WHERE email = '${editorData.email}'\n      `);
      const existingProfile = this.getDb().prepare(
        'SELECT id FROM profiles WHERE email = ?'
      ).get(editorData.email) as any;

      // Use existing profile ID if found, otherwise use the logged-in user's ID
      // This way editor entry is linked to a valid user
      const editorUserId = existingProfile ? existingProfile.id : userId;

      console.log('BEGIN TRANSACTION');
      const insertStmt = this.getDb().prepare(`
        INSERT INTO editors (
          id, user_id, full_name, email, phone, skills,
          hourly_rate, employment_type, availability, added_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      insertStmt.run(
        id,
        editorUserId, // Existing profile ID or logged-in user ID
        editorData.full_name,
        editorData.email,
        editorData.phone || null,
        editorData.skills || null,
        editorData.hourly_rate || null,
        editorData.employment_type || 'freelance',
        editorData.availability || null,
        userId // The logged-in user who is adding this editor
      );

      const newEditor = this.getDb().prepare('SELECT * FROM editors WHERE id = ?').get(id);

      return res.status(201).json(successResponse(newEditor));
    } catch (error: any) {
      console.error('Create editor error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update editor
   */
  updateEditor = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = this.getDb().prepare('SELECT * FROM editors WHERE id = ?').get(id);

      if (!existing) {
        return res.status(404).json(errorResponse('Editor not found'));
      }

      const allowedFields = [
        'user_id', 'full_name', 'email', 'phone', 'skills',
        'hourly_rate', 'employment_type', 'availability'
      ];

      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => updates[field]);

      this.getDb().prepare(`
        UPDATE editors 
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...values, id);

      const updatedEditor = this.getDb().prepare('SELECT * FROM editors WHERE id = ?').get(id);

      return res.json(successResponse(updatedEditor));
    } catch (error: any) {
      console.error('Update editor error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get projects for a specific editor
   */
  getEditorProjects = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const projects = this.getDb().prepare(`
        SELECT 
          p.*,
          c.full_name as client_name,
          c.company as client_company
        FROM projects p
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.editor_id = ?
        ORDER BY p.created_at DESC
      `).all(id);

      return res.json(successResponse(projects));
    } catch (error: any) {
      console.error('Get editor projects error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete editor
   */
  deleteEditor = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const editor = this.getDb().prepare(`
        SELECT * FROM editors WHERE id = ?
      `).get(id);

      if (!editor) {
        return res.status(404).json(errorResponse('Editor not found'));
      }

      this.getDb().prepare('DELETE FROM editors WHERE id = ?').run(id);

      return res.json(successResponse({ message: 'Editor deleted successfully' }));
    } catch (error: any) {
      console.error('Delete editor error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
