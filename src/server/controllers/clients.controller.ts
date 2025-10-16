/**
 * Clients Controller - Handle client management
 */

import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';

export class ClientsController {
  private connectionManager: ConnectionManager;

  constructor() {
    this.connectionManager = ConnectionManager.getInstance();
  }

  private getDb() {
    return this.connectionManager.getConnection();
  }

  /**
   * Get all clients
   */
  getClients = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      
      console.log('🔒 Getting clients for user:', userId);

      // Get clients that belong to this user or are shared with them
      const clients = this.getDb().prepare(`
        SELECT DISTINCT c.*
        FROM clients c
        LEFT JOIN user_relationships ur1 ON c.user_id = ur1.related_user_id AND ur1.user_id = ?
        LEFT JOIN user_relationships ur2 ON c.user_id = ur2.user_id AND ur2.related_user_id = ?
        WHERE c.added_by = ?
           OR ur1.id IS NOT NULL
           OR ur2.id IS NOT NULL
        ORDER BY c.created_at DESC
      `).all(userId, userId, userId);

      console.log('✅ Found clients with proper isolation:', clients.length);

      return res.json(successResponse(clients));
    } catch (error: any) {
      console.error('Get clients error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get single client
   */
  getClient = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const client = this.getDb().prepare(`
        SELECT * FROM clients WHERE id = ?
      `).get(id);

      if (!client) {
        return res.status(404).json(errorResponse('Client not found'));
      }

      return res.json(successResponse(client));
    } catch (error: any) {
      console.error('Get client error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create new client
   */
  createClient = async (req: Request, res: Response) => {
    try {
      console.log('🔧 Creating client with data:', req.body);
      const clientData = req.body;
      const userId = (req as any).user?.userId; // Get logged-in user ID from auth middleware

      const requiredFields = ['full_name', 'email'];
      for (const field of requiredFields) {
        if (!clientData[field]) {
          console.error(`🔧 Missing required field: ${field}`);
          return res.status(400).json(errorResponse(`Missing required field: ${field}`));
        }
      }

      const id = randomUUID();
      console.log('🔧 Generated client ID:', id);

      // Map frontend employment types to database values
      let employmentType = clientData.employment_type || 'individual';
      if (employmentType === 'freelance') employmentType = 'individual';
      if (employmentType === 'fulltime') employmentType = 'company';

      // Check if email already exists in profiles
      console.log(`\n        SELECT id FROM profiles WHERE email = '${clientData.email}'\n      `);
      const existingProfile = this.getDb().prepare(
        'SELECT id FROM profiles WHERE email = ?'
      ).get(clientData.email) as any;

      // Use existing profile ID if found, otherwise use the logged-in user's ID
      // This way client entry is linked to a valid user
      const clientUserId = existingProfile ? existingProfile.id : userId;

      console.log('BEGIN TRANSACTION');
      const insertResult = this.getDb().prepare(`
        INSERT INTO clients (
          id, user_id, full_name, email, phone, company,
          employment_type, added_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        clientUserId, // Existing profile ID or logged-in user ID
        clientData.full_name,
        clientData.email,
        clientData.phone || null,
        clientData.company || null,
        employmentType,
        userId // The logged-in user who is adding this client
      );

      console.log('🔧 Insert result:', insertResult);

      const newClient = this.getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id);
      console.log('🔧 New client created:', newClient);

      return res.status(201).json(successResponse(newClient));
    } catch (error: any) {
      console.error('🔧 Create client error:', error);
      console.error('🔧 Error stack:', error.stack);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update client
   */
  updateClient = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const existing = this.getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id);

      if (!existing) {
        return res.status(404).json(errorResponse('Client not found'));
      }

      const allowedFields = [
        'user_id', 'full_name', 'email', 'phone', 'company', 'employment_type'
      ];

      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => updates[field]);

      this.getDb().prepare(`
        UPDATE clients 
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...values, id);

      const updatedClient = this.getDb().prepare('SELECT * FROM clients WHERE id = ?').get(id);

      return res.json(successResponse(updatedClient));
    } catch (error: any) {
      console.error('Update client error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get projects for a specific client
   */
  getClientProjects = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const projects = this.getDb().prepare(`
        SELECT 
          p.*,
          e.full_name as editor_name,
          e.email as editor_email
        FROM projects p
        LEFT JOIN editors e ON p.editor_id = e.id
        WHERE p.client_id = ?
        ORDER BY p.created_at DESC
      `).all(id);

      return res.json(successResponse(projects));
    } catch (error: any) {
      console.error('Get client projects error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete client
   */
  deleteClient = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const client = this.getDb().prepare(`
        SELECT * FROM clients WHERE id = ?
      `).get(id);

      if (!client) {
        return res.status(404).json(errorResponse('Client not found'));
      }

      this.getDb().prepare('DELETE FROM clients WHERE id = ?').run(id);

      return res.json(successResponse({ message: 'Client deleted successfully' }));
    } catch (error: any) {
      console.error('Delete client error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
