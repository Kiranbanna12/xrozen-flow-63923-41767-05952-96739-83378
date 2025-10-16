/**
 * Enhanced AI Controller with OpenRouter Integration
 */

import { Request, Response } from 'express';
import Database from 'better-sqlite3';
import { ConnectionManager } from '@/lib/database/core/connection.manager';
import { randomUUID } from 'crypto';
import { AIAdminController } from './ai-admin.controller';

export class AIController {
  private db: Database.Database;
  private aiAdmin: AIAdminController;

  constructor() {
    const connectionManager = ConnectionManager.getInstance();
    this.db = connectionManager.getConnection();
    this.aiAdmin = new AIAdminController();
  }

  /**
   * Get the best available AI model
   */
  private getAvailableModel() {
    return this.db.prepare(`
      SELECT * FROM ai_models 
      WHERE enabled = 1 
      ORDER BY priority DESC, RANDOM()
      LIMIT 1
    `).get();
  }

  /**
   * Get all available models ordered by priority (for fallback)
   */
  private getAllAvailableModels() {
    return this.db.prepare(`
      SELECT * FROM ai_models 
      WHERE enabled = 1 
      ORDER BY priority DESC, created_at DESC
    `).all();
  }

  /**
   * Get next fallback model (excluding already tried models)
   */
  private getNextFallbackModel(triedModelIds: string[]) {
    const placeholders = triedModelIds.map(() => '?').join(',');
    const query = `
      SELECT * FROM ai_models 
      WHERE enabled = 1 
      ${triedModelIds.length > 0 ? `AND id NOT IN (${placeholders})` : ''}
      ORDER BY priority DESC
      LIMIT 1
    `;
    
    return this.db.prepare(query).get(...triedModelIds);
  }

  /**
   * Get active API key for a provider
   */
  /**
   * Get API key with round-robin rotation and load balancing
   * - Selects least recently used key
   * - Skips temporarily inactive keys
   * - Updates last_used_at and request_count
   * - Supports 10+ keys with fair distribution
   */
  private getAPIKey(provider: string): string | null {
    try {
      // First, auto-recover keys that were temporarily inactive
      const now = new Date().toISOString();
      this.db.prepare(`
        UPDATE ai_api_keys 
        SET temporary_inactive = 0, inactive_until = NULL
        WHERE provider = ? 
        AND temporary_inactive = 1 
        AND inactive_until IS NOT NULL 
        AND inactive_until < ?
      `).run(provider, now);

      // Get the least recently used active key (round-robin)
      const key = this.db.prepare(`
        SELECT id, api_key, request_count 
        FROM ai_api_keys 
        WHERE provider = ? 
        AND is_active = 1 
        AND temporary_inactive = 0
        ORDER BY 
          CASE 
            WHEN last_used_at IS NULL THEN 0 
            ELSE 1 
          END,
          last_used_at ASC,
          request_count ASC
        LIMIT 1
      `).get(provider) as any;

      if (!key) {
        console.error(`âŒ No active API key found for provider: ${provider}`);
        return null;
      }

      // Update usage timestamp and increment request count
      this.db.prepare(`
        UPDATE ai_api_keys 
        SET last_used_at = ?, 
            request_count = request_count + 1,
            updated_at = ?
        WHERE id = ?
      `).run(now, now, key.id);

      console.log(`ðŸ”‘ Using ${provider} API key (ID: ${key.id.substring(0, 8)}...) - Request #${key.request_count + 1}`);
      
      return key.api_key;
      
    } catch (error) {
      console.error(`âŒ Error getting API key for ${provider}:`, error);
      return null;
    }
  }

  /**
   * Mark an API key as temporarily inactive (for rate limits, auth errors)
   * - Auto-recovers after 5 minutes
   */
  private markKeyTemporarilyInactive(provider: string, apiKey: string, durationMinutes: number = 5) {
    try {
      const inactiveUntil = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      
      this.db.prepare(`
        UPDATE ai_api_keys 
        SET temporary_inactive = 1, 
            inactive_until = ?,
            updated_at = ?
        WHERE provider = ? AND api_key = ?
      `).run(inactiveUntil, new Date().toISOString(), provider, apiKey);
      
      console.log(`âš ï¸ Marked ${provider} key as temporarily inactive until ${inactiveUntil}`);
      
      // Get count of remaining active keys
      const activeCount = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM ai_api_keys 
        WHERE provider = ? 
        AND is_active = 1 
        AND temporary_inactive = 0
      `).get(provider) as any;
      
      console.log(`ðŸ“Š Remaining active ${provider} keys: ${activeCount.count}`);
      
    } catch (error) {
      console.error(`âŒ Error marking key inactive:`, error);
    }
  }

  /**
   * Make request to OpenRouter API with tool calling support
   */
  private async makeOpenRouterRequest(model: any, messages: any[], tools?: any[]) {
    const apiKey = this.getAPIKey('openrouter');
    
    if (!apiKey) {
      throw new Error('No OpenRouter API key configured');
    }

    const requestBody: any = {
      model: model.model_id,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: false
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8080',
        'X-Title': 'XrozenAI Workflow Assistant'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Mark key as temporarily inactive for rate limits or auth errors
      if (response.status === 429 || response.status === 401) {
        this.markKeyTemporarilyInactive('openrouter', apiKey, 5);
        console.log(`ðŸ”„ Switching to next available OpenRouter key...`);
      }
      
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Make request to OpenAI API with tool calling support
   */
  private async makeOpenAIRequest(model: any, messages: any[], tools?: any[]) {
    const apiKey = this.getAPIKey('openai');
    
    if (!apiKey) {
      throw new Error('No OpenAI API key configured');
    }

    const requestBody: any = {
      model: model.model_id,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
      stream: false
    };

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Mark key as temporarily inactive for rate limits or auth errors
      if (response.status === 429 || response.status === 401) {
        this.markKeyTemporarilyInactive('openai', apiKey, 5);
        console.log(`ðŸ”„ Switching to next available OpenAI key...`);
      }
      
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Make request to Google Gemini API
   */
  private async makeGeminiRequest(model: any, messages: any[], tools?: any[]) {
    const apiKey = this.getAPIKey('gemini') || this.getAPIKey('google');
    
    if (!apiKey) {
      throw new Error('No Gemini API key configured');
    }

    // Convert messages to Gemini format
    const geminiMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    // Add system message as first user message if present
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage) {
      geminiMessages.unshift({
        role: 'user',
        parts: [{ text: `System: ${systemMessage.content}` }]
      });
    }

    const requestBody: any = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      
      // Mark key as temporarily inactive for rate limits or auth errors
      if (response.status === 429 || response.status === 401) {
        this.markKeyTemporarilyInactive('gemini', apiKey, 5);
        console.log(`ðŸ”„ Switching to next available Gemini key...`);
      }
      
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // Convert Gemini response to standard format
    return {
      choices: [{
        message: {
          role: 'assistant',
          content: result.candidates?.[0]?.content?.parts?.[0]?.text || ''
        }
      }]
    };
  }

  /**
   * Make AI request based on provider (with usage tracking)
   */
  private async makeAIRequest(model: any, messages: any[], tools?: any[], userId?: string) {
    console.log(`ðŸ¤– Making request to provider: ${model.provider}, model: ${model.model_id}`);
    
    const startTime = Date.now();
    let success = false;
    let requestTokens = 0;
    let responseTokens = 0;
    let errorMessage: string | undefined;

    try {
      let result: any;

      switch (model.provider) {
        case 'openai':
          result = await this.makeOpenAIRequest(model, messages, tools);
          break;
        
        case 'gemini':
        case 'google':
          result = await this.makeGeminiRequest(model, messages, tools);
          break;
        
        case 'openrouter':
        default:
          result = await this.makeOpenRouterRequest(model, messages, tools);
          break;
      }

      // Extract token usage from response
      if (result.usage) {
        requestTokens = result.usage.prompt_tokens || 0;
        responseTokens = result.usage.completion_tokens || 0;
      }

      success = true;
      return result;
    } catch (error: any) {
      success = false;
      errorMessage = error.message;
      throw error;
    } finally {
      // Log the request to database
      const responseTime = Date.now() - startTime;
      
      if (userId) {
        this.aiAdmin.logRequest(
          model.id,
          userId,
          success,
          requestTokens,
          responseTokens,
          responseTime,
          errorMessage
        );
        
        console.log(`ðŸ“Š Logged AI request: ${success ? 'âœ… Success' : 'âŒ Failed'} | Tokens: ${requestTokens + responseTokens} | Time: ${responseTime}ms`);
      }
    }
  }

  /**
   * Parse Hinglish date expressions to standard dates
   */
  private parseHinglishDates(message: string): string {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let parsedMessage = message;
    
    // Parse "11 tarikh" or "isi month ki 11" â†’ YYYY-MM-11
    const datePattern = /(\d{1,2})\s*(tarikh|tareek|date)/gi;
    parsedMessage = parsedMessage.replace(datePattern, (match, day) => {
      const paddedDay = String(day).padStart(2, '0');
      const paddedMonth = String(currentMonth).padStart(2, '0');
      return `${currentYear}-${paddedMonth}-${paddedDay}`;
    });
    
    // Parse "isi month ki 15" â†’ YYYY-MM-15
    const thisMonthPattern = /(isi|is)\s+month\s+ki?\s+(\d{1,2})/gi;
    parsedMessage = parsedMessage.replace(thisMonthPattern, (match, _, day) => {
      const paddedDay = String(day).padStart(2, '0');
      const paddedMonth = String(currentMonth).padStart(2, '0');
      return `${currentYear}-${paddedMonth}-${paddedDay}`;
    });
    
    // Parse "agle hafte" (next week same day)
    if (/agle?\s+hafte/gi.test(parsedMessage)) {
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const formatted = nextWeek.toISOString().split('T')[0];
      parsedMessage = parsedMessage.replace(/agle?\s+hafte/gi, formatted);
    }
    
    // Parse "agle mahine" (next month same date)
    if (/agle?\s+mah[ie]ne/gi.test(parsedMessage)) {
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const formatted = nextMonth.toISOString().split('T')[0];
      parsedMessage = parsedMessage.replace(/agle?\s+mah[ie]ne/gi, formatted);
    }
    
    // Parse "parso" (day after tomorrow)
    if (/parso/gi.test(parsedMessage)) {
      const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const formatted = dayAfterTomorrow.toISOString().split('T')[0];
      parsedMessage = parsedMessage.replace(/parso/gi, formatted);
    }
    
    // Parse "kal" (tomorrow)
    if (/\bkal\b/gi.test(parsedMessage)) {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const formatted = tomorrow.toISOString().split('T')[0];
      parsedMessage = parsedMessage.replace(/\bkal\b/gi, formatted);
    }
    
    // Parse "aaj" (today)
    if (/\baaj\b/gi.test(parsedMessage)) {
      const formatted = now.toISOString().split('T')[0];
      parsedMessage = parsedMessage.replace(/\baaj\b/gi, formatted);
    }
    
    return parsedMessage;
  }

  /**
   * Define tools for AI to interact with database
   */
  private getToolDefinitions() {
    return [
      {
        type: "function",
        function: {
          name: "create_project",
          description: "Create a new video editing project in the database",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Project name" },
              description: { type: "string", description: "Project description" },
              client_id: { type: "string", description: "Client UUID (optional)" },
              editor_id: { type: "string", description: "Editor UUID (optional)" },
              deadline: { type: "string", description: "Deadline in YYYY-MM-DD format (optional)" },
              project_type: { type: "string", description: "Type of project (optional)" },
              fee: { type: "number", description: "Project fee amount (optional)" }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_client",
          description: "Add a new client to the database",
          parameters: {
            type: "object",
            properties: {
              full_name: { type: "string", description: "Client full name" },
              email: { type: "string", description: "Client email" },
              company: { type: "string", description: "Company name (optional)" },
              employment_type: { type: "string", enum: ["freelance", "fulltime"], description: "Employment type (optional)" },
              project_rate: { type: "number", description: "Per-project rate (optional)" },
              monthly_rate: { type: "number", description: "Monthly rate (optional)" }
            },
            required: ["full_name", "email"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "add_editor",
          description: "Add a new editor to the database",
          parameters: {
            type: "object",
            properties: {
              full_name: { type: "string", description: "Editor full name" },
              email: { type: "string", description: "Editor email" },
              specialty: { type: "string", description: "Editor specialty (optional)" },
              employment_type: { type: "string", enum: ["freelance", "fulltime"], description: "Employment type (optional)" },
              hourly_rate: { type: "number", description: "Hourly rate for freelance (optional)" },
              monthly_salary: { type: "number", description: "Monthly salary for fulltime (optional)" }
            },
            required: ["full_name", "email"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_projects",
          description: "Get list of all user's projects (both owned and shared) with their details. Shared projects will have is_shared=1 flag.",
          parameters: {
            type: "object",
            properties: {
              status: { type: "string", description: "Filter by status (optional): draft, in_review, approved, completed" },
              limit: { type: "number", description: "Maximum number of projects to return (optional, default 50)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_editors",
          description: "Get list of all editors",
          parameters: {
            type: "object",
            properties: {
              employment_type: { type: "string", enum: ["freelance", "fulltime"], description: "Filter by employment type (optional)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "list_clients",
          description: "Get list of all clients",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      },
      {
        type: "function",
        function: {
          name: "update_project_status",
          description: "Update the status of a project",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "Project UUID" },
              status: { type: "string", enum: ["draft", "in_review", "approved", "completed"], description: "New status" }
            },
            required: ["project_id", "status"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_project_details",
          description: "Get detailed information about a specific project including versions and feedback",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "Project UUID" },
              project_name: { type: "string", description: "Project name (if ID not known)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_project_versions",
          description: "Get all video versions for a project with their approval status and feedback count. Can use either project_id OR project_name.",
          parameters: {
            type: "object",
            properties: {
              project_id: { type: "string", description: "Project UUID (optional if project_name is provided)" },
              project_name: { type: "string", description: "Project name (optional if project_id is provided)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_version_feedback",
          description: "Get all feedback comments for a specific video version",
          parameters: {
            type: "object",
            properties: {
              version_id: { type: "string", description: "Video version UUID" },
              project_id: { type: "string", description: "Project UUID (optional)" }
            },
            required: ["version_id"]
          }
        }
      }
    ];
  }

  /**
   * Execute tool calls requested by AI
   */
  private async executeToolCall(toolName: string, args: any, userId: string): Promise<any> {
    try {
      switch (toolName) {
        case 'create_project': {
          const projectId = randomUUID();
          const now = new Date().toISOString();
          
          this.db.prepare(`
            INSERT INTO projects (id, name, description, creator_id, client_id, editor_id, deadline, project_type, fee, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
          `).run(
            projectId,
            args.name,
            args.description || null,
            userId,
            args.client_id || null,
            args.editor_id || null,
            args.deadline || null,
            args.project_type || null,
            args.fee || null,
            now,
            now
          );
          
          const project = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
          return { 
            success: true, 
            message: `âœ… Project "${args.name}" created successfully!`,
            project_id: projectId,
            data: project
          };
        }

        case 'add_client': {
          const clientId = randomUUID();
          const now = new Date().toISOString();
          
          this.db.prepare(`
            INSERT INTO clients (id, full_name, email, company, employment_type, project_rate, monthly_rate, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            clientId,
            args.full_name,
            args.email,
            args.company || null,
            args.employment_type || 'freelance',
            args.project_rate || null,
            args.monthly_rate || null,
            userId,
            now,
            now
          );
          
          const client = this.db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
          return { 
            success: true, 
            message: `âœ… Client "${args.full_name}" added successfully!`,
            client_id: clientId,
            data: client
          };
        }

        case 'add_editor': {
          const editorId = randomUUID();
          const now = new Date().toISOString();
          
          this.db.prepare(`
            INSERT INTO editors (id, full_name, email, specialty, employment_type, hourly_rate, monthly_salary, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            editorId,
            args.full_name,
            args.email,
            args.specialty || null,
            args.employment_type || 'freelance',
            args.hourly_rate || null,
            args.monthly_salary || null,
            userId,
            now,
            now
          );
          
          const editor = this.db.prepare('SELECT * FROM editors WHERE id = ?').get(editorId);
          return { 
            success: true, 
            message: `âœ… Editor "${args.full_name}" added successfully!`,
            editor_id: editorId,
            data: editor
          };
        }

        case 'list_projects': {
          // Get owned projects (created by this user)
          let query = 'SELECT *, 0 as is_shared FROM projects WHERE creator_id = ?';
          const params: any[] = [userId];
          
          if (args.status) {
            query += ' AND status = ?';
            params.push(args.status);
          }
          
          query += ' ORDER BY created_at DESC';
          
          const ownedProjects = this.db.prepare(query).all(...params);
          
          // Get shared projects (via access log or chat membership) - NOT created by this user
          const sharedProjectIds = new Set<string>();
          
          // From access logs
          try {
            const accessLogs = this.db.prepare(`
              SELECT DISTINCT ps.project_id
              FROM project_share_access_log psal
              JOIN project_shares ps ON psal.share_id = ps.id
              WHERE psal.user_id = ? AND ps.is_active = 1
            `).all(userId);
            
            accessLogs.forEach((log: any) => sharedProjectIds.add(log.project_id));
          } catch (e) {
            console.log('Note: project_share_access_log table may not exist yet');
          }
          
          // From chat membership
          try {
            const chatMemberships = this.db.prepare(`
              SELECT DISTINCT pcm.project_id
              FROM project_chat_members pcm
              WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
            `).all(userId);
            
            chatMemberships.forEach((membership: any) => sharedProjectIds.add(membership.project_id));
          } catch (e) {
            console.log('Note: project_chat_members table may not exist yet');
          }
          
          // Get shared project details - EXCLUDE projects already owned by this user
          let sharedProjects = [];
          if (sharedProjectIds.size > 0) {
            const projectIdsArray = Array.from(sharedProjectIds);
            const placeholders = projectIdsArray.map(() => '?').join(',');
            
            sharedProjects = this.db.prepare(`
              SELECT *, 1 as is_shared FROM projects 
              WHERE id IN (${placeholders}) AND creator_id != ?
              ORDER BY created_at DESC
            `).all(...projectIdsArray, userId);
          }
          
          // Double-check: Remove any shared projects that are already in owned projects (safety filter)
          const ownedProjectIds = new Set(ownedProjects.map((p: any) => p.id));
          sharedProjects = sharedProjects.filter((p: any) => !ownedProjectIds.has(p.id));
          
          // Combine owned and shared projects - NO LIMITS, show ALL
          const allProjects = [...ownedProjects, ...sharedProjects];
          
          return { 
            success: true, 
            count: allProjects.length,
            owned_count: ownedProjects.length,
            shared_count: sharedProjects.length,
            message: `Found ${ownedProjects.length} owned and ${sharedProjects.length} shared projects (Total: ${allProjects.length})`,
            data: allProjects
          };
        }

        case 'list_editors': {
          let query = 'SELECT * FROM editors WHERE user_id = ?';
          const params: any[] = [userId];
          
          if (args.employment_type) {
            query += ' AND employment_type = ?';
            params.push(args.employment_type);
          }
          
          query += ' ORDER BY created_at DESC';
          
          const editors = this.db.prepare(query).all(...params);
          return { 
            success: true, 
            count: editors.length,
            data: editors
          };
        }

        case 'list_clients': {
          const clients = this.db.prepare(`
            SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC
          `).all(userId);
          
          return { 
            success: true, 
            count: clients.length,
            data: clients
          };
        }

        case 'update_project_status': {
          this.db.prepare(`
            UPDATE projects 
            SET status = ?, updated_at = datetime('now')
            WHERE id = ? AND creator_id = ?
          `).run(args.status, args.project_id, userId);
          
          const project = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(args.project_id);
          return { 
            success: true, 
            message: `âœ… Project status updated to "${args.status}"`,
            data: project
          };
        }

        case 'get_project_details': {
          let project;
          
          if (args.project_id) {
            project = this.db.prepare(`
              SELECT * FROM projects WHERE id = ? AND creator_id = ?
            `).get(args.project_id, userId);
          } else if (args.project_name) {
            // Try exact match first
            project = this.db.prepare(`
              SELECT * FROM projects WHERE LOWER(name) = LOWER(?) AND creator_id = ? 
              LIMIT 1
            `).get(args.project_name, userId);
            
            // If no exact match, try fuzzy match
            if (!project) {
              project = this.db.prepare(`
                SELECT * FROM projects WHERE LOWER(name) LIKE LOWER(?) AND creator_id = ? 
                ORDER BY created_at DESC LIMIT 1
              `).get(`%${args.project_name}%`, userId);
            }
          }
          
          if (!project) {
            return { 
              success: false, 
              message: `Project "${args.project_name || args.project_id}" not found. Please check the name and try again.` 
            };
          }

          // Get versions count and latest version info
          const versionsInfo = this.db.prepare(`
            SELECT COUNT(*) as total_versions,
                   MAX(version_number) as latest_version,
                   SUM(CASE WHEN approval_status = 'approved' THEN 1 ELSE 0 END) as approved_versions
            FROM video_versions
            WHERE project_id = ?
          `).get(project.id);

          // Get total feedback count
          const feedbackInfo = this.db.prepare(`
            SELECT COUNT(*) as total_feedback
            FROM video_feedback vf
            JOIN video_versions vv ON vf.version_id = vv.id
            WHERE vv.project_id = ?
          `).get(project.id);
          
          return { 
            success: true,
            message: `Project "${project.name}" found with ${versionsInfo?.total_versions || 0} version(s)`,
            data: {
              ...project,
              versions_count: versionsInfo?.total_versions || 0,
              latest_version: versionsInfo?.latest_version || 0,
              approved_versions: versionsInfo?.approved_versions || 0,
              total_feedback: feedbackInfo?.total_feedback || 0
            }
          };
        }

        case 'get_project_versions': {
          let projectId = args.project_id;
          let projectName = '';
          
          // If project_name provided, find project ID first
          if (!projectId && args.project_name) {
            // Try exact match first (owned projects)
            let project = this.db.prepare(`
              SELECT id, name FROM projects 
              WHERE LOWER(name) = LOWER(?) AND creator_id = ?
              LIMIT 1
            `).get(args.project_name, userId);
            
            // If no exact match, try fuzzy match (owned projects)
            if (!project) {
              project = this.db.prepare(`
                SELECT id, name FROM projects 
                WHERE LOWER(name) LIKE LOWER(?) AND creator_id = ?
                ORDER BY created_at DESC
                LIMIT 1
              `).get(`%${args.project_name}%`, userId);
            }
            
            if (project) {
              projectId = project.id;
              projectName = project.name;
            }
          } else if (projectId) {
            // Get project name if we have ID
            const project = this.db.prepare(`
              SELECT name FROM projects WHERE id = ? AND creator_id = ?
            `).get(projectId, userId);
            
            if (project) {
              projectName = project.name;
            }
          }
          
          if (!projectId) {
            return { 
              success: false, 
              message: `Project "${args.project_name}" not found. Please check the project name and try again.` 
            };
          }

          // Get all versions with feedback count
          const versions = this.db.prepare(`
            SELECT 
              v.*,
              p.full_name as uploader_name,
              COUNT(f.id) as feedback_count,
              SUM(CASE WHEN f.is_resolved = 0 THEN 1 ELSE 0 END) as unresolved_feedback
            FROM video_versions v
            LEFT JOIN profiles p ON v.uploader_id = p.id
            LEFT JOIN video_feedback f ON v.id = f.version_id
            WHERE v.project_id = ?
            GROUP BY v.id
            ORDER BY v.version_number DESC
          `).all(projectId);
          
          if (versions.length === 0) {
            return { 
              success: true, 
              count: 0,
              project_name: projectName,
              message: `Project "${projectName}" has no versions yet.`,
              data: []
            };
          }
          
          return { 
            success: true, 
            count: versions.length,
            project_name: projectName,
            message: `Found ${versions.length} version(s) for project "${projectName}"`,
            data: versions
          };
        }

        case 'get_version_feedback': {
          // First verify the version exists and get version info
          const version = this.db.prepare(`
            SELECT v.*, p.name as project_name
            FROM video_versions v
            JOIN projects p ON v.project_id = p.id
            WHERE v.id = ? AND p.creator_id = ?
          `).get(args.version_id, userId);
          
          if (!version) {
            return { 
              success: false, 
              message: `Version not found or you don't have access to it.` 
            };
          }
          
          const feedback = this.db.prepare(`
            SELECT 
              f.*,
              p.full_name as user_name,
              p.email as user_email
            FROM video_feedback f
            LEFT JOIN profiles p ON f.user_id = p.id
            WHERE f.version_id = ?
            ORDER BY 
              CASE WHEN f.parent_id IS NULL THEN f.created_at END ASC,
              f.parent_id ASC,
              f.created_at ASC
          `).all(args.version_id);
          
          if (feedback.length === 0) {
            return { 
              success: true, 
              count: 0,
              version_number: version.version_number,
              project_name: version.project_name,
              message: `Version ${version.version_number} of "${version.project_name}" has no feedback yet.`,
              data: []
            };
          }
          
          // Organize into threaded structure
          const topLevelComments = feedback.filter(f => !f.parent_id);
          const repliesMap = new Map();
          
          feedback.forEach(f => {
            if (f.parent_id) {
              if (!repliesMap.has(f.parent_id)) {
                repliesMap.set(f.parent_id, []);
              }
              repliesMap.get(f.parent_id).push(f);
            }
          });

          const organizedFeedback = topLevelComments.map(comment => ({
            ...comment,
            replies: repliesMap.get(comment.id) || []
          }));
          
          return { 
            success: true, 
            count: feedback.length,
            version_number: version.version_number,
            project_name: version.project_name,
            unresolved: feedback.filter(f => !f.is_resolved).length,
            message: `Found ${feedback.length} feedback comment(s) for Version ${version.version_number}`,
            data: organizedFeedback
          };
        }

        default:
          return { success: false, message: `Unknown tool: ${toolName}` };
      }
    } catch (error: any) {
      console.error(`Error executing tool ${toolName}:`, error);
      return { 
        success: false, 
        message: `Failed to execute ${toolName}: ${error.message}` 
      };
    }
  }

  /**
   * Enhanced XrozenAI Chat with OpenRouter Integration
   */
  chat = async (req: Request, res: Response): Promise<void> => {
    console.log('ðŸ¤– AI Chat endpoint called with user:', (req as any).user?.userId);
    console.log('ðŸ“ Request body:', req.body);
    
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        console.log('âŒ No userId found in request');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { message, conversationId, messages } = req.body;
      console.log('ðŸ“ Message received:', { message, conversationId, messagesCount: messages?.length });

      if (!message) {
        console.log('âŒ No message provided');
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      try {
        // Get available AI model
        const model = this.getAvailableModel();
        if (!model) {
          console.log('âŒ No AI models available');
          res.status(503).json({ error: 'No AI models available. Please configure AI models in admin panel.' });
          return;
        }

        console.log('ðŸ¤– Using AI model:', model.model_name);

        // Build context from user's data
        const profile = this.db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
        
        // Get owned projects
        const ownedProjects = this.db.prepare('SELECT * FROM projects WHERE creator_id = ? ORDER BY created_at DESC').all(userId);
        
        // Get shared projects
        const sharedProjectIds = new Set<string>();
        
        try {
          const accessLogs = this.db.prepare(`
            SELECT DISTINCT ps.project_id
            FROM project_share_access_log psal
            JOIN project_shares ps ON psal.share_id = ps.id
            WHERE psal.user_id = ? AND ps.is_active = 1
          `).all(userId);
          
          accessLogs.forEach((log: any) => sharedProjectIds.add(log.project_id));
          
          const chatMemberships = this.db.prepare(`
            SELECT DISTINCT pcm.project_id
            FROM project_chat_members pcm
            WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
          `).all(userId);
          
          chatMemberships.forEach((membership: any) => sharedProjectIds.add(membership.project_id));
        } catch (e) {
          console.log('Note: Shared project tables may not exist yet');
        }
        
        // Get shared project details - EXCLUDE projects created by this user to avoid duplicates
        let sharedProjects = [];
        if (sharedProjectIds.size > 0) {
          const projectIdsArray = Array.from(sharedProjectIds);
          const placeholders = projectIdsArray.map(() => '?').join(',');
          sharedProjects = this.db.prepare(`
            SELECT * FROM projects 
            WHERE id IN (${placeholders}) AND creator_id != ?
          `).all(...projectIdsArray, userId);
        }
        
        // Double-check: Remove any shared projects that are already in owned projects (safety filter)
        const ownedProjectIds = new Set(ownedProjects.map(p => p.id));
        sharedProjects = sharedProjects.filter(p => !ownedProjectIds.has(p.id));
        
        // Combine all projects
        const projects = [...ownedProjects, ...sharedProjects];
        
        const editors = this.db.prepare('SELECT * FROM editors WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
        const clients = this.db.prepare('SELECT * FROM clients WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);

        console.log('ðŸ“Š User context:', { 
          userId,
          hasProfile: !!profile, 
          ownedProjectsCount: ownedProjects.length,
          sharedProjectsCount: sharedProjects.length,
          totalProjectsCount: projects.length,
          editorsCount: editors.length,
          clientsCount: clients.length,
          ownedProjects: ownedProjects.map(p => ({ id: p.id, name: p.name, creator_id: p.creator_id })),
          sharedProjects: sharedProjects.map(p => ({ id: p.id, name: p.name, creator_id: p.creator_id })),
          sharedProjectIds: Array.from(sharedProjectIds)
        });

        // Parse Hinglish date expressions
        const parsedMessage = this.parseHinglishDates(message);
        
        // Detect user's language from the message (default to English)
        const isHindiMessage = /[\u0900-\u097F]|(\b(kya|hai|ho|batao|dikha|dikhao|add karo|create karo|kitne|mera|mere|tera|tere|chahiye|kare|karke|karein|karna|hain|hun|tha|thi|the)\b)/i.test(message);
        const userLanguage = isHindiMessage ? 'hindi' : 'english';

        // ðŸ¤– All queries (simple & complex) now go through AI models for intelligent, context-aware responses
        console.log('ðŸ¤– Processing query through AI models for intelligent response');
        
        
        
        // Create advanced system prompt with language matching and context awareness (default English)
        const systemPrompt = userLanguage === 'english' 
          ? `You are XrozenAI, the intelligent AI assistant powering Xrozen Workflow platform. You're conversational, smart, and action-oriented.

ðŸŽ¯ YOUR PERSONALITY:
- Natural and friendly (no robotic templates)
- Respond in user's language (if user writes in Hindi/Hinglish, respond in Hindi/Hinglish)
- Direct and confident (when you have all info, execute immediately)
- Context-aware (remember conversation flow, no repetitive greetings)
- Smart about dates ("15th" â†’ current month's 15th, "day after tomorrow" â†’ +2 days)

ðŸ‘¤ USER CONTEXT:
- Name: ${profile?.full_name || 'User'}
- Projects: ${projects.length} active
- Editors: ${editors.length} on team
- Clients: ${clients.length} total

ðŸ“Š CURRENT DATA:
Total Projects: ${projects.length} (${ownedProjects.length} owned, ${sharedProjects.length} shared)

Your Projects (${ownedProjects.length}):
${ownedProjects.map(p => `- ${p.name} (${p.status}, ${p.project_type || 'General'}, Deadline: ${p.deadline || 'Not set'})`).join('\n') || '- No projects yet'}
${sharedProjects.length > 0 ? `\nShared with You (${sharedProjects.length}):\n${sharedProjects.map(p => `- ${p.name} [SHARED] (${p.status}, ${p.project_type || 'General'}, Deadline: ${p.deadline || 'Not set'})`).join('\n')}` : ''}

Editors:
${editors.slice(0, 3).map(e => `- ${e.full_name} (${e.email})`).join('\n') || '- No editors yet'}

Clients:
${clients.slice(0, 3).map(c => `- ${c.full_name} (${c.company || c.email})`).join('\n') || '- No clients yet'}

ðŸŽ¬ CRITICAL RULES:
1. **EXECUTE, DON'T ASK**: If user gives complete info (name + required fields), immediately use tools to create/update. No "shall I proceed?" confirmations.
   Example: User says "Add Test project, Podcast type, deadline 15th, fee 6000"
   â†’ Immediately call create_project with ALL data, then confirm completion
   
2. **VERSIONS AND FEEDBACK ACCESS - MANDATORY**: When user asks about project versions, feedback, or details:
   - ðŸš¨ ALWAYS call get_project_versions tool with project_name parameter - NEVER skip this
   - Call get_project_versions with JUST project_name (no project_id required)
   - âš ï¸ CRITICAL: Remove "[SHARED]" or "(Shared)" from project name before calling tool
   - Example: User says "Kiran Singh Rathore (Shared)" â†’ call get_project_versions with project_name="Kiran Singh Rathore"
   - NEVER say "no versions" without calling get_project_versions tool first
   - If tool returns empty array, then say "no versions found"
   - For feedback: Get version ID from get_project_versions result, then call get_version_feedback
   - NEVER generate fake/example data - only show actual tool results
   - Present tool data conversationally in natural language (NOT raw JSON)
   -  NEVER SHOW YOUR THINKING PROCESS: Don't say "Step 1", "Tool Call", "I need to call", "I'm fetching", "One moment", "Let me", etc.
   - Just call tools silently in background and present ONLY the final results directly to user
   - Example BAD: "Let me fetch... Tool Call: get_project_versions..." 
   - Example GOOD: "Kiran Singh Rathore project mein 4 versions hain..."
   
   - âŒ NEVER SHOW TOOL CALLS: Never display \"print(default_api...)\", \"t.get_project_versions(...)\", or any code/tool syntax to user
   - âŒ NEVER INVENT VERSION NAMES: Don't make up \"First Draft\", \"Second Iteration\" - use real version numbers (V1, V2, V3, V4)
   - âŒ NEVER FAKE FEEDBACK TEXT: Don't create fake feedback like \"Audio quality needs improvement\" - use exact feedback text from database or say \"no feedback\"
3. **SMART DATE PARSING**: Understand date expressions:
   - "15th" â†’ ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15
   - "this month 20th" â†’ current month's 20th
   - "next week" â†’ next week same day
   - "day after tomorrow" â†’ +2 days
   
4. **NO TEMPLATES**: Don't say "I'd be happy to help!" or "Could you please provide..."
   Instead: "What should I name the project?" or "Done! Test project created."
   
5. **CONTEXT RETENTION**: Remember previous messages. Don't repeat greetings if already said hi.
   
6. **OPTIONAL FIELDS**: If user says "skip description" or doesn't mention it, set as null/empty without asking.
   
7. **MAKE TOOL RESULTS CONVERSATIONAL**: When tools execute:
   - DON'T show JSON or raw data
   - Explain in natural language
   - Example: Tool returns project data â†’ Say "Done! Created 'Podcast' project with Rahul as client and Sumit as editor."

8. **WHEN ASKED ABOUT MODEL**: Always say "I'm XrozenAI, your workflow assistant" (NEVER mention OpenRouter/OpenAI/Gemini)

9. **ðŸš¨ NEVER SHOW WRONG DATA**: 
   - If data not found, CLEARLY state "data not found" or "project/version doesn't exist"
   - NEVER show example, mock, or fake data
   - If uncertain, admit it - don't assume
   - User trust is critical - wrong info breaks trust

ðŸ› ï¸ AVAILABLE ACTIONS:
Use tools confidently when user intent is clear. Don't ask permission if you have all required data.

RESPONSE STYLE:
- First interaction: Brief greeting + ask what they need
- Follow-up: Direct answer, no greeting
- Success: "Done! [details]. Anything else?"
- Questions: Short, specific (no lengthy explanations)

Current date: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' })}

Remember: You're helpful but efficient. Execute when possible, ask only when necessary.`
          : `Tum XrozenAI ho, Xrozen Workflow platform ki intelligent AI assistant. Tum conversational, smart, aur action-oriented ho.

ðŸŽ¯ YOUR PERSONALITY:
- Natural and friendly (no robotic templates)
- Respond in user's language (if user writes in Hindi/Hinglish, respond in Hindi/Hinglish)
- Direct and confident (when you have all info, execute immediately)
- Context-aware (remember conversation flow, no repetitive greetings)
- Smart about dates ("15th" â†’ current month's 15th, "day after tomorrow" â†’ +2 days)

ðŸ‘¤ USER CONTEXT:
- Name: ${profile?.full_name || 'User'}
- Projects: ${projects.length} active
- Editors: ${editors.length} on team
- Clients: ${clients.length} total

ðŸ“Š CURRENT DATA:
Total Projects: ${projects.length} (${ownedProjects.length} owned, ${sharedProjects.length} shared)

Your Projects (${ownedProjects.length}):
${ownedProjects.map(p => `- ${p.name} (${p.status}, ${p.project_type || 'General'}, Deadline: ${p.deadline || 'Not set'})`).join('\n') || '- No projects yet'}
${sharedProjects.length > 0 ? `\nShared with You (${sharedProjects.length}):\n${sharedProjects.map(p => `- ${p.name} [SHARED] (${p.status}, ${p.project_type || 'General'}, Deadline: ${p.deadline || 'Not set'})`).join('\n')}` : ''}

Editors:
${editors.slice(0, 3).map(e => `- ${e.full_name} (${e.email})`).join('\n') || '- No editors yet'}

Clients:
${clients.slice(0, 3).map(c => `- ${c.full_name} (${c.company || c.email})`).join('\n') || '- No clients yet'}

ðŸŽ¬ CRITICAL RULES:
1. **EXECUTE, DON'T ASK**: If user gives complete info (name + required fields), immediately use tools to create/update. No "shall I proceed?" confirmations.
   Example: User says "Add Test project, Podcast type, deadline 15th, fee 6000"
   â†’ Immediately call create_project with ALL data, then confirm completion
   
2. **VERSIONS AND FEEDBACK ACCESS - MANDATORY**: When user asks about project versions, feedback, or details:
   - ðŸš¨ ALWAYS call get_project_versions tool with project_name parameter - NEVER skip this
   - Call get_project_versions with JUST project_name (no project_id required)
   - âš ï¸ CRITICAL: Remove "[SHARED]" or "(Shared)" from project name before calling tool
   - Example: User says "Kiran Singh Rathore (Shared)" â†’ call get_project_versions with project_name="Kiran Singh Rathore"
   - NEVER say "no versions" without calling get_project_versions tool first
   - If tool returns empty array, then say "no versions found"
   - For feedback: Get version ID from get_project_versions result, then call get_version_feedback
   - NEVER generate fake/example data - only show actual tool results
   - Present tool data conversationally in natural language (NOT raw JSON)
   
   -  NEVER SHOW YOUR THINKING PROCESS: Don't say "Step 1", "Tool Call", "I need to call", "I'm fetching", "One moment", "Let me", etc.
   - Just call tools silently in background and present ONLY the final results directly to user
   - Example BAD: "Let me fetch... Tool Call: get_project_versions..." 
   - Example GOOD: "Kiran Singh Rathore project mein 4 versions hain..."
   - âŒ NEVER SHOW TOOL CALLS: Never display \"print(default_api...)\", \"t.get_project_versions(...)\", or any code/tool syntax to user
   - âŒ NEVER INVENT VERSION NAMES: Don't make up \"First Draft\", \"Second Iteration\" - use real version numbers (V1, V2, V3, V4)
   - âŒ NEVER FAKE FEEDBACK TEXT: Don't create fake feedback like \"Audio quality needs improvement\" - use exact feedback text from database or say \"no feedback\"
3. **SMART DATE PARSING**: Understand date expressions:
   - "15th" â†’ ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-15
   - "this month 20th" â†’ current month's 20th
   - "next week" â†’ next week same day
   - "day after tomorrow" â†’ +2 days
   
4. **NO TEMPLATES**: Don't say "I'd be happy to help!" or "Could you please provide..."
   Instead: "What should I name the project?" or "Done! Test project created."
   
5. **CONTEXT RETENTION**: Remember previous messages. Don't repeat greetings if already said hi.
   
6. **OPTIONAL FIELDS**: If user says "skip description" or doesn't mention it, set as null/empty without asking.
   
7. **MAKE TOOL RESULTS CONVERSATIONAL**: When tools execute:
   - DON'T show JSON or raw data
   - Explain in natural language
   - Example: Tool returns project data â†’ Say "Done! Created 'Podcast' project with Rahul as client and Sumit as editor."

8. **WHEN ASKED ABOUT MODEL**: Always say "I'm XrozenAI, your workflow assistant" (NEVER mention OpenRouter/OpenAI/Gemini)

9. **ðŸš¨ NEVER SHOW WRONG DATA**: 
   - If data not found, CLEARLY state "data not found" or "project/version doesn't exist"
   - NEVER show example, mock, or fake data
   - If uncertain, admit it - don't assume
   - User trust is critical - wrong info breaks trust

ðŸ› ï¸ AVAILABLE ACTIONS:
Use tools confidently when user intent is clear. Don't ask permission if you have all required data.

RESPONSE STYLE:
- First interaction: Brief greeting + ask what they need
- Follow-up: Direct answer, no greeting
- Success: "Done! [details]. Anything else?"
- Questions: Short, specific (no lengthy explanations)

Current date: ${new Date().toISOString().split('T')[0]}
Current time: ${new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' })}

Remember: You're helpful but efficient. Execute when possible, ask only when necessary.`;

        // Prepare messages for AI with parsed message
        const aiMessages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ];

        // Add conversation history if available
        if (conversationId && messages && messages.length > 0) {
          // Take last 10 messages to avoid token limits
          const recentMessages = messages.slice(-10).map((msg: any) => ({
            role: msg.role,
            content: msg.content
          }));
          aiMessages.splice(1, 0, ...recentMessages);
        }

        console.log('ðŸš€ Making OpenRouter API request with tool calling and smart fallback...');
        
        // Get tool definitions
        const tools = this.getToolDefinitions();
        
        // Make request to OpenRouter with tools and automatic fallback
        let assistantMessage = '';
        let actionData: any = null;
        let usedModel = model;
        const triedModels: string[] = [model.id];
        const maxRetries = 3;
        let success = false;
        
        for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
          try {
            console.log(`ðŸ”„ Attempt ${attempt + 1}/${maxRetries} with model: ${usedModel.model_name} (Priority: ${usedModel.priority}, Provider: ${usedModel.provider})`);
            
            const aiResponse = await this.makeAIRequest(usedModel, aiMessages, tools, userId);
          
            if (!aiResponse.choices || !aiResponse.choices[0]) {
              throw new Error('Invalid response format from AI provider');
            }
            
            const choice = aiResponse.choices[0];
            const responseMessage = choice.message;
            
            // Check if AI wants to use a tool
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
              console.log('ðŸ”§ AI requested tool calls');
              
              // Execute all tool calls
              const toolResults = [];
              for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                console.log(`ðŸ”§ Executing tool: ${functionName}`, functionArgs);
                
                const result = await this.executeToolCall(functionName, functionArgs, userId);
                console.log('âœ Tool result:', JSON.stringify(result, null, 2));
                toolResults.push(result);
                
                // Store action data for frontend
                if (result.success && (functionName === 'create_project' || functionName === 'add_client' || functionName === 'add_editor')) {
                  actionData = {
                    type: functionName.replace('create_', '').replace('add_', ''),
                    id: result.project_id || result.client_id || result.editor_id,
                    name: functionArgs.name || functionArgs.full_name
                  };
                }
              }
              
              // Store action data for potential UI updates (but DON'T show raw JSON to user)
              toolResults.forEach(result => {
                if (result.success && !actionData) {
                  // Store first successful action for internal use
                  actionData = result;
                }
              });
              
              // Format results as natural context for AI (NOT shown to user directly)
              const resultsContext = toolResults.map((r, idx) => {
                if (r.success) {
                  // For version/feedback queries, include detailed context
                  if (r.project_name || r.version_number) {
                    let context = r.message || '';
                    if (r.data && Array.isArray(r.data) && r.data.length > 0) {
                      // Add summary of data found
                      context += `\nData: ${JSON.stringify(r.data)}`;
                    } else if (r.data && Array.isArray(r.data) && r.data.length === 0) {
                      context += `\nNo data found.`;
                    }
                    return context;
                  }
                  
                  if (r.message) {
                    return r.message;
                  } else if (r.data) {
                    if (Array.isArray(r.data)) {
                      return `Found ${r.count || r.data.length} items with details available`;
                    } else {
                      return `Operation completed with data available`;
                    }
                  }
                }
                return r.message || 'Operation failed';
              }).join('\n\n');
              
              // Get AI's natural response about the tool execution
              // Important: Ask AI to convert tool results into conversational response
              console.log('📤 Sending to AI - resultsContext:', resultsContext);
              
              const followUpMessages = [
                ...aiMessages,
                responseMessage,
                {
                  role: 'tool',
                  content: `Tool executed successfully.\n\n${resultsContext}\n\nðŸšðŸšðŸš CRITICAL INSTRUCTIONS - FOLLOW EXACTLY ðŸšðŸšðŸš:\n\n1. âŒ NEVER INVENT DATA: Do NOT make up version names like \"First Draft\", \"Second Iteration\"\n2. âŒ NEVER FAKE FEEDBACK: Do NOT create fake comments like \"Audio quality needs improvement\" or \"Please add call-to-action\"\n3. âŒ NEVER SHOW TOOL CALLS: Do NOT show \"print(default_api.get_project_versions...)\" or any code/tool syntax\n4. âœ USE ONLY REAL DATA: Use EXACT data from the JSON above - real version numbers (1, 2, 3, 4), real IDs, real feedback text\n5. âœ IF NO DATA: If the data above is empty or shows \"No data found\", tell user \"Data nahi mila\" - DON'T make up examples\n6. âœ NATURAL LANGUAGE: Present in conversational ${userLanguage === 'hindi' ? 'Hindi/Hinglish' : 'English'} WITHOUT any JSON, code, or tool syntax\n7. âŒ NO THINKING PROCESS: Don't say \"I'm fetching\", \"Let me check\", \"One moment\" - just present results\n8. âœ BE HONEST: If uncertain about data, admit it - user trust is critical\n\nâš ï VIOLATION OF THESE RULES WILL BREAK USER TRUST âš ï`,
                  tool_call_id: responseMessage.tool_calls[0].id
                }
              ];
              
              const followUpResponse = await this.makeAIRequest(usedModel, followUpMessages);
              assistantMessage = followUpResponse.choices[0]?.message?.content || '';
              
              // If no response, generate a basic one
              if (!assistantMessage || assistantMessage.trim().length === 0) {
                console.warn('âš ï¸ Empty response from AI, generating fallback');
                assistantMessage = resultsContext || 'Operation completed successfully.';
              }
              
            } else {
              // No tool calls, just use the response
              assistantMessage = responseMessage.content || '';
            }
            
            console.log(`âœ… AI response processed with model: ${usedModel.model_name} (Provider: ${usedModel.provider})`);
            
            // Log the successful request
            this.logAIRequest(usedModel.id, userId, true, null);
            success = true;
            
          } catch (error: any) {
            console.error(`âŒ Attempt ${attempt + 1} failed with model ${usedModel.model_name}:`, error.message);
            
            // Log the failed request
            this.logAIRequest(usedModel.id, userId, false, error.message);
            
            // Try to get next fallback model
            if (attempt < maxRetries - 1) {
              const fallbackModel = this.getNextFallbackModel(triedModels);
              
              if (fallbackModel) {
                console.log(`ðŸ”„ Falling back to model: ${fallbackModel.model_name} (Priority: ${fallbackModel.priority})`);
                usedModel = fallbackModel;
                triedModels.push(fallbackModel.id);
              } else {
                console.log('âŒ No more fallback models available');
                break;
              }
            }
          }
        }
        
        // If all models failed, use local fallback response
        if (!success) {
          console.log('ðŸ”„ All AI models failed, using enhanced local response');
          assistantMessage = this.generateEnhancedLocalResponse(message, { 
            profile, 
            projects, 
            editors, 
            clients,
            ownedProjects,
            sharedProjects
          });
        }

        // Create or update conversation
        let convId = conversationId;
        if (!convId) {
          convId = randomUUID();
          this.db.prepare(`
            INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `).run(convId, userId, message.slice(0, 50));
          console.log('âœ… Created new conversation:', convId);
        }

        // Save messages
        if (convId) {
          const userMsgId = randomUUID();
          const assistantMsgId = randomUUID();
          
          this.db.prepare(`
            INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, 'user', ?, datetime('now'))
          `).run(userMsgId, convId, message);
          
          this.db.prepare(`
            INSERT INTO ai_messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, 'assistant', ?, datetime('now'))
          `).run(assistantMsgId, convId, assistantMessage);
          
          console.log('âœ… Saved messages to database');
        }

        console.log('âœ… Sending response to client');
        res.json({ 
          response: assistantMessage,
          conversationId: convId,
          model: usedModel.model_name,
          actionData: actionData || undefined
        });

      } catch (dbError: any) {
        console.error('âŒ Database error in chat:', dbError);
        console.error('Stack:', dbError.stack);
        res.status(500).json({ 
          error: `Database error: ${dbError.message}`,
          details: dbError.stack
        });
      }

    } catch (error) {
      console.error('âŒ Error in XrozenAI chat method:', error);
      console.error('âŒ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        userId: (req as any).user?.userId,
        body: req.body
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Internal server error';
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          endpoint: '/ai/chat'
        });
      }
    }
  };

  /**
   * Generate enhanced local response as fallback with Hinglish support
   */
  private generateEnhancedLocalResponse(message: string, context: any) {
    const { profile, projects, editors, clients, ownedProjects = [], sharedProjects = [] } = context;
    
    const lowerMessage = message.toLowerCase();
    const isGreeting = /^(hi|hello|hey|namaste|hii|hlo)\b/i.test(message);
    
    // Detect Hindi/Hinglish keywords (more comprehensive)
    const isHindi = /[\u0900-\u097F]|(\b(kya|kitne|dikha|dikhao|batao|add karo|create karo|ho|hai|chahiye|kare|karke|karein|karna|hain|hun|tha|thi|the|mera|mere|tera|tere|version|feedback)\b)/i.test(message);
    
    // PROJECT QUERIES
    if (lowerMessage.includes('project')) {
      // Create project
      if (/\b(create|add|banao|karo|new)\b/i.test(message)) {
        return isHindi 
          ? `Project banane ke liye naam, type, aur deadline batao. Example: "Test Podcast add karo, deadline 15 tarikh"`
          : `To create a project, tell me: name, type, and deadline. Example: "Create Test project, Podcast type, deadline Oct 15"`;
      }
      
      // List projects
      if (/\b(list|show|kitne|dikha|batao)\b/i.test(message)) {
        if (projects.length > 0) {
          const projectList = projects.map((p: any, i: number) => {
            // Check if this project is in sharedProjects array
            const isShared = sharedProjects.some((sp: any) => sp.id === p.id);
            return `${i + 1}. **${p.name}**${isShared ? ' (Shared)' : ''} (${p.status}, ${p.project_type || 'General'})`;
          }).join('\n');
          
          const summary = isHindi
            ? `Tumhare paas total ${projects.length} projects hain (${ownedProjects.length} owned, ${sharedProjects.length} shared):\n\n${projectList}`
            : `You have total ${projects.length} projects (${ownedProjects.length} owned, ${sharedProjects.length} shared):\n\n${projectList}`;
          
          return summary;
        } else {
          return isHindi
            ? `Abhi koi project nahi hai. Pehla project banau?`
            : `No projects yet. Want to create your first project?`;
        }
      }
      
      // Project status
      if (/\b(status|active|kitne active|draft|completed)\b/i.test(message)) {
        const draftCount = projects.filter((p: any) => p.status === 'draft').length;
        const activeCount = projects.filter((p: any) => p.status === 'in_review' || p.status === 'approved').length;
        const completedCount = projects.filter((p: any) => p.status === 'completed').length;
        
        return isHindi
          ? `ðŸ“Š **Status Overview:**\nâ€¢ Draft: ${draftCount}\nâ€¢ Active: ${activeCount}\nâ€¢ Completed: ${completedCount}\nâ€¢ Total: ${projects.length}`
          : `ðŸ“Š **Status Overview:**\nâ€¢ Draft: ${draftCount}\nâ€¢ Active: ${activeCount}\nâ€¢ Completed: ${completedCount}\nâ€¢ Total: ${projects.length}`;
      }
    }
    
    // EDITOR QUERIES
    if (/\b(editor|editors)\b/i.test(message)) {
      if (/\b(add|create|new|banao)\b/i.test(message)) {
        return isHindi
          ? `Editor add karne ke liye naam aur email batao. Example: "Rahul editor add karo, email rahul@example.com"`
          : `To add an editor, provide name and email. Example: "Add editor Rahul, email rahul@example.com"`;
      }
      
      if (editors.length > 0) {
        const editorList = editors.map((e: any) => `â€¢ **${e.full_name}** (${e.email})`).join('\n');
        return isHindi
          ? `${editors.length} editors hain:\n\n${editorList}`
          : `You have ${editors.length} editors:\n\n${editorList}`;
      } else {
        return isHindi 
          ? `Koi editor nahi hai. Pehla editor add karu?`
          : `No editors yet. Add your first editor?`;
      }
    }
    
    // CLIENT QUERIES
    if (/\b(client|clients)\b/i.test(message)) {
      if (/\b(add|create|new|banao)\b/i.test(message)) {
        return isHindi
          ? `Client add karne ke liye naam aur email batao. Example: "Kiran client add karo, email kiran@example.com"`
          : `To add a client, provide name and email. Example: "Add client Kiran, email kiran@example.com"`;
      }
      
      if (clients.length > 0) {
        const clientList = clients.map((c: any) => `â€¢ **${c.full_name}** (${c.company || c.email})`).join('\n');
        return isHindi
          ? `${clients.length} clients hain:\n\n${clientList}`
          : `You have ${clients.length} clients:\n\n${clientList}`;
      } else {
        return isHindi
          ? `Koi client nahi hai. Pehla client add karu?`
          : `No clients yet. Add your first client?`;
      }
    }
    
    // VERSION/FEEDBACK QUERIES - Actually query database
    if (/\b(version|versions|feedback|corrections|details)\b/i.test(lowerMessage)) {
      // Try multiple patterns to extract project name
      let projectNameMatch = message.match(/(?:^|\s)([a-zA-Z\s]+?)(?:\s+project|\s+ke|\s+ka|\s+ki)/i);
      
      // Pattern 2: "thggf is project ki details"
      if (!projectNameMatch) {
        projectNameMatch = message.match(/^([a-zA-Z\s]+?)(?:\s+is\s+project|\s+project)/i);
      }
      
      // Pattern 3: Just the first word(s) before version/details keywords
      if (!projectNameMatch) {
        projectNameMatch = message.match(/^([a-zA-Z\s]+?)(?:\s+version|\s+details|\s+ke)/i);
      }
      
      if (projectNameMatch && projectNameMatch[1]) {
        const searchName = projectNameMatch[1].trim();
        
        // Find matching project
        const matchedProject = projects.find((p: any) => 
          p.name.toLowerCase().includes(searchName.toLowerCase()) ||
          searchName.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (matchedProject) {
          // Query database for versions
          try {
            const versions = this.db.prepare(`
              SELECT 
                v.*,
                p.full_name as uploader_name,
                COUNT(f.id) as feedback_count,
                SUM(CASE WHEN f.is_resolved = 0 THEN 1 ELSE 0 END) as unresolved_feedback
              FROM video_versions v
              LEFT JOIN profiles p ON v.uploader_id = p.id
              LEFT JOIN video_feedback f ON v.id = f.version_id
              WHERE v.project_id = ?
              GROUP BY v.id
              ORDER BY v.version_number DESC
            `).all(matchedProject.id);
            
            if (versions.length === 0) {
              return isHindi
                ? `"${matchedProject.name}" project mein abhi koi version upload nahi hua hai.`
                : `"${matchedProject.name}" project has no versions uploaded yet.`;
            }
            
            // Format versions nicely
            const versionsList = versions.map((v: any) => {
              const statusEmoji = v.approval_status === 'approved' ? 'âœ…' : 
                                  v.approval_status === 'corrections_needed' ? 'âš ï¸' : 'â³';
              const feedbackText = v.feedback_count > 0 ? ` (${v.feedback_count} feedback)` : '';
              return `${statusEmoji} **Version ${v.version_number}** - ${v.approval_status}${feedbackText}`;
            }).join('\n');
            
            return isHindi
              ? `"${matchedProject.name}" project mein **${versions.length} version(s)** hain:\n\n${versionsList}\n\nKisi version ka detailed feedback chahiye?`
              : `"${matchedProject.name}" project has **${versions.length} version(s)**:\n\n${versionsList}\n\nNeed detailed feedback for any version?`;
          } catch (error) {
            console.error('Error querying versions:', error);
            return isHindi
              ? `"${matchedProject.name}" ke versions load karne mein error aaya. Please try again.`
              : `Error loading versions for "${matchedProject.name}". Please try again.`;
          }
        } else {
          return isHindi
            ? `"${searchName}" naam se koi project nahi mila. Available projects:\n${projects.map((p: any) => `â€¢ ${p.name}`).join('\n')}`
            : `No project found with name "${searchName}". Available projects:\n${projects.map((p: any) => `â€¢ ${p.name}`).join('\n')}`;
        }
      }
      
      return isHindi
        ? `Versions dekhne ke liye project ka naam batao. Tumhare projects:\n${projects.map((p: any) => `â€¢ ${p.name}`).join('\n')}`
        : `To see versions, tell me the project name. Your projects:\n${projects.map((p: any) => `â€¢ ${p.name}`).join('\n')}`;
    }
    
    // MODEL QUERY - Always respond as XrozenAI
    if (/\b(model|which model|konsa model|kaunsa model|api|provider)\b/i.test(message)) {
      return isHindi
        ? `Main XrozenAI hun, tumhari workflow assistant! ðŸ¤–`
        : `I'm XrozenAI, your workflow assistant! ðŸ¤–`;
    }
    
    // GREETING (only if first message or explicit greeting)
    if (isGreeting) {
      const name = profile?.full_name || 'there';
      const greeting = isHindi
        ? `Hey ${name}! ðŸ‘‹ Kya help chahiye?`
        : `Hey ${name}! ðŸ‘‹ What can I help with?`;
      
      const stats = `\n\nðŸ“Š **Quick Stats:**\nâ€¢ Projects: ${projects.length}\nâ€¢ Editors: ${editors.length}\nâ€¢ Clients: ${clients.length}`;
      
      return greeting + stats;
    }
    
    // GENERAL HELP
    if (/\b(help|kya|what|kaise|how)\b/i.test(message)) {
      return isHindi
        ? `Main ye kar sakta hun:\nâ€¢ Project create/manage karna\nâ€¢ Editor aur client add karna\nâ€¢ Status track karna\nâ€¢ Workflow optimize karna\n\nKya karna hai?`
        : `I can help you with:\nâ€¢ Creating/managing projects\nâ€¢ Adding editors and clients\nâ€¢ Tracking status\nâ€¢ Optimizing workflow\n\nWhat would you like to do?`;
    }
    
    // DEFAULT - Be conversational
    return isHindi
      ? `Samajh gaya. Tumhare paas ${projects.length} projects, ${editors.length} editors, aur ${clients.length} clients hain.\n\nMain kya help kar sakta hun? Project add karein, status check karein, ya kuch aur?`
      : `Got it. You have ${projects.length} projects, ${editors.length} editors, and ${clients.length} clients.\n\nHow can I help? Add a project, check status, or something else?`;
  }

  /**
   * Log AI request for monitoring
   */
  private logAIRequest(modelId: string, userId: string, success: boolean, errorMessage?: string) {
    try {
      const id = randomUUID();
      this.db.prepare(`
        INSERT INTO ai_request_logs (id, model_id, user_id, success, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(id, modelId, userId, success ? 1 : 0, errorMessage || null);
    } catch (error) {
      console.error('Failed to log AI request:', error);
    }
  }

  /**
   * Get AI conversation history
   */
  getConversations = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const conversations = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE user_id = ? 
        ORDER BY updated_at DESC
      `).all(userId);

      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  };

  /**
   * Create new conversation
   */
  createConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { title } = req.body;
      const convId = randomUUID();
      
      this.db.prepare(`
        INSERT INTO ai_conversations (id, user_id, title, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `).run(convId, userId, title || 'New Conversation');

      const conversation = this.db.prepare('SELECT * FROM ai_conversations WHERE id = ?').get(convId);
      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  /**
   * Delete conversation
   */
  deleteConversation = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { conversationId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify user owns this conversation
      const conversation = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE id = ? AND user_id = ?
      `).get(conversationId, userId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Delete messages first
      this.db.prepare('DELETE FROM ai_messages WHERE conversation_id = ?').run(conversationId);
      
      // Delete conversation
      this.db.prepare('DELETE FROM ai_conversations WHERE id = ?').run(conversationId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  };

  /**
   * Get messages for a conversation
   */
  getMessages = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.userId;
      const { conversationId } = req.params;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify user owns this conversation
      const conversation = this.db.prepare(`
        SELECT * FROM ai_conversations 
        WHERE id = ? AND user_id = ?
      `).get(conversationId, userId);

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const messages = this.db.prepare(`
        SELECT * FROM ai_messages 
        WHERE conversation_id = ? 
        ORDER BY created_at ASC
      `).all(conversationId);

      console.log(`âœ… Returning ${messages.length} messages for conversation ${conversationId}`);
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  };
}
