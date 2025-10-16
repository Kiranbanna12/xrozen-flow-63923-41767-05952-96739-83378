/**
 * AI Admin Controller - Manage AI models and API keys
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { successResponse, errorResponse } from '../utils/response.util';
import { randomUUID } from 'crypto';

// OpenAI Models (Paid)
const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o (Latest)", limit: null, priority: 100 },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", limit: null, priority: 90 },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", limit: null, priority: 95 },
  { id: "gpt-4", name: "GPT-4", limit: null, priority: 92 },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", limit: null, priority: 85 },
  { id: "gpt-3.5-turbo-16k", name: "GPT-3.5 Turbo 16K", limit: null, priority: 83 }
];

// Google Gemini Models (Paid)
const GEMINI_MODELS = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", limit: null, priority: 98 },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", limit: null, priority: 95 },
  { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", limit: null, priority: 92 },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", limit: null, priority: 90 },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", limit: null, priority: 88 },
  { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Experimental", limit: null, priority: 86 },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", limit: null, priority: 93 },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", limit: null, priority: 87 },
  { id: "gemini-pro", name: "Gemini Pro", limit: null, priority: 85 }
];

// Free OpenRouter Models
const FREE_OPENROUTER_MODELS = [
  { id: "alibaba/tongyi-deepresearch-30b-a3b:free", name: "Alibaba Tongyi DeepResearch 30B", limit: 20 },
  { id: "meituan/longcat-flash-chat:free", name: "Meituan LongCat Flash Chat", limit: 20 },
  { id: "nvidia/nemotron-nano-9b-v2:free", name: "NVIDIA Nemotron Nano 9B v2", limit: 20 },
  { id: "deepseek/deepseek-chat-v3.1:free", name: "DeepSeek Chat v3.1", limit: 20 },
  { id: "openai/gpt-oss-20b:free", name: "OpenAI GPT OSS 20B", limit: 20 },
  { id: "z-ai/glm-4.5-air:free", name: "Z-AI GLM 4.5 Air", limit: 20 },
  { id: "qwen/qwen3-coder:free", name: "Qwen3 Coder", limit: 20 },
  { id: "moonshotai/kimi-k2:free", name: "MoonshotAI Kimi K2", limit: 20 },
  { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", name: "Dolphin Mistral 24B Venice", limit: 20 },
  { id: "google/gemma-3n-e2b-it:free", name: "Google Gemma 3N E2B IT", limit: 20 },
  { id: "tencent/hunyuan-a13b-instruct:free", name: "Tencent Hunyuan A13B Instruct", limit: 20 },
  { id: "tngtech/deepseek-r1t2-chimera:free", name: "TNG DeepSeek R1T2 Chimera", limit: 20 },
  { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2 24B Instruct", limit: 20 },
  { id: "moonshotai/kimi-dev-72b:free", name: "MoonshotAI Kimi Dev 72B", limit: 20 },
  { id: "deepseek/deepseek-r1-0528-qwen3-8b:free", name: "DeepSeek R1 0528 Qwen3 8B", limit: 20 },
  { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1 0528", limit: 20 },
  { id: "mistralai/devstral-small-2505:free", name: "Mistral Devstral Small 2505", limit: 20 },
  { id: "google/gemma-3n-e4b-it:free", name: "Google Gemma 3N E4B IT", limit: 20 },
  { id: "meta-llama/llama-3.3-8b-instruct:free", name: "Meta Llama 3.3 8B Instruct", limit: 20 },
  { id: "qwen/qwen3-4b:free", name: "Qwen3 4B", limit: 20 },
  { id: "qwen/qwen3-30b-a3b:free", name: "Qwen3 30B A3B", limit: 20 },
  { id: "qwen/qwen3-8b:free", name: "Qwen3 8B", limit: 20 },
  { id: "qwen/qwen3-14b:free", name: "Qwen3 14B", limit: 20 },
  { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B", limit: 20 },
  { id: "tngtech/deepseek-r1t-chimera:free", name: "TNG DeepSeek R1T Chimera", limit: 20 },
  { id: "microsoft/mai-ds-r1:free", name: "Microsoft MAI DS R1", limit: 20 },
  { id: "shisa-ai/shisa-v2-llama3.3-70b:free", name: "Shisa AI v2 Llama 3.3 70B", limit: 20 },
  { id: "arliai/qwq-32b-arliai-rpr-v1:free", name: "ArliAI QWQ 32B RPR v1", limit: 20 },
  { id: "agentica-org/deepcoder-14b-preview:free", name: "Agentica DeepCoder 14B Preview", limit: 20 },
  { id: "meta-llama/llama-4-maverick:free", name: "Meta Llama 4 Maverick", limit: 20 },
  { id: "meta-llama/llama-4-scout:free", name: "Meta Llama 4 Scout", limit: 20 },
  { id: "qwen/qwen2.5-vl-32b-instruct:free", name: "Qwen 2.5 VL 32B Instruct", limit: 20 },
  { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek Chat v3 0324", limit: 20 },
  { id: "mistralai/mistral-small-3.1-24b-instruct:free", name: "Mistral Small 3.1 24B Instruct", limit: 20 },
  { id: "google/gemma-3-4b-it:free", name: "Google Gemma 3 4B IT", limit: 20 },
  { id: "google/gemma-3-12b-it:free", name: "Google Gemma 3 12B IT", limit: 20 },
  { id: "google/gemma-3-27b-it:free", name: "Google Gemma 3 27B IT", limit: 20 },
  { id: "google/gemini-2.0-flash-exp:free", name: "Google Gemini 2.0 Flash Experimental", limit: 20 },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", limit: 20 }
];

export class AIAdminController {
  private db: Database.Database;

  constructor() {
    const connectionManager = ConnectionManager.getInstance();
    this.db = connectionManager.getConnection();
    this.initTables();
  }

  private initTables() {
    // Create ai_models table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        model_id TEXT NOT NULL UNIQUE,
        is_free INTEGER DEFAULT 0,
        rate_limit_per_minute INTEGER,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 50,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create ai_api_keys table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_api_keys (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        key_name TEXT NOT NULL,
        api_key TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Create ai_request_logs table for monitoring
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_request_logs (
        id TEXT PRIMARY KEY,
        model_id TEXT,
        user_id TEXT,
        request_tokens INTEGER DEFAULT 0,
        response_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        response_time_ms INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Add missing columns if table already exists (migration)
    try {
      this.db.exec(`ALTER TABLE ai_request_logs ADD COLUMN total_tokens INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }
    try {
      this.db.exec(`ALTER TABLE ai_request_logs ADD COLUMN response_time_ms INTEGER DEFAULT 0`);
    } catch (e) {
      // Column already exists
    }
  }

  /**
   * Get all AI models
   */
  getModels = async (req: Request, res: Response) => {
    try {
      const models = this.db.prepare(`
        SELECT * FROM ai_models ORDER BY priority DESC, created_at DESC
      `).all();

      return res.json(successResponse(models));
    } catch (error: any) {
      console.error('Get AI models error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add a single AI model
   */
  addModel = async (req: Request, res: Response) => {
    try {
      const { provider, model_name, model_id, is_free, priority, enabled } = req.body;

      if (!provider || !model_name || !model_id) {
        return res.status(400).json(errorResponse('Missing required fields'));
      }

      const id = randomUUID();
      this.db.prepare(`
        INSERT INTO ai_models (
          id, provider, model_name, model_id, is_free, enabled, priority
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, provider, model_name, model_id, is_free ? 1 : 0, enabled ? 1 : 0, priority || 50);

      return res.json(successResponse({ 
        id,
        message: 'Model added successfully'
      }));
    } catch (error: any) {
      console.error('Add model error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete an AI model
   */
  deleteModel = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = this.db.prepare('DELETE FROM ai_models WHERE id = ?').run(id);

      if (result.changes === 0) {
        return res.status(404).json(errorResponse('Model not found'));
      }

      return res.json(successResponse({ message: 'Model deleted successfully' }));
    } catch (error: any) {
      console.error('Delete model error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add all free OpenRouter models
   */
  addFreeOpenRouterModels = async (req: Request, res: Response) => {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ai_models (
          id, provider, model_name, model_id, is_free, rate_limit_per_minute, enabled, priority
        ) VALUES (?, ?, ?, ?, 1, ?, 1, ?)
      `);

      const insertMany = this.db.transaction((models: any[]) => {
        for (const model of models) {
          const id = randomUUID();
          stmt.run(id, 'openrouter', model.name, model.id, model.limit, 40); // Lower priority for free models
        }
      });

      insertMany(FREE_OPENROUTER_MODELS);

      return res.json(successResponse({ added: FREE_OPENROUTER_MODELS.length }));
    } catch (error: any) {
      console.error('Add free models error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add OpenAI models
   */
  addOpenAIModels = async (req: Request, res: Response) => {
    try {
      // Check if OpenAI API key exists
      const apiKey = this.db.prepare(`
        SELECT * FROM ai_api_keys WHERE provider = 'openai' AND is_active = 1
      `).get();

      if (!apiKey) {
        return res.status(400).json(errorResponse('Please add OpenAI API key first'));
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ai_models (
          id, provider, model_name, model_id, is_free, rate_limit_per_minute, enabled, priority
        ) VALUES (?, ?, ?, ?, 0, ?, 1, ?)
      `);

      const insertMany = this.db.transaction((models: any[]) => {
        for (const model of models) {
          const id = randomUUID();
          stmt.run(id, 'openai', model.name, model.id, model.limit, model.priority);
        }
      });

      insertMany(OPENAI_MODELS);

      return res.json(successResponse({ 
        added: OPENAI_MODELS.length,
        message: 'OpenAI models added successfully'
      }));
    } catch (error: any) {
      console.error('Add OpenAI models error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add Google Gemini models
   */
  addGeminiModels = async (req: Request, res: Response) => {
    try {
      // Check if Google/Gemini API key exists
      const apiKey = this.db.prepare(`
        SELECT * FROM ai_api_keys WHERE provider IN ('google', 'gemini') AND is_active = 1
      `).get();

      if (!apiKey) {
        return res.status(400).json(errorResponse('Please add Google/Gemini API key first'));
      }

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ai_models (
          id, provider, model_name, model_id, is_free, rate_limit_per_minute, enabled, priority
        ) VALUES (?, ?, ?, ?, 0, ?, 1, ?)
      `);

      const insertMany = this.db.transaction((models: any[]) => {
        for (const model of models) {
          const id = randomUUID();
          stmt.run(id, 'gemini', model.name, model.id, model.limit, model.priority);
        }
      });

      insertMany(GEMINI_MODELS);

      return res.json(successResponse({ 
        added: GEMINI_MODELS.length,
        message: 'Gemini models added successfully'
      }));
    } catch (error: any) {
      console.error('Add Gemini models error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update AI model
   */
  updateModel = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log('Update request for model ID:', id);
      console.log('Update data:', updates);

      const allowedFields = ['enabled', 'priority', 'rate_limit_per_minute'];
      const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));

      if (updateFields.length === 0) {
        return res.status(400).json(errorResponse('No valid fields to update'));
      }

      const setClause = updateFields.map(field => `${field} = ?`).join(', ');
      
      // Convert boolean values to integers for SQLite
      const values = updateFields.map(field => {
        const value = updates[field];
        if (field === 'enabled' && typeof value === 'boolean') {
          return value ? 1 : 0;
        }
        return value;
      });

      console.log('Set clause:', setClause);
      console.log('Values (converted):', values);

      const query = `UPDATE ai_models SET ${setClause}, updated_at = datetime('now') WHERE id = ?`;
      console.log('Final query:', query);

      const stmt = this.db.prepare(query);
      const result = stmt.run(...values, id);

      console.log('Update result:', result);

      if (result.changes === 0) {
        return res.status(404).json(errorResponse('Model not found or no changes made'));
      }

      const updatedModel = this.db.prepare('SELECT * FROM ai_models WHERE id = ?').get(id);

      console.log('Updated model:', updatedModel);

      return res.json(successResponse(updatedModel));
    } catch (error: any) {
      console.error('Update AI model error:', error);
      console.error('Error stack:', error.stack);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get all API keys (without exposing actual keys)
   */
  getAPIKeys = async (req: Request, res: Response) => {
    try {
      const keys = this.db.prepare(`
        SELECT id, provider, key_name, is_active, created_at
        FROM ai_api_keys ORDER BY created_at DESC
      `).all();

      return res.json(successResponse(keys));
    } catch (error: any) {
      console.error('Get API keys error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Add API key
   */
  addAPIKey = async (req: Request, res: Response) => {
    try {
      const { provider, key_name, api_key } = req.body;

      if (!provider || !key_name || !api_key) {
        return res.status(400).json(errorResponse('Missing required fields'));
      }

      const id = randomUUID();

      this.db.prepare(`
        INSERT INTO ai_api_keys (id, provider, key_name, api_key, is_active)
        VALUES (?, ?, ?, ?, 1)
      `).run(id, provider, key_name, api_key);

      return res.json(successResponse({ id, message: 'API key added successfully' }));
    } catch (error: any) {
      console.error('Add API key error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Delete API key
   */
  deleteAPIKey = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      this.db.prepare('DELETE FROM ai_api_keys WHERE id = ?').run(id);

      return res.json(successResponse({ message: 'API key deleted' }));
    } catch (error: any) {
      console.error('Delete API key error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get API key for a provider (internal use)
   */
  getActiveAPIKey = (provider: string): string | null => {
    const key = this.db.prepare(`
      SELECT api_key FROM ai_api_keys 
      WHERE provider = ? AND is_active = 1 
      ORDER BY created_at DESC LIMIT 1
    `).get(provider) as any;

    return key?.api_key || null;
  };

  /**
   * Get next available model (with fallback logic)
   */
  getNextAvailableModel = (): any => {
    const model = this.db.prepare(`
      SELECT * FROM ai_models 
      WHERE enabled = 1 
      ORDER BY priority DESC, RANDOM()
      LIMIT 1
    `).get();

    return model;
  };

  /**
   * Bulk update priorities
   */
  bulkUpdatePriorities = async (req: Request, res: Response) => {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json(errorResponse('Invalid updates array'));
      }

      const updateStmt = this.db.prepare(`
        UPDATE ai_models 
        SET priority = ?, updated_at = datetime('now') 
        WHERE id = ?
      `);

      const transaction = this.db.transaction((updates: any[]) => {
        for (const update of updates) {
          updateStmt.run(update.priority, update.id);
        }
      });

      transaction(updates);

      return res.json(successResponse({ 
        message: 'Priorities updated successfully',
        updated: updates.length 
      }));
    } catch (error: any) {
      console.error('Bulk update priorities error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get all models with priority order
   */
  getModelsOrderedByPriority = (): any[] => {
    return this.db.prepare(`
      SELECT * FROM ai_models 
      WHERE enabled = 1 
      ORDER BY priority DESC, created_at DESC
    `).all() as any[];
  };

  /**
   * Log AI request with detailed metrics
   */
  logRequest = (
    modelId: string, 
    userId: string, 
    success: boolean, 
    requestTokens: number = 0,
    responseTokens: number = 0,
    responseTimeMs: number = 0,
    errorMessage?: string
  ) => {
    try {
      const id = randomUUID();
      const totalTokens = requestTokens + responseTokens;
      
      this.db.prepare(`
        INSERT INTO ai_request_logs (
          id, model_id, user_id, request_tokens, response_tokens, 
          total_tokens, response_time_ms, success, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, modelId, userId, requestTokens, responseTokens, 
        totalTokens, responseTimeMs, success ? 1 : 0, errorMessage || null
      );
    } catch (error) {
      console.error('Log AI request error:', error);
    }
  };

  /**
   * Get overall usage statistics (summary for cards)
   */
  getOverallUsageStats = async (req: Request, res: Response) => {
    try {
      const overallStats = this.db.prepare(`
        SELECT 
          COUNT(id) as total_requests,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests,
          COALESCE(SUM(total_tokens), 0) as total_tokens,
          COALESCE(SUM(request_tokens), 0) as input_tokens,
          COALESCE(SUM(response_tokens), 0) as output_tokens,
          COALESCE(AVG(response_time_ms), 0) as avg_response_time
        FROM ai_request_logs
      `).get() as any;

      // Calculate success rate
      const successRate = overallStats.total_requests > 0 
        ? (overallStats.successful_requests / overallStats.total_requests) * 100 
        : 0;

      // Get model-wise token usage for cost calculation
      const modelUsage = this.db.prepare(`
        SELECT 
          m.model_id as model_identifier,
          m.is_free,
          COALESCE(SUM(l.request_tokens), 0) as input_tokens,
          COALESCE(SUM(l.response_tokens), 0) as output_tokens
        FROM ai_models m
        LEFT JOIN ai_request_logs l ON m.id = l.model_id
        WHERE l.id IS NOT NULL
        GROUP BY m.id
      `).all() as any[];

      // Pricing table (per 1M tokens in USD)
      const pricing: Record<string, { input: number; output: number }> = {
        // OpenAI pricing
        'gpt-4o': { input: 2.5, output: 10 },
        'gpt-4o-mini': { input: 0.15, output: 0.6 },
        'gpt-4-turbo': { input: 10, output: 30 },
        'gpt-4': { input: 30, output: 60 },
        'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
        'gpt-3.5-turbo-16k': { input: 3, output: 4 },
        
        // Gemini pricing
        'gemini-2.5-pro': { input: 1.25, output: 5 },
        'gemini-2.5-flash': { input: 0.075, output: 0.3 },
        'gemini-2.5-flash-lite': { input: 0.0375, output: 0.15 },
        'gemini-2.0-flash': { input: 0.1, output: 0.4 },
        'gemini-2.0-flash-lite': { input: 0.05, output: 0.2 },
        'gemini-2.0-flash-exp': { input: 0, output: 0 },
        'gemini-1.5-pro': { input: 1.25, output: 5 },
        'gemini-1.5-flash': { input: 0.075, output: 0.3 },
        'gemini-pro': { input: 0.5, output: 1.5 }
      };

      // Calculate total estimated cost
      let estimatedCost = 0;
      for (const usage of modelUsage) {
        if (!usage.is_free && pricing[usage.model_identifier]) {
          const modelPricing = pricing[usage.model_identifier];
          const inputCost = (usage.input_tokens / 1000000) * modelPricing.input;
          const outputCost = (usage.output_tokens / 1000000) * modelPricing.output;
          estimatedCost += inputCost + outputCost;
        }
      }

      const result = {
        total_requests: overallStats.total_requests || 0,
        successful_requests: overallStats.successful_requests || 0,
        failed_requests: overallStats.failed_requests || 0,
        total_tokens: overallStats.total_tokens || 0,
        input_tokens: overallStats.input_tokens || 0,
        output_tokens: overallStats.output_tokens || 0,
        estimated_cost: parseFloat(estimatedCost.toFixed(4)),
        success_rate: parseFloat(successRate.toFixed(2)),
        avg_response_time: Math.round(overallStats.avg_response_time || 0)
      };

      return res.json(successResponse(result));
    } catch (error: any) {
      console.error('Get overall usage stats error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Get usage statistics by model (for detailed table)
   */
  getUsageByModel = async (req: Request, res: Response) => {
    try {
      const modelStats = this.db.prepare(`
        SELECT 
          m.id as model_id,
          m.model_name,
          m.model_id as model_identifier,
          m.provider,
          m.is_free,
          COUNT(l.id) as request_count,
          SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN l.success = 0 THEN 1 ELSE 0 END) as fail_count,
          COALESCE(SUM(l.total_tokens), 0) as total_tokens,
          COALESCE(SUM(l.request_tokens), 0) as input_tokens,
          COALESCE(SUM(l.response_tokens), 0) as output_tokens,
          COALESCE(AVG(l.response_time_ms), 0) as avg_response_time,
          MAX(l.created_at) as last_used_at
        FROM ai_models m
        LEFT JOIN ai_request_logs l ON m.id = l.model_id
        WHERE l.id IS NOT NULL
        GROUP BY m.id
        ORDER BY request_count DESC, last_used_at DESC
      `).all() as any[];

      // Pricing table
      const pricing: Record<string, { input: number; output: number }> = {
        // OpenAI pricing per 1M tokens
        'gpt-4o': { input: 2.5, output: 10 },
        'gpt-4o-mini': { input: 0.15, output: 0.6 },
        'gpt-4-turbo': { input: 10, output: 30 },
        'gpt-4': { input: 30, output: 60 },
        'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
        'gpt-3.5-turbo-16k': { input: 3, output: 4 },
        
        // Gemini pricing per 1M tokens
        'gemini-2.5-pro': { input: 1.25, output: 5 },
        'gemini-2.5-flash': { input: 0.075, output: 0.3 },
        'gemini-2.5-flash-lite': { input: 0.0375, output: 0.15 },
        'gemini-2.0-flash': { input: 0.1, output: 0.4 },
        'gemini-2.0-flash-lite': { input: 0.05, output: 0.2 },
        'gemini-2.0-flash-exp': { input: 0, output: 0 },
        'gemini-1.5-pro': { input: 1.25, output: 5 },
        'gemini-1.5-flash': { input: 0.075, output: 0.3 },
        'gemini-pro': { input: 0.5, output: 1.5 }
      };

      // Calculate per-model cost and success rate
      const statsWithMetrics = modelStats.map(stat => {
        let estimatedCost = 0;
        
        if (!stat.is_free && pricing[stat.model_identifier]) {
          const modelPricing = pricing[stat.model_identifier];
          const inputCost = (stat.input_tokens / 1000000) * modelPricing.input;
          const outputCost = (stat.output_tokens / 1000000) * modelPricing.output;
          estimatedCost = inputCost + outputCost;
        }

        const successRate = stat.request_count > 0 
          ? (stat.success_count / stat.request_count) * 100 
          : 0;

        return {
          model_id: stat.model_id,
          model_name: stat.model_name,
          provider: stat.provider,
          request_count: stat.request_count || 0,
          success_count: stat.success_count || 0,
          fail_count: stat.fail_count || 0,
          total_tokens: stat.total_tokens || 0,
          estimated_cost: parseFloat(estimatedCost.toFixed(4)),
          success_rate: parseFloat(successRate.toFixed(2)),
          avg_response_time: Math.round(stat.avg_response_time || 0),
          last_used_at: stat.last_used_at || null
        };
      });

      return res.json(successResponse(statsWithMetrics));
    } catch (error: any) {
      console.error('Get usage by model error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };

  /**
   * Update API key
   */
  updateAPIKey = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { key_name, api_key } = req.body;

      if (!key_name && !api_key) {
        return res.status(400).json(errorResponse('Please provide key_name or api_key to update'));
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (key_name) {
        updates.push('key_name = ?');
        values.push(key_name);
      }

      if (api_key) {
        updates.push('api_key = ?');
        values.push(api_key);
      }

      updates.push("updated_at = datetime('now')");
      values.push(id);

      const query = `UPDATE ai_api_keys SET ${updates.join(', ')} WHERE id = ?`;
      const result = this.db.prepare(query).run(...values);

      if (result.changes === 0) {
        return res.status(404).json(errorResponse('API key not found'));
      }

      return res.json(successResponse({ message: 'API key updated successfully' }));
    } catch (error: any) {
      console.error('Update API key error:', error);
      return res.status(500).json(errorResponse(error.message));
    }
  };
}
