/**
 * AI Admin Routes - Manage AI models and API keys
 */

import { Router } from 'express';
import { AIAdminController } from '../controllers/ai-admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { adminMiddleware } from '../middleware/admin.middleware';

const router = Router();
const controller = new AIAdminController();

// All routes require authentication and admin privileges
router.use(authMiddleware);
router.use(adminMiddleware);

// AI Models
router.get('/ai-models', controller.getModels);
router.post('/ai-models', controller.addModel);
router.post('/ai-models/add-openrouter-free', controller.addFreeOpenRouterModels);
router.post('/ai-models/add-openai', controller.addOpenAIModels);
router.post('/ai-models/add-gemini', controller.addGeminiModels);
router.put('/ai-models/:id', controller.updateModel);
router.delete('/ai-models/:id', controller.deleteModel);
router.put('/ai-models/bulk-priority', controller.bulkUpdatePriorities);

// API Keys
router.get('/ai-keys', controller.getAPIKeys);
router.post('/ai-keys', controller.addAPIKey);
router.put('/ai-keys/:id', controller.updateAPIKey);
router.delete('/ai-keys/:id', controller.deleteAPIKey);

// Usage Statistics
router.get('/ai-usage/stats', controller.getOverallUsageStats);
router.get('/ai-usage/by-model', controller.getUsageByModel);

export default router;
