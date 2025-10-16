/**
 * Transaction Controller
 * Handles transaction-related business logic
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

export class TransactionController {
    private static db: Database.Database;

    private static getDb(): Database.Database {
        if (!TransactionController.db) {
            const config = getDatabaseConfig();
            TransactionController.db = new Database(config.filename);
        }
        return TransactionController.db;
    }

    /**
     * Get all transactions for current user
     */
    static getAllTransactions(req: AuthRequest, res: Response): void {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(errorResponse('Unauthorized'));
                return;
            }

            const db = TransactionController.getDb();
            const transactions = db.prepare(`
        SELECT * FROM transactions 
        WHERE editor_id = ? OR client_id = ?
        ORDER BY transaction_date DESC
      `).all(userId, userId);

            res.json(successResponse(transactions));
        } catch (error: any) {
            console.error('Error fetching transactions:', error);
            res.status(500).json(errorResponse(error.message || 'Failed to fetch transactions'));
        }
    }

    /**
     * Create a new transaction
     */
    static createTransaction(req: AuthRequest, res: Response): void {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(errorResponse('Unauthorized'));
                return;
            }

            const {
                amount,
                description,
                transaction_date,
                transaction_type,
                payment_method,
                invoice_id,
                editor_id,
                client_id,
                notes
            } = req.body;

            if (!amount || !description || !transaction_date || !transaction_type) {
                res.status(400).json(errorResponse('Missing required fields'));
                return;
            }

            const db = TransactionController.getDb();
            const transactionId = randomUUID();

            db.prepare(`
        INSERT INTO transactions (
          id, editor_id, client_id, invoice_id, amount, description, 
          transaction_date, transaction_type, payment_method, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
                transactionId,
                editor_id || null,
                client_id || null,
                invoice_id || null,
                amount,
                description,
                transaction_date,
                transaction_type,
                payment_method || null,
                notes || null
            );

            const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);

            res.status(201).json(successResponse(transaction));
        } catch (error: any) {
            console.error('Error creating transaction:', error);
            res.status(500).json(errorResponse(error.message || 'Failed to create transaction'));
        }
    }

    /**
     * Update a transaction
     */
    static updateTransaction(req: AuthRequest, res: Response): void {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(errorResponse('Unauthorized'));
                return;
            }

            const { id } = req.params;
            const {
                amount,
                description,
                transaction_date,
                transaction_type,
                payment_method,
                invoice_id,
                editor_id,
                client_id,
                notes
            } = req.body;

            const db = TransactionController.getDb();

            // Check if transaction exists
            const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
            if (!existing) {
                res.status(404).json(errorResponse('Transaction not found'));
                return;
            }

            // Update transaction
            db.prepare(`
        UPDATE transactions 
        SET amount = ?, description = ?, transaction_date = ?, 
            transaction_type = ?, payment_method = ?, invoice_id = ?,
            editor_id = ?, client_id = ?, notes = ?
        WHERE id = ?
      `).run(
                amount,
                description,
                transaction_date,
                transaction_type,
                payment_method || null,
                invoice_id || null,
                editor_id || null,
                client_id || null,
                notes || null,
                id
            );

            const updated = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

            res.json(successResponse(updated));
        } catch (error: any) {
            console.error('Error updating transaction:', error);
            res.status(500).json(errorResponse(error.message || 'Failed to update transaction'));
        }
    }

    /**
     * Delete a transaction
     */
    static deleteTransaction(req: AuthRequest, res: Response): void {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                res.status(401).json(errorResponse('Unauthorized'));
                return;
            }

            const { id } = req.params;

            const db = TransactionController.getDb();

            // Check if transaction exists
            const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
            if (!existing) {
                res.status(404).json(errorResponse('Transaction not found'));
                return;
            }

            // Delete transaction
            db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

            res.json(successResponse({ message: 'Transaction deleted successfully' }));
        } catch (error: any) {
            console.error('Error deleting transaction:', error);
            res.status(500).json(errorResponse(error.message || 'Failed to delete transaction'));
        }
    }
}
