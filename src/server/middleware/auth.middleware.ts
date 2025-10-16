/**
 * Authentication Middleware - JWT Token Verification
 */

import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../../lib/database/services/jwt.service';
import { errorResponse } from '../utils/response.util';
import { logger } from '../utils/logger.util';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
    user_category?: string;
  };
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    console.log('Auth middleware - URL:', req.url, 'Method:', req.method);
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader ? 'Present' : 'Missing');

    if (!authHeader) {
      console.log('No auth header provided');
      res.status(401).json(errorResponse('No authorization token provided', 'NO_TOKEN'));
      return;
    }

    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json(errorResponse('Invalid authorization format', 'INVALID_FORMAT'));
      return;
    }

    const token = authHeader.substring(7);
    console.log('Token extracted, length:', token.length);

    if (!token) {
      console.log('Token is empty');
      res.status(401).json(errorResponse('Token is empty', 'EMPTY_TOKEN'));
      return;
    }

    console.log('Verifying token...');
    const jwtService = new JWTService();
    const payload = jwtService.verifyToken(token);
    console.log('Token verification result:', payload ? 'Success' : 'Failed');

    if (!payload) {
      console.log('Token verification failed');
      res.status(401).json(errorResponse('Invalid or expired token', 'INVALID_TOKEN'));
      return;
    }

    console.log('Setting user in request:', payload);
    req.user = payload;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json(errorResponse('Authentication failed', 'AUTH_ERROR'));
  }
};
