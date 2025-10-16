/**
 * Projects Routes
 */

import { Router } from 'express';
import { ProjectsController } from '../controllers/projects.controller';
import { VideoFeedbackController } from '../controllers/video-feedback.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const controller = new ProjectsController();

console.log('🔧 Initializing VideoFeedbackController...');
const feedbackController = new VideoFeedbackController();
console.log('🔧 VideoFeedbackController initialized successfully');

// Add logging middleware to see if requests are hitting this route
router.use((req, res, next) => {
  console.log('🔧 Projects route hit:', req.method, req.path, 'Body:', req.body);
  next();
});

// All routes require authentication
router.use(authMiddleware);

// Get all projects (with optional filters)
router.get('/', controller.getProjects);

// Get feedback summary for a project (must be before /:id route)
router.get('/:projectId/feedback-summary', (req, res, next) => {
  console.log('🔧 Feedback summary route triggered for projectId:', req.params.projectId);
  feedbackController.getProjectFeedbackSummary(req, res).catch(next);
});

// Get single project
router.get('/:id', controller.getProject);

// Create new project
router.post('/', controller.createProject);

// Update project
router.put('/:id', controller.updateProject);

// Delete project
router.delete('/:id', controller.deleteProject);

export default router;
