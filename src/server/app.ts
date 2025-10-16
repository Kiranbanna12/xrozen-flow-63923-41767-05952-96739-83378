/**
 * Express Application Configuration
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { authMiddleware } from './middleware/auth.middleware';
import { adminMiddleware } from './middleware/admin.middleware';
import { errorMiddleware, notFoundMiddleware } from './middleware/error.middleware';
import { adminRateLimiter } from './middleware/rate-limit.middleware';

// Import routes
import databaseRoutes from './routes/database.routes';
import tableRoutes from './routes/table.routes';
import queryRoutes from './routes/query.routes';
import migrationRoutes from './routes/migration.routes';
import backupRoutes from './routes/backup.routes';
import performanceRoutes from './routes/performance.routes';
import userRoutes from './routes/user.routes';

// Import application routes
import authRoutes from './routes/auth.routes';
import profilesRoutes from './routes/profiles.routes';
import projectsRoutes from './routes/projects.routes';
import editorsRoutes from './routes/editors.routes';
import clientsRoutes from './routes/clients.routes';
import messagesRoutes from './routes/messages.routes';
import conversationsRoutes from './routes/conversations.routes';
import paymentsRoutes from './routes/payments.routes';
import videoVersionsRoutes from './routes/video-versions.routes';
import videoFeedbackRoutes from './routes/video-feedback.routes';
import notificationsRoutes from './routes/notifications.routes';
import aiRoutes from './routes/ai.routes';
import aiAdminRoutes from './routes/ai-admin.routes';
import adminSubscriptionsRoutes from './routes/admin-subscriptions.routes';
import projectSharingRoutes from './routes/project-sharing.routes';
import invoicesRoutes from './routes/invoices.routes';
import transactionsRoutes from './routes/transactions.routes';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Allow for development
  }));

  // CORS configuration - Allow mobile access from local network
  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:8080',
      'http://192.168.1.8:8080',
      'http://172.27.160.1:8080'
    ],
    credentials: true,
  }));

  // Compression
  app.use(compression());

  // Request logging
  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint (public)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Add debug middleware to log all requests
  app.use((req, res, next) => {
    console.log('🔧 Incoming request:', req.method, req.url, 'Body:', req.body);
    next();
  });

  // Mount application routes (authentication handled within each route)
  app.use('/api/auth', authRoutes);
  app.use('/api/profiles', profilesRoutes);

  // Mount project sharing routes BEFORE projects routes to avoid route conflicts
  app.use('/api', projectSharingRoutes);  // Project sharing routes (/projects/:id/shares, /project-shares, etc.)

  app.use('/api/projects', projectsRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/editors', editorsRoutes);
  app.use('/api/clients', clientsRoutes);
  app.use('/api/messages', messagesRoutes);
  app.use('/api/conversations', conversationsRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api', videoVersionsRoutes);  // Has nested routes like /projects/:id/versions
  app.use('/api', videoFeedbackRoutes);  // Has nested routes like /versions/:id/feedback
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/ai', aiRoutes);

  // Apply authentication and authorization to all /api/admin/* routes
  app.use('/api/admin', authMiddleware, adminMiddleware, adminRateLimiter);

  // Mount admin routes
  app.use('/api/admin/database', databaseRoutes);
  app.use('/api/admin/tables', tableRoutes);
  app.use('/api/admin/query', queryRoutes);
  app.use('/api/admin/migrations', migrationRoutes);
  app.use('/api/admin/backups', backupRoutes);
  app.use('/api/admin/performance', performanceRoutes);
  app.use('/api/admin/users', userRoutes);
  app.use('/api/admin/subscriptions', adminSubscriptionsRoutes);
  app.use('/api/admin', aiAdminRoutes);

  // 404 handler
  app.use(notFoundMiddleware);

  // Global error handler (must be last)
  app.use(errorMiddleware);

  return app;
}
