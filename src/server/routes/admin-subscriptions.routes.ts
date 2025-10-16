/**
 * Admin Subscriptions Routes
 */

import { Router } from 'express';
import { ProfileController } from '../controllers/profiles.controller';

console.log('Loading admin subscriptions routes...');

const router = Router();
const controller = new ProfileController();

console.log('Profile controller created for admin subscriptions');

// Get all subscriptions (admin only)
router.get('/', (req, res) => {
  console.log('GET /api/admin/subscriptions called');
  controller.getAllSubscriptions(req, res);
});

// Update subscription status (admin only)
router.put('/:userId', (req, res) => {
  console.log('PUT /api/admin/subscriptions/:userId called');
  controller.updateSubscriptionStatus(req, res);
});

console.log('Admin subscriptions routes configured');

export default router;
