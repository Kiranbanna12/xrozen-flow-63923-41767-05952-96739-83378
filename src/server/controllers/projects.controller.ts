/**
 * Projects Controller - Handle project CRUD operations
 * Updated: Fixed crypto import issue
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { getDatabaseConfig } from '@/config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

export class ProjectsController {
  private db: Database.Database;

  constructor() {
    const config = getDatabaseConfig();
    this.db = new Database(config.filename);
  }

  /**
   * Get all projects (with optional filters)
   */
  getProjects = async (req: Request, res: Response) => {
    try {
      const { editor_id, client_id, status, parent_project_id } = req.query;
      const userId = (req as any).user.userId;

      console.log('🔧 Get projects - Filters:', { 
        editor_id, 
        client_id, 
        status, 
        parent_project_id,
        userId 
      });

      // If fetching sub-projects, don't restrict by creator_id
      // Otherwise, only show user's own projects
      let query = `
        SELECT p.*, 
               e.full_name as editor_name, e.email as editor_email,
               c.full_name as client_name, c.email as client_email
        FROM projects p
        LEFT JOIN editors e ON p.editor_id = e.id
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE 1=1
      `;
      const params: any[] = [];

      // If not fetching sub-projects, restrict to user's projects
      if (!parent_project_id) {
        query += ' AND p.creator_id = ?';
        params.push(userId);
      }

      if (editor_id) {
        query += ' AND p.editor_id = ?';
        params.push(editor_id);
      }

      if (client_id) {
        query += ' AND p.client_id = ?';
        params.push(client_id);
      }

      if (status) {
        query += ' AND p.status = ?';
        params.push(status);
      }

      if (parent_project_id) {
        query += ' AND p.parent_project_id = ?';
        params.push(parent_project_id);
      }

      query += ' ORDER BY p.created_at DESC';

      console.log('🔧 SQL Query:', query);
      console.log('🔧 SQL Params:', params);

      const projects = this.db.prepare(query).all(...params);

      console.log('🔧 Found projects:', projects.length);
      if (parent_project_id) {
        console.log('🔧 Sub-projects for parent:', parent_project_id);
        projects.forEach(p => {
          console.log(`  - ${p.name} (parent: ${p.parent_project_id}, is_subproject: ${p.is_subproject})`);
        });
      }

      return res.json(successResponse(projects));
    } catch (error: any) {
      console.error('Get projects error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get single project by ID
   */
  getProject = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      // First try to get project (without user restriction)
      const project = this.db.prepare(`
        SELECT p.*, 
               e.full_name as editor_name, e.email as editor_email,
               c.full_name as client_name, c.email as client_email
        FROM projects p
        LEFT JOIN editors e ON p.editor_id = e.id
        LEFT JOIN clients c ON p.client_id = c.id
        WHERE p.id = ?
      `).get(id);

      if (!project) {
        return res.status(404).json(errorResponse('Project not found'));
      }

      // Check if user has access to this project
      const hasAccess = this.db.prepare(`
        SELECT 1 FROM (
          -- Creator
          SELECT 1 FROM projects WHERE id = ? AND creator_id = ?
          UNION
          -- Editor
          SELECT 1 FROM projects p
          JOIN editors e ON p.editor_id = e.id
          WHERE p.id = ? AND e.user_id = ?
          UNION
          -- Client
          SELECT 1 FROM projects p
          JOIN clients c ON p.client_id = c.id
          WHERE p.id = ? AND c.user_id = ?
          UNION
          -- Chat member (shared access)
          SELECT 1 FROM project_chat_members
          WHERE project_id = ? AND user_id = ? AND is_active = 1
          UNION
          -- Project access log (shared access)
          SELECT 1 FROM project_access
          WHERE project_id = ? AND user_id = ?
        )
      `).get(id, userId, id, userId, id, userId, id, userId, id, userId);

      if (!hasAccess) {
        return res.status(403).json(errorResponse('You do not have access to this project'));
      }

      return res.json(successResponse(project));
    } catch (error: any) {
      console.error('Get project error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new project
   */
  createProject = async (req: Request, res: Response) => {
    try {
      console.log('🔧 Creating project with data:', req.body);
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;
      console.log('🔧 User ID from auth:', userId, 'Role:', userRole);
      
      if (!userId) {
        console.error('🔧 No user ID found in request');
        return res.status(401).json(errorResponse('User not authenticated'));
      }

      const projectData = {
        ...req.body,
        creator_id: userId
      };

      const requiredFields = ['name'];
      for (const field of requiredFields) {
        if (!projectData[field]) {
          console.error(`🔧 Missing required field: ${field}`);
          return res.status(400).json(errorResponse(`Missing required field: ${field}`));
        }
      }

      // Validate user permissions based on role
      const userCategory = this.db.prepare('SELECT user_category FROM users WHERE id = ?').get(userId) as any;
      
      if (userCategory) {
        const category = userCategory.user_category;
        console.log('🔧 User category:', category);

        // Editor can only add clients, not other editors
        if (category === 'editor' && projectData.editor_id) {
          console.error('🔧 Editor trying to add another editor');
          return res.status(403).json(errorResponse('Editors can only assign clients, not other editors'));
        }

        // Client can only add editors, not other clients
        if (category === 'client' && projectData.client_id) {
          console.error('🔧 Client trying to add another client');
          return res.status(403).json(errorResponse('Clients can only assign editors, not other clients'));
        }

        // Agency can add both (no restrictions)
      }

      const id = randomUUID();
      console.log('🔧 Generated project ID:', id);
      
      const now = new Date().toISOString();
      const insertResult = this.db.prepare(`
        INSERT INTO projects (
          id, name, description, creator_id, client_id, editor_id, deadline, 
          project_type, fee, status, parent_project_id, is_subproject, 
          raw_footage_link, assigned_date, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        projectData.name,
        projectData.description || null,
        projectData.creator_id,
        projectData.client_id || null,
        projectData.editor_id || null,
        projectData.deadline || null,
        projectData.project_type || null,
        projectData.fee || null,
        projectData.status || 'draft',
        projectData.parent_project_id || null,
        projectData.is_subproject ? 1 : 0,
        projectData.raw_footage_link || null,
        projectData.assigned_date || null,
        now,
        now
      );

      console.log('🔧 Insert result:', insertResult);

      const newProject = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
      console.log('🔧 New project created:', newProject);

      // Automatically add creator as chat member
      try {
        const creatorMemberId = `member_${Date.now()}_creator`;
        this.db.prepare(`
          INSERT INTO project_chat_members (
            id, project_id, user_id, joined_at, is_active
          ) VALUES (?, ?, ?, ?, 1)
        `).run(creatorMemberId, id, userId, now);
        console.log('✅ Creator added to chat members');

        // Add editor if present
        if (projectData.editor_id) {
          const editorMemberId = `member_${Date.now()}_editor`;
          this.db.prepare(`
            INSERT INTO project_chat_members (
              id, project_id, user_id, joined_at, is_active
            ) VALUES (?, ?, ?, ?, 1)
          `).run(editorMemberId, id, projectData.editor_id, now);
          console.log('✅ Editor added to chat members');
        }

        // Add client if present
        if (projectData.client_id) {
          // Get client's user_id
          const client = this.db.prepare('SELECT user_id FROM clients WHERE id = ?')
            .get(projectData.client_id) as any;
          
          if (client?.user_id) {
            const clientMemberId = `member_${Date.now()}_client`;
            this.db.prepare(`
              INSERT INTO project_chat_members (
                id, project_id, user_id, joined_at, is_active
              ) VALUES (?, ?, ?, ?, 1)
            `).run(clientMemberId, id, client.user_id, now);
            console.log('✅ Client added to chat members');
          }
        }
      } catch (error) {
        console.error('⚠️ Failed to add chat members:', error);
        // Don't fail project creation if chat member addition fails
      }

      return res.status(201).json(successResponse(newProject));
    } catch (error: any) {
      console.error('🔧 Create project error:', error);
      console.error('🔧 Error stack:', error.stack);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update project
   */
  updateProject = async (req: Request, res: Response) => {
    try {
      console.log('🔧 ==================== UPDATE PROJECT START ====================');
      console.log('🔧 Update project request:', { id: req.params.id, body: req.body });
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        console.error('❌ No user ID found');
        return res.status(401).json(errorResponse('User not authenticated'));
      }
      
      const updates = req.body;

      // Check project exists and user owns it
      const existing = this.db.prepare(`
        SELECT * FROM projects WHERE id = ? AND creator_id = ?
      `).get(id, userId);

      console.log('🔧 Existing project:', existing);

      if (!existing) {
        return res.status(404).json(errorResponse('Project not found or unauthorized'));
      }

      const allowedFields = [
        'name', 'description', 'project_type', 'editor_id', 'client_id',
        'raw_footage_link', 'assigned_date', 'deadline', 'fee', 'status',
        'parent_project_id', 'is_subproject'
      ];

      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      console.log('🔧 Update fields:', updateFields);

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => {
        const value = updates[field];
        // Convert undefined to null for SQLite
        if (value === undefined) return null;
        // Convert boolean to integer for SQLite (0 or 1)
        if (typeof value === 'boolean') return value ? 1 : 0;
        // Convert empty strings to null for optional fields
        if (value === '' && field !== 'name') return null;
        return value;
      });
      const now = new Date().toISOString();

      console.log('🔧 SQL Query:', `UPDATE projects SET ${setClause}, updated_at = ? WHERE id = ?`);
      console.log('🔧 SQL Values:', [...values, now, id]);

      try {
        const result = this.db.prepare(`
          UPDATE projects 
          SET ${setClause}, updated_at = ?
          WHERE id = ?
        `).run(...values, now, id);
        
        console.log('🔧 Update result:', result);
      } catch (sqlError: any) {
        console.error('❌ SQL execution error:', sqlError.message);
        console.error('❌ SQL Query:', `UPDATE projects SET ${setClause}, updated_at = ? WHERE id = ?`);
        console.error('❌ SQL Values:', [...values, now, id]);
        throw sqlError;
      }

      const updatedProject = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

      // Add new editor/client to chat if they were updated
      try {
        const now = new Date().toISOString();

        if (updates.editor_id && updates.editor_id !== (existing as any).editor_id) {
          // Check if editor is already a member
          const existingMember = this.db.prepare(`
            SELECT * FROM project_chat_members 
            WHERE project_id = ? AND user_id = ? AND is_active = 1
          `).get(id, updates.editor_id);

          if (!existingMember) {
            const editorMemberId = `member_${Date.now()}_editor`;
            this.db.prepare(`
              INSERT INTO project_chat_members (
                id, project_id, user_id, joined_at, is_active
              ) VALUES (?, ?, ?, ?, 1)
            `).run(editorMemberId, id, updates.editor_id, now);
            console.log('✅ New editor added to chat members');
          }
        }

        if (updates.client_id && updates.client_id !== (existing as any).client_id) {
          // Get client's user_id
          const client = this.db.prepare('SELECT user_id FROM clients WHERE id = ?')
            .get(updates.client_id) as any;
          
          if (client?.user_id) {
            // Check if client is already a member
            const existingMember = this.db.prepare(`
              SELECT * FROM project_chat_members 
              WHERE project_id = ? AND user_id = ? AND is_active = 1
            `).get(id, client.user_id);

            if (!existingMember) {
              const clientMemberId = `member_${Date.now()}_client`;
              this.db.prepare(`
                INSERT INTO project_chat_members (
                  id, project_id, user_id, joined_at, is_active
                ) VALUES (?, ?, ?, ?, 1)
              `).run(clientMemberId, id, client.user_id, now);
              console.log('✅ New client added to chat members');
            }
          }
        }
      } catch (error) {
        console.error('⚠️ Failed to add chat members:', error);
        // Don't fail project update if chat member addition fails
      }

      console.log('🔧 Project updated successfully:', updatedProject);
      console.log('🔧 ==================== UPDATE PROJECT END ====================');
      return res.json(successResponse(updatedProject));
    } catch (error: any) {
      console.error('❌ ==================== UPDATE PROJECT ERROR ====================');
      console.error('❌ Update project error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Request params:', req.params);
      console.error('❌ Request body:', req.body);
      console.error('❌ User ID:', (req as any).user?.userId);
      console.error('❌ ==================== ERROR END ====================');
      return res.status(500).json(errorResponse(error.message || 'Failed to update project'));
    }
  };

  /**
   * Delete project
   */
  deleteProject = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user.userId;

      const existing = this.db.prepare(`
        SELECT * FROM projects WHERE id = ? AND creator_id = ?
      `).get(id, userId);

      if (!existing) {
        return res.status(404).json(errorResponse('Project not found or unauthorized'));
      }

      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);

      return res.json(successResponse({ message: 'Project deleted successfully' }));
    } catch (error: any) {
      console.error('Delete project error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
