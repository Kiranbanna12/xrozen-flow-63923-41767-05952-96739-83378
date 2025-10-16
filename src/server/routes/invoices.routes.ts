/**
 * Invoice Routes
 * Handles invoice-related API endpoints
 */

import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Invoice CRUD operations
router.get('/', InvoiceController.getAllInvoices);
router.get('/:id', InvoiceController.getInvoiceById);
router.post('/', InvoiceController.createInvoice);
router.put('/:id', InvoiceController.updateInvoice);
router.delete('/:id', InvoiceController.deleteInvoice);

// Invoice items
router.get('/:id/items', InvoiceController.getInvoiceItems);
router.post('/:id/items', InvoiceController.addInvoiceItem);
router.put('/:id/items/:itemId', InvoiceController.updateInvoiceItem);
router.delete('/:id/items/:itemId', InvoiceController.deleteInvoiceItem);

// Payment operations
router.post('/:id/payments', InvoiceController.addPayment);
router.get('/:id/payment-history', InvoiceController.getPaymentHistory);

// Invoice status updates
router.patch('/:id/status', InvoiceController.updateInvoiceStatus);

export default router;