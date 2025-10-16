/**
 * Performance Controller - Handle database performance monitoring
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { getDatabaseConfig } from '@/config/database.config';
import { successResponse, errorResponse } from '../utils/response.util';

export class PerformanceController {
  private db: Database.Database;

  constructor() {
    try {
      console.log('Initializing PerformanceController...');
      const config = getDatabaseConfig();
      this.db = new Database(config.filename);
      console.log('Performance controller database connection established');
    } catch (error) {
      console.error('Error initializing PerformanceController:', error);
      throw error;
    }
  }

  /**
   * Get database performance metrics
   */
  getMetrics = async (req: Request, res: Response) => {
    try {
      console.log('Getting database performance metrics...');
      
      // Get basic database stats
      const dbStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_tables,
          (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%') as user_tables
        FROM sqlite_master WHERE type='table'
      `).get();

      // Get query history stats
      const queryStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_queries,
          AVG(execution_time) as avg_execution_time,
          MAX(execution_time) as max_execution_time,
          MIN(execution_time) as min_execution_time
        FROM query_history
        WHERE created_at >= datetime('now', '-1 hour')
      `).get();

      // Get AI request logs stats
      const aiStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_requests,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests,
          AVG(request_tokens) as avg_request_tokens,
          AVG(response_tokens) as avg_response_tokens
        FROM ai_request_logs
        WHERE created_at >= datetime('now', '-1 hour')
      `).get();

      // Get recent slow queries
      const slowQueries = this.db.prepare(`
        SELECT 
          id,
          user_id,
          query,
          execution_time,
          created_at
        FROM query_history
        WHERE execution_time > 1000
        ORDER BY execution_time DESC
        LIMIT 10
      `).all();

      // Get error distribution from AI logs
      const errorDistribution = this.db.prepare(`
        SELECT 
          error_message,
          COUNT(*) as count
        FROM ai_request_logs
        WHERE success = 0 AND created_at >= datetime('now', '-24 hours')
        GROUP BY error_message
        ORDER BY count DESC
      `).all();

      // Get recent operations
      const recentOperations = this.db.prepare(`
        SELECT 
          'query' as operation_type,
          id,
          user_id,
          query as details,
          execution_time as duration,
          created_at as timestamp,
          1 as success
        FROM query_history
        WHERE created_at >= datetime('now', '-1 hour')
        
        UNION ALL
        
        SELECT 
          'ai_request' as operation_type,
          id,
          user_id,
          model_id as details,
          NULL as duration,
          created_at as timestamp,
          success
        FROM ai_request_logs
        WHERE created_at >= datetime('now', '-1 hour')
        
        ORDER BY timestamp DESC
        LIMIT 50
      `).all();

      // Calculate system health
      const errorRate = aiStats.total_requests > 0 ? 
        (aiStats.failed_requests / aiStats.total_requests) * 100 : 0;
      
      const avgQueryTime = queryStats.avg_execution_time || 0;
      
      const systemHealth = {
        status: errorRate > 10 ? 'critical' : errorRate > 5 ? 'degraded' : 'healthy',
        uptime: Date.now() - (24 * 60 * 60 * 1000), // Mock uptime for now
        avgQueryTime: avgQueryTime,
        errorRate: errorRate
      };

      const performanceData = {
        systemHealth,
        databaseStats: {
          totalTables: dbStats.total_tables,
          userTables: dbStats.user_tables,
          totalQueries: queryStats.total_queries || 0,
          avgExecutionTime: avgQueryTime,
          maxExecutionTime: queryStats.max_execution_time || 0,
          minExecutionTime: queryStats.min_execution_time || 0
        },
        aiStats: {
          totalRequests: aiStats.total_requests || 0,
          successfulRequests: aiStats.successful_requests || 0,
          failedRequests: aiStats.failed_requests || 0,
          avgRequestTokens: aiStats.avg_request_tokens || 0,
          avgResponseTokens: aiStats.avg_response_tokens || 0
        },
        slowQueries: slowQueries,
        errorDistribution: errorDistribution,
        recentOperations: recentOperations,
        statistics: {
          totalOperations: (queryStats.total_queries || 0) + (aiStats.total_requests || 0),
          successRate: aiStats.total_requests > 0 ? 
            ((aiStats.successful_requests / aiStats.total_requests) * 100) : 100,
          slowQueries: slowQueries,
          errorsByType: errorDistribution.reduce((acc, error) => {
            acc[error.error_message] = error.count;
            return acc;
          }, {} as Record<string, number>)
        }
      };

      console.log(`Performance metrics retrieved: ${performanceData.statistics.totalOperations} operations`);
      return res.json(successResponse(performanceData));
    } catch (error: any) {
      console.error('Get performance metrics error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get database health status
   */
  getDatabaseHealth = async (req: Request, res: Response) => {
    try {
      console.log('Getting database health status...');
      
      // Test database connection
      const testQuery = this.db.prepare('SELECT 1 as test').get();
      
      if (!testQuery) {
        return res.status(500).json(errorResponse('Database connection failed'));
      }

      // Get basic health metrics
      const healthData = {
        status: 'healthy',
        uptime: Date.now() - (24 * 60 * 60 * 1000), // Mock uptime
        avgQueryTime: 0,
        errorRate: 0,
        provider: 'SQLite',
        version: '3.x',
        lastCheck: new Date().toISOString()
      };

      return res.json(successResponse(healthData));
    } catch (error: any) {
      console.error('Get database health error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get slow queries
   */
  getSlowQueries = async (req: Request, res: Response) => {
    try {
      const slowQueries = this.db.prepare(`
        SELECT 
          id,
          user_id,
          query,
          execution_time,
          created_at
        FROM query_history
        WHERE execution_time > 1000
        ORDER BY execution_time DESC
        LIMIT 50
      `).all();

      return res.json(successResponse(slowQueries));
    } catch (error: any) {
      console.error('Get slow queries error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get performance suggestions
   */
  getSuggestions = async (req: Request, res: Response) => {
    try {
      const suggestions = [
        {
          type: 'index',
          table: 'users',
          column: 'email',
          impact: 'high',
          description: 'Add index on email column for faster lookups'
        },
        {
          type: 'query_optimization',
          query: 'SELECT * FROM profiles WHERE subscription_active = 1',
          impact: 'medium',
          description: 'Consider adding WHERE clause optimization'
        }
      ];

      return res.json(successResponse(suggestions));
    } catch (error: any) {
      console.error('Get suggestions error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Clear query history
   */
  clearHistory = async (req: Request, res: Response) => {
    try {
      this.db.prepare('DELETE FROM query_history').run();
      return res.json(successResponse({ message: 'Query history cleared' }));
    } catch (error: any) {
      console.error('Clear history error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}