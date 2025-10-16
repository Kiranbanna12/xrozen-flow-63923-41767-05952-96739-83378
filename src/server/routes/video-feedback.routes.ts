/**
 * Video Feedback Routes
 */

import { Router } from 'express';
import { VideoFeedbackController } from '../controllers/video-feedback.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new VideoFeedbackController();

// Add debug logging for all requests
router.use((req, res, next) => {
  console.log('🔧 VideoFeedback route hit:', req.method, req.path, 'Body:', req.body);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Get feedback for a video version
router.get('/versions/:versionId/feedback', controller.getFeedback);

// Create new feedback for a video version
router.post('/versions/:versionId/feedback', controller.createFeedback);

// Update feedback (resolve/unresolve)
router.put('/versions/:versionId/feedback/:feedbackId', controller.updateFeedback);

// Delete feedback
router.delete('/versions/:versionId/feedback/:feedbackId', controller.deleteFeedback);

export default router;