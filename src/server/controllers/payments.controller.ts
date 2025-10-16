/**
 * Payments Controller - Handle payment operations
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { getDatabaseConfig } from '@/config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

export class PaymentsController {
  private db: Database.Database;

  constructor() {
    try {
      console.log('Initializing PaymentsController...');
      const config = getDatabaseConfig();
      this.db = new Database(config.filename);
      console.log('Payments controller database connection established');
    } catch (error) {
      console.error('Error initializing PaymentsController:', error);
      throw error;
    }
  }

  /**
   * Get all payments
   */
  getPayments = async (req: Request, res: Response) => {
    try {
      console.log('Getting all payments...');
      
      // Get all payments with user information
      const payments = this.db.prepare(`
        SELECT 
          p.*,
          payer.email as payer_email,
          payer.full_name as payer_name,
          recipient.email as recipient_email,
          recipient.full_name as recipient_name
        FROM payments p
        LEFT JOIN profiles payer ON p.payer_id = payer.id
        LEFT JOIN profiles recipient ON p.recipient_id = recipient.id
        ORDER BY p.created_at DESC
      `).all();

      console.log(`Found ${payments.length} payments`);
      
      // Transform the data to match the expected format
      const formattedPayments = payments.map(payment => ({
        id: payment.id,
        amount: payment.amount || 0,
        currency: payment.currency || 'INR',
        status: payment.status || 'pending',
        payment_type: payment.payment_type || 'subscription',
        payment_method: payment.payment_method || 'unknown',
        transaction_id: payment.transaction_id || null,
        due_date: payment.due_date || null,
        paid_date: payment.paid_date || null,
        notes: payment.notes || null,
        payer_id: payment.payer_id,
        recipient_id: payment.recipient_id,
        payer_email: payment.payer_email,
        payer_name: payment.payer_name,
        recipient_email: payment.recipient_email,
        recipient_name: payment.recipient_name,
        created_at: payment.created_at,
        updated_at: payment.updated_at
      }));

      return res.json(successResponse(formattedPayments));
    } catch (error: any) {
      console.error('Get payments error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get single payment by ID
   */
  getPayment = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const payment = this.db.prepare(`
        SELECT 
          p.*,
          payer.email as payer_email,
          payer.full_name as payer_name,
          recipient.email as recipient_email,
          recipient.full_name as recipient_name
        FROM payments p
        LEFT JOIN profiles payer ON p.payer_id = payer.id
        LEFT JOIN profiles recipient ON p.recipient_id = recipient.id
        WHERE p.id = ?
      `).get(id);

      if (!payment) {
        return res.status(404).json(errorResponse('Payment not found'));
      }

      return res.json(successResponse(payment));
    } catch (error: any) {
      console.error('Get payment error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update payment
   */
  updatePayment = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, paid_date, notes } = req.body;

      console.log('Updating payment:', id, status);

      // Build update query dynamically
      const updates: any = {};
      if (status !== undefined) updates.status = status;
      if (paid_date !== undefined) updates.paid_date = paid_date;
      if (notes !== undefined) updates.notes = notes;

      const updateFields = Object.keys(updates);
      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      const values = updateFields.map(field => updates[field]);

      this.db.prepare(`
        UPDATE payments 
        SET ${setClause}, updated_at = datetime('now')
        WHERE id = ?
      `).run(...values, id);

      // Get updated payment
      const updatedPayment = this.db.prepare(`
        SELECT * FROM payments WHERE id = ?
      `).get(id);

      if (!updatedPayment) {
        return res.status(404).json(errorResponse('Payment not found'));
      }

      console.log('Payment updated successfully');
      return res.json(successResponse(updatedPayment));
    } catch (error: any) {
      console.error('Update payment error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Create a new payment (admin only)
   */
  createPayment = async (req: Request, res: Response) => {
    try {
      const { 
        payer_id, 
        recipient_id, 
        amount, 
        currency = 'INR', 
        payment_type = 'subscription',
        due_date,
        notes 
      } = req.body;

      console.log('Creating new payment:', { payer_id, recipient_id, amount });

      if (!payer_id || !recipient_id || !amount) {
        return res.status(400).json(errorResponse('Missing required fields: payer_id, recipient_id, amount'));
      }

      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      this.db.prepare(`
        INSERT INTO payments (
          id, payer_id, recipient_id, amount, currency, 
          payment_type, status, due_date, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        paymentId,
        payer_id,
        recipient_id,
        amount,
        currency,
        payment_type,
        'pending',
        due_date,
        notes
      );

      // Get the newly created payment
      const newPayment = this.db.prepare(`
        SELECT * FROM payments WHERE id = ?
      `).get(paymentId);

      console.log('Payment created successfully');
      return res.json(successResponse(newPayment));
    } catch (error: any) {
      console.error('Create payment error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}