/**
 * Universal API Client
 * Replaces all Supabase calls with REST API calls to Express backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseURL: string;
  private authToken: string | null = null;
  private tokenExpiredCallbacks: Array<() => void> = [];
  private isClearing = false;
  private authState: 'checking' | 'authenticated' | 'unauthenticated' = 'checking';
  private debug: boolean = import.meta.env.MODE === 'development' && import.meta.env.VITE_API_DEBUG === 'true';

  constructor() {
    this.baseURL = API_BASE_URL;
    this.initializeAuth();
  }

  private log(...args: any[]) {
    if (this.debug) {
      console.log(...args);
    }
  }

  private initializeAuth() {
    // First, try to get token from localStorage
    const storedToken = localStorage.getItem('auth_token');

    if (storedToken) {
      this.log('🔧 ApiClient: Found stored token, checking validity');

      // Check if token is expired
      if (this.isTokenExpired(storedToken)) {
        this.log('🔧 ApiClient: Stored token is expired, clearing it');
        localStorage.removeItem('auth_token');
        this.authToken = null;
        this.authState = 'unauthenticated';
      } else {
        this.log('🔧 ApiClient: Stored token is valid, setting it');
        this.authToken = storedToken;
        this.authState = 'authenticated';
      }
    } else {
      // Only log this in debug mode as it's very common and not an error
      this.authState = 'unauthenticated';
    }
  }

  private clearAuth() {
    if (this.isClearing) {
      this.log('🔧 ApiClient: Already clearing auth, skipping');
      return;
    }

    this.isClearing = true;
    this.authToken = null;
    this.authState = 'unauthenticated';
    localStorage.removeItem('auth_token');

    // Debounce callbacks to prevent multiple simultaneous calls
    setTimeout(() => {
      this.tokenExpiredCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('🔧 ApiClient: Error in token expired callback:', error);
        }
      });
      this.isClearing = false;
    }, 100);
  }

  public onTokenExpired(callback: () => void) {
    this.tokenExpiredCallbacks.push(callback);
  }

  public removeTokenExpiredCallback(callback: () => void) {
    this.tokenExpiredCallbacks = this.tokenExpiredCallbacks.filter(cb => cb !== callback);
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Check if token is expired before making request
    if (this.authToken && this.isTokenExpired()) {
      this.log('🔧 ApiClient: Token expired during request, clearing');
      this.clearAuth();
    }

    // Add Authorization header if token exists and is valid
    if (this.authToken && !this.isTokenExpired()) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
      this.log('🔧 ApiClient: Adding auth header for request to', endpoint);
    } else {
      // Don't log this for common unauthenticated requests to reduce console noise
      if (this.debug && !endpoint.includes('/profiles/me')) {
        this.log('🔧 ApiClient: No valid token for request to', endpoint);
      }
    }

    // Merge custom headers
    if (options.headers) {
      const customHeaders = options.headers as Record<string, string>;
      Object.assign(headers, customHeaders);
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 401) {
        // Check if this is a general auth failure or endpoint-specific issue
        const isGeneralAuthFailure = endpoint === '/profiles/me' || endpoint.includes('/auth/');
        const isAIEndpoint = endpoint.includes('/ai/');

        if (isGeneralAuthFailure && !this.isClearing && !endpoint.includes('/auth/')) {
          console.log('🔧 ApiClient: General auth failure, clearing auth');
          this.clearAuth();

          // Dispatch auth expired event only for general auth failures
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('auth-expired'));
          }, 50);
        } else if (isAIEndpoint) {
          console.log('🔧 ApiClient: AI endpoint auth failure for', endpoint, '- endpoint may not be available');
          // AI endpoints might not be implemented yet, don't clear global auth
        } else if (!isGeneralAuthFailure) {
          console.log('🔧 ApiClient: Endpoint-specific auth failure for', endpoint, '- not clearing global auth');
        } else if (endpoint.includes('/auth/')) {
          console.log('🔧 ApiClient: 401 on auth endpoint, not clearing token');
        }

        throw new Error('Unauthorized - please login again');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Authentication Methods
  async login(email: string, password: string): Promise<{ user: any; token: string }> {
    console.log('🔧 ApiClient: Starting login request');

    const response = await this.request<ApiResponse<{ user: any; token: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    console.log('🔧 ApiClient: Login response received:', {
      success: response.success,
      hasData: !!response.data,
      hasToken: !!(response.data?.token)
    });

    // Ensure we have the correct response structure
    if (response.success && response.data && response.data.token) {
      this.authToken = response.data.token;
      localStorage.setItem('auth_token', response.data.token);
      console.log('🔧 ApiClient: Login successful, token stored');
      return response.data;
    } else {
      console.error('🔧 ApiClient: Invalid login response structure:', response);
      throw new Error('Invalid response structure from server');
    }
  }

  async signup(email: string, password: string, metadata: any = {}): Promise<{ user: any; token: string }> {
    const response = await this.request<ApiResponse<{ user: any; token: string }>>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...metadata }),
    });

    // Ensure we have the correct response structure
    if (response.success && response.data && response.data.token) {
      this.authToken = response.data.token;
      localStorage.setItem('auth_token', response.data.token);
      return response.data;
    } else {
      throw new Error('Invalid response structure from server');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.authToken = null;
      localStorage.removeItem('auth_token');
    }
  }

  async getCurrentUser(): Promise<any | null> {
    this.log('🔧 ApiClient: Getting current user, auth status:', this.isAuthenticated());
    const response = await this.request<ApiResponse<any>>('/profiles/me');
    this.log('🔧 ApiClient: Current user response:', { success: response.success, hasData: !!response.data });
    return response.data || null;
  }

  async getUserRole(userId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/profiles/${userId}/role`);
    return response.data;
  }

  async resetPassword(email: string): Promise<void> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async updatePassword(newPassword: string): Promise<void> {
    return this.request('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  // Profile Operations
  async getProfile(userId?: string): Promise<any> {
    const endpoint = userId ? `/profiles/${userId}` : '/profiles/me';
    const response = await this.request<ApiResponse<any>>(endpoint);
    return response.data;
  }

  async updateProfile(data: any): Promise<any> {
    return this.request('/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Project Operations
  async getProjects(filters?: any): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `/projects?${queryParams.toString()}`
      : '/projects';

    const response = await this.request<ApiResponse<any[]>>(endpoint);
    return response.data || [];
  }

  async getProject(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateProject(id: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async getSubProjects(parentProjectId: string): Promise<any[]> {
    console.log('🔧 ApiClient: Getting sub-projects for parent:', parentProjectId);
    const url = `/projects?parent_project_id=${encodeURIComponent(parentProjectId)}`;
    console.log('🔧 ApiClient: Request URL:', url);
    const response = await this.request<ApiResponse<any[]>>(url);
    console.log('🔧 ApiClient: Sub-projects response:', response.data);
    return response.data || [];
  }

  // Editor Operations
  async getEditors(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/editors');
    return response.data || [];
  }

  async getEditor(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/editors/${id}`);
    return response.data;
  }

  async getEditorProjects(id: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/editors/${id}/projects`);
    return response.data || [];
  }

  async createEditor(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/editors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateEditor(id: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/editors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // Client Operations
  async getClients(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/clients');
    return response.data || [];
  }

  async getClient(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/clients/${id}`);
    return response.data;
  }

  async getClientProjects(id: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/clients/${id}/projects`);
    return response.data || [];
  }

  async createClient(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateClient(id: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // Message Operations
  async getMessages(projectId?: string): Promise<any[]> {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    const endpoint = projectId
      ? `/messages?project_id=${projectId}&_t=${timestamp}`
      : `/messages?_t=${timestamp}`;
    const response = await this.request<ApiResponse<any[]>>(endpoint, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    return response.data || [];
  }

  async createMessage(data: any): Promise<any> {
    console.log('🔧 ApiClient: Creating message with data:', data);
    console.log('🔧 ApiClient: Current auth state:', this.isAuthenticated());
    const response = await this.request<ApiResponse<any>>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    console.log('🔧 ApiClient: Message creation response:', response);
    return response.data || response;
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    return this.request(`/messages/${messageId}/read`, {
      method: 'PUT',
    });
  }

  async getMessageInfo(messageId: string): Promise<any> {
    try {
      const response = await this.request<ApiResponse<any>>(`/messages/${messageId}/info`);
      return response.data || { delivered_to: [], read_by: [] };
    } catch (error) {
      console.error('Failed to get message info:', error);
      return { delivered_to: [], read_by: [] };
    }
  }

  async pinMessage(messageId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}/pin`, {
      method: 'PUT'
    });
    return response.data;
  }

  async starMessage(messageId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}/star`, {
      method: 'PUT'
    });
    return response.data;
  }

  async deleteMessage(messageId: string, deleteForEveryone: boolean = false): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}`, {
      method: 'DELETE',
      body: JSON.stringify({ deleteForEveryone })
    });
    return response.data;
  }

  async reportMessage(messageId: string, reason: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    return response.data;
  }

  async reactToMessage(messageId: string, emoji: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
    return response.data;
  }

  async editMessage(messageId: string, content: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    return response.data;
  }

  async getUnreadCounts(): Promise<{ projects: any[]; total_unread: number }> {
    const response = await this.request<ApiResponse<any>>('/messages/unread/counts', {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    return response.data || { projects: [], total_unread: 0 };
  }

  async markProjectAsRead(projectId: string): Promise<void> {
    await this.request(`/messages/projects/${projectId}/mark-read`, {
      method: 'PUT'
    });
  }

  // Payment Operations
  async getPayments(filters?: any): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
    }

    const endpoint = queryParams.toString()
      ? `/payments?${queryParams.toString()}`
      : '/payments';

    const response = await this.request<ApiResponse<any[]>>(endpoint);
    return response.data || [];
  }

  async getPayment(id: string): Promise<any> {
    return this.request(`/payments/${id}`);
  }

  async createPayment(data: any): Promise<any> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePayment(id: string, data: any): Promise<any> {
    return this.request(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Invoice Operations
  async getInvoices(filters?: any): Promise<any[]> {
    let endpoint = '/invoices';

    if (filters && Object.keys(filters).length > 0) {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      endpoint = queryParams.toString()
        ? `/invoices?${queryParams.toString()}`
        : '/invoices';
    }

    const response = await this.request<ApiResponse<any[]>>(endpoint);
    return response.data || [];
  }

  async getInvoice(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${id}`);
    return response.data;
  }

  async createInvoice(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateInvoice(id: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteInvoice(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  async getInvoiceItems(invoiceId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/invoices/${invoiceId}/items`);
    return response.data || [];
  }

  async addInvoiceItem(invoiceId: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${invoiceId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateInvoiceItem(invoiceId: string, itemId: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${invoiceId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteInvoiceItem(invoiceId: string, itemId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/invoices/${invoiceId}/items/${itemId}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  // Video Version Operations
  async getVideoVersions(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/versions`);
    return response.data || [];
  }

  async createVideoVersion(projectId: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${projectId}/versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateVideoVersion(projectId: string, versionId: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${projectId}/versions/${versionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteVideoVersion(projectId: string, versionId: string): Promise<void> {
    await this.request(`/projects/${projectId}/versions/${versionId}`, {
      method: 'DELETE',
    });
  }

  // Video Feedback Operations
  async getVideoFeedback(versionId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/versions/${versionId}/feedback`);
    return response.data || [];
  }

  async createVideoFeedback(versionId: string, data: any): Promise<any> {
    return this.request(`/versions/${versionId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVideoFeedback(versionId: string, feedbackId: string, data: any): Promise<any> {
    return this.request(`/versions/${versionId}/feedback/${feedbackId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVideoFeedback(versionId: string, feedbackId: string): Promise<void> {
    await this.request(`/versions/${versionId}/feedback/${feedbackId}`, {
      method: 'DELETE',
    });
  }

  async getProjectFeedbackSummary(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/feedback-summary`);
    return response.data || [];
  }

  // Notification Operations
  async getNotifications(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/notifications');
    return response.data || [];
  }

  async getUnreadNotificationCount(): Promise<number> {
    const response = await this.request<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return response.data?.count || 0;
  }

  async createNotification(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(notificationId: string): Promise<void> {
    return this.request(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  }

  async deleteAllNotifications(): Promise<void> {
    return this.request('/notifications', {
      method: 'DELETE',
    });
  }

  // Admin Operations
  async getUsers(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/admin/users');
    return response.data || [];
  }

  async deleteUser(userId: string): Promise<void> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getTables(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/admin/tables');
    return response.data || [];
  }

  async getTableSchema(tableName: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/admin/tables/${tableName}`);
    return response.data || {};
  }

  async getTableData(tableName: string): Promise<any[]> {
    const response = await this.request<ApiResponse<{ items: any[]; pagination: any }>>(`/admin/tables/${tableName}/data`);
    return response.data?.items || [];
  }

  // Subscription Operations
  async getSubscriptions(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/admin/subscriptions');
    return response.data || [];
  }

  async updateSubscriptionStatus(userId: string, updates: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/admin/subscriptions/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.data || {};
  }

  // User Subscription Management
  async getMySubscription(): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/subscriptions/me');
    return response.data || {};
  }

  async upgradeSubscription(tier: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/subscriptions/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier })
    });
    return response.data || {};
  }

  async cancelSubscription(): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/subscriptions/cancel', {
      method: 'POST'
    });
    return response.data || {};
  }

  async getPaymentMethods(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/payment-methods');
    return response.data || [];
  }

  async addPaymentMethod(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/payment-methods', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response.data || {};
  }

  async removePaymentMethod(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/payment-methods/${id}`, {
      method: 'DELETE'
    });
    return response.data || {};
  }

  async setDefaultPaymentMethod(id: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/payment-methods/${id}/default`, {
      method: 'PUT'
    });
    return response.data || {};
  }

  // Performance Operations
  async getPerformanceMetrics(): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/admin/performance/metrics');
    return response.data || {};
  }

  async getPerformanceHealth(): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/admin/performance/health');
    return response.data || {};
  }

  // Database Operations
  async getDatabaseStats(): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/admin/database/stats');
    return response.data || {};
  }

  async getDatabaseHealth(): Promise<boolean> {
    const response = await this.request<ApiResponse<any>>('/admin/database/health');
    return response.success;
  }

  // Migration Operations
  async runMigrations(): Promise<any> {
    return this.request('/admin/migrations/run', {
      method: 'POST',
    });
  }

  async rollbackMigration(): Promise<any> {
    return this.request('/admin/migrations/rollback', {
      method: 'POST',
    });
  }

  // Backup Operations
  async createBackup(): Promise<any> {
    return this.request('/admin/backups/create', {
      method: 'POST',
    });
  }

  async restoreBackup(backupId: string): Promise<any> {
    return this.request(`/admin/backups/${backupId}/restore`, {
      method: 'POST',
    });
  }

  async getBackups(): Promise<any[]> {
    return this.request('/admin/backups');
  }

  async getSlowQueries(): Promise<any[]> {
    return this.request('/admin/performance/slow-queries');
  }

  // Query Operations
  async executeQuery(query: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/admin/query/execute', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
    return response.data || [];
  }

  async getQueryHistory(): Promise<any[]> {
    return this.request('/admin/query/history');
  }

  // AI Operations - XrozenAI with multilingual support and memory
  async sendAIMessage(message: string, conversationId?: string, messages?: any[]): Promise<any> {
    console.log('🤖 ApiClient: Sending AI message', { message, conversationId, messagesCount: messages?.length });
    const response = await this.request<ApiResponse<any>>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId, messages }),
    });
    console.log('🤖 ApiClient: AI response received', response);
    return response.data || response;
  }

  async chatWithAI(message: string, conversationId?: string, messages?: any[]): Promise<any> {
    return this.sendAIMessage(message, conversationId, messages);
  }

  async getAIConversations(): Promise<any[]> {
    console.log('🤖 ApiClient: Fetching AI conversations');
    const response = await this.request<ApiResponse<any[]>>('/ai/conversations');
    console.log('🤖 ApiClient: Conversations fetched', { count: response.data?.length });
    return response.data || [];
  }

  async createAIConversation(title?: string): Promise<any> {
    console.log('🤖 ApiClient: Creating new AI conversation');
    const response = await this.request<ApiResponse<any>>('/ai/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: title || 'New Conversation' }),
    });
    console.log('🤖 ApiClient: Conversation created', response.data);
    return response.data;
  }

  async deleteAIConversation(conversationId: string): Promise<void> {
    console.log('🤖 ApiClient: Deleting AI conversation', conversationId);
    await this.request(`/ai/conversations/${conversationId}`, {
      method: 'DELETE',
    });
    console.log('🤖 ApiClient: Conversation deleted');
  }

  async getAIMessages(conversationId: string): Promise<any[]> {
    console.log('🤖 ApiClient: Fetching AI messages for conversation', conversationId);
    const response = await this.request<ApiResponse<any[]>>(`/ai/conversations/${conversationId}/messages`);
    console.log('🤖 ApiClient: Messages fetched', { count: response.data?.length });
    return response.data || [];
  }

  // Project Sharing Operations
  async getProjectShares(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/shares`);
    return response.data || [];
  }

  async createProjectShare(data: {
    project_id: string;
    can_view: boolean;
    can_edit: boolean;
    can_chat: boolean;
  }): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/project-shares', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateProjectShare(shareId: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/project-shares/${shareId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteProjectShare(shareId: string): Promise<void> {
    await this.request(`/project-shares/${shareId}`, {
      method: 'DELETE',
    });
  }

  async getProjectShareByToken(token: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/project-shares/token/${token}`);
    return response.data;
  }

  async logShareAccess(token: string, data?: {
    user_agent?: string;
    ip_address?: string;
  }): Promise<void> {
    await this.request(`/project-shares/token/${token}/log-access`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  async getSharedProjectVersions(token: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/project-shares/token/${token}/versions`);
    return response.data || [];
  }

  async getSharedVersionDetails(token: string, versionId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/project-shares/token/${token}/versions/${versionId}`);
    return response.data;
  }

  async getSharedVersionFeedback(token: string, versionId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/project-shares/token/${token}/versions/${versionId}/feedback`);
    return response.data || [];
  }

  async getMySharedProjects(): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/my-shared-projects');
    return response.data || [];
  }

  async getProjectShareAccessLogs(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/share-access-logs`);
    return response.data || [];
  }

  // Project Chat Members Operations
  async getProjectChatMembers(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/chat-members`);
    return response.data || [];
  }

  async joinProjectChat(data: {
    project_id: string;
    share_id?: string;
    guest_name?: string;
  }): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/project-chat-members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateChatMemberStatus(memberId: string, isActive: boolean): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/project-chat-members/${memberId}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
    return response.data;
  }

  async removeChatMember(projectId: string, memberId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${projectId}/chat-members/${memberId}`, {
      method: 'DELETE',
    });
    return response.data;
  }

  // Chat Join Requests
  async createChatJoinRequest(projectId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${projectId}/chat-join-request`, {
      method: 'POST',
    });
    return response.data;
  }

  async getChatJoinRequests(projectId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/projects/${projectId}/chat-join-requests`, {
      method: 'GET',
    });
    return response.data;
  }

  async approveChatJoinRequest(projectId: string, requestId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(
      `/projects/${projectId}/chat-join-requests/${requestId}/approve`,
      { method: 'POST' }
    );
    return response.data;
  }

  async rejectChatJoinRequest(projectId: string, requestId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(
      `/projects/${projectId}/chat-join-requests/${requestId}/reject`,
      { method: 'POST' }
    );
    return response.data;
  }

  async getChatAccessStatus(projectId: string): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/projects/${projectId}/chat-access-status`, {
      method: 'GET',
    });
    return response.data;
  }

  async addSharedProjectFeedback(data: {
    version_id: string;
    comment_text: string;
    share_token: string;
    timestamp_seconds?: number;
  }): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/shared-project-feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  // Transaction Operations
  async getTransactions(filters?: any): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>('/transactions', {
      method: 'GET',
    });
    return response.data || [];
  }

  async createTransaction(data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async updateTransaction(id: string, data: any): Promise<any> {
    const response = await this.request<ApiResponse<any>>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.request(`/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getPaymentHistory(invoiceId: string): Promise<any[]> {
    const response = await this.request<ApiResponse<any[]>>(`/invoices/${invoiceId}/payment-history`, {
      method: 'GET',
    });
    return response.data || [];
  }

  // WebSocket Connection
  connectWebSocket(): void {
    // WebSocket connection is handled by the WebSocketClient
    // This method is here for compatibility
  }

  // Utility Methods
  async verifyToken(): Promise<boolean> {
    try {
      if (!this.authToken || this.isTokenExpired()) {
        return false;
      }

      // Test the token with a simple API call
      await this.getCurrentUser();
      return true;
    } catch (error) {
      console.log('🔧 ApiClient: Token verification failed');
      return false;
    }
  }

  isAuthenticated(): boolean {
    return this.authState === 'authenticated' && !!this.authToken && !this.isTokenExpired();
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  setAuthToken(token: string): void {
    this.isClearing = false; // Reset clearing flag
    this.authToken = token;
    this.authState = 'authenticated';
    localStorage.setItem('auth_token', token);
    console.log('🔧 ApiClient: Auth token set and state updated to authenticated');
  }

  clearAuthToken(): void {
    this.clearAuth();
    console.log('🔧 ApiClient: Auth token cleared manually');
  }

  getAuthState(): 'checking' | 'authenticated' | 'unauthenticated' {
    return this.authState;
  }

  isTokenExpired(token?: string): boolean {
    const tokenToCheck = token || this.authToken;
    if (!tokenToCheck) return true;

    try {
      const payload = JSON.parse(atob(tokenToCheck.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const isExpired = payload.exp < currentTime;

      if (isExpired) {
        console.log('🔧 ApiClient: Token is expired');
      }

      return isExpired;
    } catch (error) {
      console.log('🔧 ApiClient: Error parsing token, considering it expired');
      return true;
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      console.log('🔧 ApiClient: Attempting to refresh token');

      // For now, we'll just re-validate the current token
      // In a full implementation, you'd call a refresh endpoint
      if (this.authToken && !this.isTokenExpired()) {
        console.log('🔧 ApiClient: Token is still valid, no refresh needed');
        return true;
      }

      // Token is expired or missing
      console.log('🔧 ApiClient: Token is expired or missing, user needs to login again');
      this.clearAuth();
      return false;
    } catch (error) {
      console.error('🔧 ApiClient: Token refresh failed:', error);
      this.clearAuth();
      return false;
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };