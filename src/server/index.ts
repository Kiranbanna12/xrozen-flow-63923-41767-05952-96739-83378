/**
 * Express Server Entry Point
 */

import { loadEnvironmentConfig } from './utils/env.util';
import { createApp } from './app';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { WebSocketManager } from './websocket';
import { wsRegistry } from './websocket-registry';
import { logger } from './utils/logger.util';

// Load environment configuration first
loadEnvironmentConfig();

const PORT = process.env.PORT || 3001;

export let wsManager: WebSocketManager;

// Export function to get WebSocket manager
export function getWebSocketManager(): WebSocketManager | null {
  return wsManager || null;
}

async function startServer() {
  try {
    // Initialize database connection
    logger.info('Initializing database connection...');
    const connectionManager = ConnectionManager.getInstance();
    const db = connectionManager.getConnection();
    logger.info('Database connection established');

    // Run pending migrations automatically
    logger.info('Checking for pending database migrations...');
    const { MigrationManager } = await import('@/lib/database/core/migration.manager');
    const { migration_001_initial_schema } = await import('@/lib/database/migrations/001_initial_schema');
    const migration002 = await import('@/lib/database/migrations/002_update_messages_table.ts');
    const migration003 = await import('@/lib/database/migrations/003_add_approval_status.ts');
    
    const migrationManager = new MigrationManager(db);
    migrationManager.register(migration_001_initial_schema);
    migrationManager.register(migration002.default);
    migrationManager.register(migration003.default);
    await migrationManager.migrate();
    logger.info('Database migrations completed');

    // Create Express app
    const app = createApp();

    // Start server - Listen on all network interfaces for mobile access
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API endpoints available at:`);
      logger.info(`  - Local: http://localhost:${PORT}/api`);
      logger.info(`  - Network: http://192.168.1.8:${PORT}/api`);
      logger.info(`  - Network: http://172.27.160.1:${PORT}/api`);
      
      // Initialize WebSocket server
      wsManager = new WebSocketManager(server);
      wsRegistry.setManager(wsManager);
      logger.info('✅ WebSocket server initialized and registered');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        connectionManager.close();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        connectionManager.close();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server
startServer();
