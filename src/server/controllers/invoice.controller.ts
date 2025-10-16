/**
 * Invoice Controller - Handle invoice CRUD operations
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { getDatabaseConfig } from '../../config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
    user_category?: string;
  };
}

export class InvoiceController {
  private static db: Database.Database;

  private static getDb() {
    if (!this.db) {
      const config = getDatabaseConfig();
      this.db = new Database(config.filename);
    }
    return this.db;
  }

  /**
   * Get all invoices with filters
   */
  static getAllInvoices = async (req: AuthRequest, res: Response) => {
    try {
      const { editor_id, client_id, status, month } = req.query;
      const userId = req.user?.userId;

      console.log('🔧 Get invoices - User:', userId, 'Filters:', { 
        editor_id, 
        client_id, 
        status, 
        month 
      });

      let query = `
        SELECT i.*, 
               e.full_name as editor_name, e.email as editor_email,
               c.full_name as client_name, c.email as client_email,
               cr.full_name as creator_name, cr.email as creator_email
        FROM invoices i
        LEFT JOIN profiles e ON i.editor_id = e.id
        LEFT JOIN profiles c ON i.client_id = c.id
        LEFT JOIN profiles cr ON i.creator_id = cr.id
        WHERE (i.creator_id = ? OR i.editor_id = ? OR i.client_id = ?)
      `;
      const params: any[] = [userId, userId, userId];

      if (editor_id) {
        query += ' AND i.editor_id = ?';
        params.push(editor_id);
      }

      if (client_id) {
        query += ' AND i.client_id = ?';
        params.push(client_id);
      }

      if (status) {
        query += ' AND i.status = ?';
        params.push(status);
      }

      if (month) {
        query += ' AND i.month = ?';
        params.push(month);
      }

      query += ' ORDER BY i.created_at DESC';

      const db = this.getDb();
      const invoices = db.prepare(query).all(params);

      // Transform data to match frontend expectations
      const transformedInvoices = invoices.map((invoice: any) => ({
        ...invoice,
        editor: invoice.editor_name ? {
          full_name: invoice.editor_name,
          email: invoice.editor_email
        } : null,
        client: invoice.client_name ? {
          full_name: invoice.client_name,
          email: invoice.client_email
        } : null,
        creator: invoice.creator_name ? {
          full_name: invoice.creator_name,
          email: invoice.creator_email
        } : null
      }));

      console.log('🔧 Found invoices:', transformedInvoices.length);
      res.json(successResponse(transformedInvoices, 'Invoices retrieved successfully'));
    } catch (error) {
      console.error('🔧 Error fetching invoices:', error);
      res.status(500).json(errorResponse('Failed to fetch invoices', 'FETCH_ERROR'));
    }
  };

  /**
   * Get single invoice by ID
   */
  static getInvoiceById = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const db = this.getDb();
      const invoice = db.prepare(`
        SELECT i.*, 
               e.full_name as editor_name, e.email as editor_email,
               c.full_name as client_name, c.email as client_email,
               cr.full_name as creator_name, cr.email as creator_email
        FROM invoices i
        LEFT JOIN profiles e ON i.editor_id = e.id
        LEFT JOIN profiles c ON i.client_id = c.id
        LEFT JOIN profiles cr ON i.creator_id = cr.id
        WHERE i.id = ? AND (i.creator_id = ? OR i.editor_id = ? OR i.client_id = ?)
      `).get(id, userId, userId, userId);

      if (!invoice) {
        return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
      }

      // Transform data
      const transformedInvoice = {
        ...invoice,
        editor: invoice.editor_name ? {
          full_name: invoice.editor_name,
          email: invoice.editor_email
        } : null,
        client: invoice.client_name ? {
          full_name: invoice.client_name,
          email: invoice.client_email
        } : null,
        creator: invoice.creator_name ? {
          full_name: invoice.creator_name,
          email: invoice.creator_email
        } : null
      };

      res.json(successResponse(transformedInvoice, 'Invoice retrieved successfully'));
    } catch (error) {
      console.error('🔧 Error fetching invoice:', error);
      res.status(500).json(errorResponse('Failed to fetch invoice', 'FETCH_ERROR'));
    }
  };

  static createInvoice = async (req: AuthRequest, res: Response) => {
    try {
      console.log('🔧 InvoiceController: Creating invoice, req.user:', req.user);
      const userId = req.user?.userId;
      console.log('🔧 InvoiceController: userId:', userId);
      
      if (!userId) {
        console.log('🔧 InvoiceController: No userId found, returning 401');
        return res.status(401).json(errorResponse('User not authenticated', 'UNAUTHORIZED'));
      }

      const {
        invoice_number,
        editor_id,
        client_id,
        month,
        total_amount,
        paid_amount = 0,
        total_deductions = 0,
        status = 'pending',
        payment_method,
        proceed_date,
        paid_date,
        due_date,
        notes
      } = req.body;

      console.log('🔧 InvoiceController: Request body:', req.body);

      // Validate required fields
      if (!invoice_number || !month || total_amount === undefined) {
        console.log('🔧 InvoiceController: Missing required fields');
        return res.status(400).json(errorResponse('Missing required fields: invoice_number, month, total_amount', 'VALIDATION_ERROR'));
      }

      const invoiceId = randomUUID();
      const remaining_amount = Number(total_amount) - Number(paid_amount) - Number(total_deductions);

      console.log('🔧 InvoiceController: Inserting invoice with data:', {
        invoiceId, invoice_number, editor_id, client_id, userId, month, 
        total_amount: Number(total_amount), paid_amount: Number(paid_amount), 
        remaining_amount, total_deductions: Number(total_deductions), status
      });

      const db = this.getDb();
      const result = db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, editor_id, client_id, creator_id,
          month, total_amount, paid_amount, remaining_amount, total_deductions,
          status, payment_method, proceed_date, paid_date, due_date, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        invoiceId, invoice_number, editor_id, client_id, userId,
        month, Number(total_amount), Number(paid_amount), remaining_amount, Number(total_deductions),
        status, payment_method, proceed_date, paid_date, due_date, notes
      );

      console.log('🔧 Invoice created:', invoiceId);
      res.status(201).json(successResponse({ id: invoiceId }, 'Invoice created successfully'));
    } catch (error) {
      console.error('🔧 Error creating invoice:', error);
      res.status(500).json(errorResponse('Failed to create invoice', 'CREATE_ERROR'));
    }
  };

  /**
   * Update invoice
   */
  static updateInvoice = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const updateData = req.body;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const existing = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!existing || existing.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to update this invoice', 'UNAUTHORIZED'));
      }

      // Build update query dynamically
      const allowedFields = [
        'invoice_number', 'editor_id', 'client_id', 'month',
        'total_amount', 'paid_amount', 'total_deductions', 'status',
        'payment_method', 'proceed_date', 'paid_date', 'due_date', 'notes'
      ];

      const updates = [];
      const params = [];

      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update', 'NO_UPDATES'));
      }

      updates.push('updated_at = datetime(\'now\')');
      params.push(id);

      const query = `UPDATE invoices SET ${updates.join(', ')} WHERE id = ?`;
      db.prepare(query).run(params);

      console.log('🔧 Invoice updated:', id);
      res.json(successResponse(null, 'Invoice updated successfully'));
    } catch (error) {
      console.error('🔧 Error updating invoice:', error);
      res.status(500).json(errorResponse('Failed to update invoice', 'UPDATE_ERROR'));
    }
  };

  /**
   * Delete invoice
   */
  static deleteInvoice = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const existing = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!existing) {
        return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
      }
      
      if (existing.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to delete this invoice', 'UNAUTHORIZED'));
      }

      db.prepare('DELETE FROM invoices WHERE id = ?').run(id);

      console.log('🔧 Invoice deleted:', id);
      res.json(successResponse(null, 'Invoice deleted successfully'));
    } catch (error) {
      console.error('🔧 Error deleting invoice:', error);
      res.status(500).json(errorResponse('Failed to delete invoice', 'DELETE_ERROR'));
    }
  };

  /**
   * Get invoice items
   */
  static getInvoiceItems = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const db = this.getDb();
      
      // Check if user has access to this invoice
      const invoice = db.prepare(`
        SELECT id FROM invoices 
        WHERE id = ? AND (creator_id = ? OR editor_id = ? OR client_id = ?)
      `).get(id, userId, userId, userId);

      if (!invoice) {
        return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
      }

      const items = db.prepare(`
        SELECT ii.*, p.name as project_name
        FROM invoice_items ii
        LEFT JOIN projects p ON ii.project_id = p.id
        WHERE ii.invoice_id = ?
        ORDER BY ii.created_at
      `).all(id);

      res.json(successResponse(items, 'Invoice items retrieved successfully'));
    } catch (error) {
      console.error('🔧 Error fetching invoice items:', error);
      res.status(500).json(errorResponse('Failed to fetch invoice items', 'FETCH_ERROR'));
    }
  };

  /**
   * Add invoice item
   */
  static addInvoiceItem = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { project_id, item_name, amount } = req.body;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const invoice = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!invoice || invoice.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to modify this invoice', 'UNAUTHORIZED'));
      }

      const itemId = randomUUID();
      db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, project_id, item_name, amount, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(itemId, id, project_id, item_name, amount);

      console.log('🔧 Invoice item added:', itemId);
      res.status(201).json(successResponse({ id: itemId }, 'Invoice item added successfully'));
    } catch (error) {
      console.error('🔧 Error adding invoice item:', error);
      res.status(500).json(errorResponse('Failed to add invoice item', 'CREATE_ERROR'));
    }
  };

  /**
   * Update invoice item
   */
  static updateInvoiceItem = async (req: AuthRequest, res: Response) => {
    try {
      const { id, itemId } = req.params;
      const userId = req.user?.userId;
      const { project_id, item_name, amount } = req.body;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const invoice = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!invoice || invoice.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to modify this invoice', 'UNAUTHORIZED'));
      }

      db.prepare(`
        UPDATE invoice_items 
        SET project_id = ?, item_name = ?, amount = ?
        WHERE id = ? AND invoice_id = ?
      `).run(project_id, item_name, amount, itemId, id);

      console.log('🔧 Invoice item updated:', itemId);
      res.json(successResponse(null, 'Invoice item updated successfully'));
    } catch (error) {
      console.error('🔧 Error updating invoice item:', error);
      res.status(500).json(errorResponse('Failed to update invoice item', 'UPDATE_ERROR'));
    }
  };

  /**
   * Delete invoice item
   */
  static deleteInvoiceItem = async (req: AuthRequest, res: Response) => {
    try {
      const { id, itemId } = req.params;
      const userId = req.user?.userId;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const invoice = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!invoice || invoice.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to modify this invoice', 'UNAUTHORIZED'));
      }

      db.prepare('DELETE FROM invoice_items WHERE id = ? AND invoice_id = ?').run(itemId, id);

      console.log('🔧 Invoice item deleted:', itemId);
      res.json(successResponse(null, 'Invoice item deleted successfully'));
    } catch (error) {
      console.error('🔧 Error deleting invoice item:', error);
      res.status(500).json(errorResponse('Failed to delete invoice item', 'DELETE_ERROR'));
    }
  };

  /**
   * Add payment to invoice
   */
  static addPayment = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { amount, payment_method, notes } = req.body;

      const db = this.getDb();
      
      // Check if user owns this invoice
      const invoice = db.prepare('SELECT creator_id, paid_amount FROM invoices WHERE id = ?').get(id);
      if (!invoice || invoice.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to modify this invoice', 'UNAUTHORIZED'));
      }

      const paymentId = randomUUID();
      
      // Add to payment history
      db.prepare(`
        INSERT INTO payment_history (id, invoice_id, amount, payment_method, notes, payment_date, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(paymentId, id, amount, payment_method, notes);

      // Update invoice paid amount
      const newPaidAmount = parseFloat(invoice.paid_amount) + parseFloat(amount);
      db.prepare(`
        UPDATE invoices SET paid_amount = ?, updated_at = datetime('now') WHERE id = ?
      `).run(newPaidAmount, id);

      console.log('🔧 Payment added to invoice:', id, 'Amount:', amount);
      res.status(201).json(successResponse({ id: paymentId }, 'Payment added successfully'));
    } catch (error) {
      console.error('🔧 Error adding payment:', error);
      res.status(500).json(errorResponse('Failed to add payment', 'CREATE_ERROR'));
    }
  };

  /**
   * Get payment history for invoice
   */
  static getPaymentHistory = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const db = this.getDb();
      
      // Check if user has access to this invoice
      const invoice = db.prepare(`
        SELECT id FROM invoices 
        WHERE id = ? AND (creator_id = ? OR editor_id = ? OR client_id = ?)
      `).get(id, userId, userId, userId);

      if (!invoice) {
        return res.status(404).json(errorResponse('Invoice not found', 'NOT_FOUND'));
      }

      const payments = db.prepare(`
        SELECT * FROM payment_history 
        WHERE invoice_id = ? 
        ORDER BY payment_date DESC
      `).all(id);

      res.json(successResponse(payments, 'Payment history retrieved successfully'));
    } catch (error) {
      console.error('🔧 Error fetching payment history:', error);
      res.status(500).json(errorResponse('Failed to fetch payment history', 'FETCH_ERROR'));
    }
  };

  /**
   * Update invoice status
   */
  static updateInvoiceStatus = async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { status } = req.body;

      const validStatuses = ['pending', 'in_progress', 'partial', 'paid'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json(errorResponse('Invalid status', 'INVALID_STATUS'));
      }

      const db = this.getDb();
      
      // Check if user owns this invoice
      const invoice = db.prepare('SELECT creator_id FROM invoices WHERE id = ?').get(id);
      if (!invoice || invoice.creator_id !== userId) {
        return res.status(403).json(errorResponse('Not authorized to modify this invoice', 'UNAUTHORIZED'));
      }

      db.prepare(`
        UPDATE invoices SET status = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, id);

      console.log('🔧 Invoice status updated:', id, 'Status:', status);
      res.json(successResponse(null, 'Invoice status updated successfully'));
    } catch (error) {
      console.error('🔧 Error updating invoice status:', error);
      res.status(500).json(errorResponse('Failed to update invoice status', 'UPDATE_ERROR'));
    }
  };
}