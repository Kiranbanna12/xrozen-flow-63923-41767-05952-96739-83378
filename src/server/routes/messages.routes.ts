/**
 * Messages Routes
 */

import { Router } from 'express';
import { MessagesController } from '../controllers/messages.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new MessagesController();

// All routes require authentication
router.use(authMiddleware);

// Get messages (optionally filtered by project)
router.get('/', controller.getMessages);

// Create new message
router.post('/', controller.createMessage);

// Mark message as read
router.put('/:id/read', controller.markAsRead);

// Get message delivery and read info
router.get('/:id/info', controller.getMessageInfo);

// Pin/Unpin message
router.put('/:id/pin', controller.togglePin);

// Star/Unstar message
router.put('/:id/star', controller.toggleStar);

// Delete message
router.delete('/:id', controller.deleteMessage);

// Report message
router.post('/:id/report', controller.reportMessage);

// React to message
router.post('/:id/react', controller.reactToMessage);

// Edit message
router.put('/:id', controller.editMessage);

// Get unread message counts per project
router.get('/unread/counts', controller.getUnreadCounts);

// Update last read timestamp for a project
router.put('/projects/:projectId/mark-read', controller.markProjectAsRead);

export default router;
