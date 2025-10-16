/**
 * Conversations Routes
 */

import { Router } from 'express';
import { ConversationsController } from '../controllers/conversations.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const conversationsController = new ConversationsController();

// All routes require authentication
router.use(authMiddleware);

// Conversation routes
router.get('/', conversationsController.getConversations);
router.post('/', conversationsController.createConversation);
router.get('/:id', conversationsController.getConversation);
router.post('/:id/participants', conversationsController.addParticipants);
router.post('/:id/typing', conversationsController.setTypingStatus);
router.get('/:id/typing', conversationsController.getTypingIndicators);

export default router;
