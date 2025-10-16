/**
 * Admin Authorization Middleware
 * Checks if user has admin privileges
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { errorResponse } from '../utils/response.util';

export const adminMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json(errorResponse('User not authenticated', 'NOT_AUTHENTICATED'));
    return;
  }

  // Check both role and user_category for compatibility
  const userRole = req.user.role?.toLowerCase();
  const userCategory = req.user.user_category?.toLowerCase();

  const isAdmin = userRole === 'admin' || 
                 userRole === 'agency' || 
                 userCategory === 'admin' || 
                 userCategory === 'agency';

  if (!isAdmin) {
    res.status(403).json(
      errorResponse('Access denied. Admin privileges required.', 'FORBIDDEN')
    );
    return;
  }

  next();
};
