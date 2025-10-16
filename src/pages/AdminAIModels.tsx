/**
 * Admin AI Models Management Page
 * Manage AI models and API keys for XrozenAI
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Brain, Plus, Trash2, Key, CheckCircle, XCircle, AlertCircle, Settings, ArrowUp, ArrowDown, Save, GripVertical, DollarSign, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AIModel {
  id: string;
  provider: string;
  model_name: string;
  model_id: string;
  is_free: boolean;
  rate_limit_per_minute?: number;
  enabled: boolean;
  priority: number;
  created_at: string;
}

interface APIKey {
  id: string;
  provider: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
}

interface UsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  success_rate: number;
}

interface ModelUsage {
  model_id: string;
  model_name: string;
  provider: string;
  request_count: number;
  success_count: number;
  fail_count: number;
  total_tokens: number;
  estimated_cost: number;
  success_rate: number;
  avg_response_time: number;
  last_used_at: string;
}

// Available models grouped by provider
const AVAILABLE_MODELS = {
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Latest)", priority: 100, isFree: false },
    { id: "gpt-4o-mini", name: "GPT-4o Mini", priority: 90, isFree: false },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo", priority: 95, isFree: false },
    { id: "gpt-4", name: "GPT-4", priority: 92, isFree: false },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", priority: 85, isFree: false },
    { id: "gpt-3.5-turbo-16k", name: "GPT-3.5 Turbo 16K", priority: 83, isFree: false }
  ],
  gemini: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", priority: 98, isFree: false },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", priority: 95, isFree: false },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash-Lite", priority: 92, isFree: false },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", priority: 90, isFree: false },
    { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash-Lite", priority: 88, isFree: false },
    { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash Experimental", priority: 86, isFree: false },
    { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", priority: 93, isFree: false },
    { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", priority: 87, isFree: false },
    { id: "gemini-pro", name: "Gemini Pro", priority: 85, isFree: false }
  ],
  openrouter: [
    { id: "deepseek/deepseek-chat-v3.1:free", name: "DeepSeek Chat v3.1", priority: 70, isFree: true },
    { id: "qwen/qwen3-235b-a22b:free", name: "Qwen3 235B A22B", priority: 65, isFree: true },
    { id: "meta-llama/llama-3.3-8b-instruct:free", name: "Meta Llama 3.3 8B", priority: 60, isFree: true },
    { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", priority: 68, isFree: true },
    { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1", priority: 67, isFree: true },
    { id: "meta-llama/llama-4-maverick:free", name: "Meta Llama 4 Maverick", priority: 58, isFree: true },
    { id: "qwen/qwen3-14b:free", name: "Qwen3 14B", priority: 55, isFree: true },
    { id: "mistralai/mistral-small-3.2-24b-instruct:free", name: "Mistral Small 3.2", priority: 57, isFree: true },
    { id: "google/gemma-3-27b-it:free", name: "Google Gemma 3 27B", priority: 54, isFree: true },
    { id: "moonshotai/kimi-dev-72b:free", name: "MoonshotAI Kimi Dev 72B", priority: 53, isFree: true }
  ]
};

export default function AdminAIModels() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AIModel[]>([]);
  const [apiKeys, setAPIKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("openrouter");
  const [keyName, setKeyName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [editingPriority, setEditingPriority] = useState<string | null>(null);
  const [priorityValue, setPriorityValue] = useState<number>(50);
  const [savingPriorities, setSavingPriorities] = useState(false);
  const [addModelsDialogOpen, setAddModelsDialogOpen] = useState(false);
  const [selectedModelsToAdd, setSelectedModelsToAdd] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyName, setEditKeyName] = useState("");
  const [editKeyValue, setEditKeyValue] = useState("");
  const [activeTab, setActiveTab] = useState<"api-keys" | "models" | "usage" | "info">("api-keys");
  
  // Usage & Cost tracking state
  const [usageStats, setUsageStats] = useState<UsageStats>({
    total_requests: 0,
    successful_requests: 0,
    failed_requests: 0,
    total_tokens: 0,
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost: 0,
    success_rate: 0
  });
  const [modelUsageData, setModelUsageData] = useState<ModelUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  // Handler for adding selected models
  const handleAddSelectedModels = async () => {
    if (selectedModelsToAdd.length === 0) {
      toast.error("Please select at least one model to add");
      return;
    }

    try {
      let addedCount = 0;
      let errors = [];

      for (const modelId of selectedModelsToAdd) {
        // Determine provider based on model ID
        let endpoint = "";
        if (AVAILABLE_MODELS.openai.some((m) => m.id === modelId)) {
          endpoint = "/admin/ai-models/add-single-openai";
        } else if (AVAILABLE_MODELS.gemini.some((m) => m.id === modelId)) {
          endpoint = "/admin/ai-models/add-single-gemini";
        } else if (AVAILABLE_MODELS.openrouter.some((m) => m.id === modelId)) {
          endpoint = "/admin/ai-models/add-single-openrouter";
        }

        if (endpoint) {
          try {
            const baseURL = 'http://localhost:3001/api';
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${baseURL}${endpoint}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ modelId })
            });
            const result = await response.json();
            if (response.ok) {
              addedCount++;
            } else {
              errors.push(`${modelId}: ${result.error || 'Failed'}`);
            }
          } catch (error: any) {
            errors.push(`${modelId}: ${error.message}`);
          }
        }
      }

      setAddModelsDialogOpen(false);
      setSelectedModelsToAdd([]);
      loadData();

      if (addedCount > 0) {
        toast.success(`Successfully added ${addedCount} model(s)`);
      }
      if (errors.length > 0) {
        toast.error(`Failed to add ${errors.length} model(s)`);
      }
    } catch (error) {
      toast.error("Error adding models");
    }
  };

  useEffect(() => {
    checkAdminAuth();
    loadData();
  }, []);

  // Load usage data when switching to usage tab
  useEffect(() => {
    if (activeTab === "usage") {
      loadUsageData();
    }
  }, [activeTab]);

  const checkAdminAuth = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }
      
      // Check both user_category and userCategory for compatibility
      const isAdmin = user.user_category === 'admin' || 
                     user.userCategory === 'admin' || 
                     user.user_category === 'agency' || 
                     user.userCategory === 'agency';
      
      if (!isAdmin) {
        navigate("/auth");
        return;
      }
    } catch (error) {
      console.error('Admin auth check failed:', error);
      navigate("/auth");
    }
  };

  const loadData = async () => {
    try {
      // Load AI models and API keys using proper API endpoints
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        toast.error("Authentication required");
        navigate("/auth");
        return;
      }
      
      const [modelsData, keysData] = await Promise.all([
        fetch(`${baseURL}/admin/ai-models`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`Models API failed: ${r.status}`);
          }
          return r.json();
        }),
        fetch(`${baseURL}/admin/ai-keys`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(async r => {
          if (!r.ok) {
            throw new Error(`Keys API failed: ${r.status}`);
          }
          return r.json();
        })
      ]);
      
      setModels(modelsData.data || []);
      setAPIKeys(keysData.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load AI models: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageData = async () => {
    try {
      setUsageLoading(true);
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        return;
      }

      // Fetch usage statistics
      const [statsResponse, modelUsageResponse] = await Promise.all([
        fetch(`${baseURL}/admin/ai-usage/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${baseURL}/admin/ai-usage/by-model`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setUsageStats(statsData.data || usageStats);
      }

      if (modelUsageResponse.ok) {
        const modelData = await modelUsageResponse.json();
        setModelUsageData(modelData.data || []);
      }
    } catch (error) {
      console.error("Error loading usage data:", error);
      // Don't show error toast, just log it
    } finally {
      setUsageLoading(false);
    }
  };

  const handleAddFreeModels = async () => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${baseURL}/admin/ai-models/add-openrouter-free`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      toast.success(result.message || "Added free OpenRouter models successfully");
      loadData();
    } catch (error) {
      console.error("Error adding free models:", error);
      toast.error("Failed to add free models");
    }
  };

  const handleAddOpenAIModels = async () => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${baseURL}/admin/ai-models/add-openai`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMsg = typeof result.error === 'string' 
          ? result.error 
          : result.error?.message || "Failed to add OpenAI models";
        toast.error(errorMsg);
        return;
      }
      
      const successMsg = typeof result.data?.message === 'string'
        ? result.data.message
        : `Added ${result.data?.added || 0} OpenAI models successfully`;
      toast.success(successMsg);
      loadData();
    } catch (error: any) {
      console.error("Error adding OpenAI models:", error);
      toast.error("Failed to add OpenAI models. Make sure you've added an OpenAI API key first.");
    }
  };

  const handleAddGeminiModels = async () => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${baseURL}/admin/ai-models/add-gemini`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        const errorMsg = typeof result.error === 'string' 
          ? result.error 
          : result.error?.message || "Failed to add Gemini models";
        toast.error(errorMsg);
        return;
      }
      
      const successMsg = typeof result.data?.message === 'string'
        ? result.data.message
        : `Added ${result.data?.added || 0} Gemini models successfully`;
      toast.success(successMsg);
      loadData();
    } catch (error: any) {
      console.error("Error adding Gemini models:", error);
      toast.error("Failed to add Gemini models. Make sure you've added a Gemini API key first.");
    }
  };

  const handleAddAPIKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!keyName.trim() || !apiKey.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${baseURL}/admin/ai-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: selectedProvider,
          key_name: keyName,
          api_key: apiKey
        })
      });

      await response.json();
      toast.success("API key added successfully");
      setKeyDialogOpen(false);
      setKeyName("");
      setApiKey("");
      loadData();
    } catch (error) {
      console.error("Error adding API key:", error);
      toast.error("Failed to add API key");
    }
  };

  const handleToggleModel = async (modelId: string, enabled: boolean) => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      
      console.log('Toggling model:', modelId, 'to enabled:', enabled);
      
      const response = await fetch(`${baseURL}/admin/ai-models/${modelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      });

      console.log('Toggle response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Toggle error:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('Toggle success:', result);
      
      setModels(models.map(m => m.id === modelId ? { ...m, enabled } : m));
      toast.success(enabled ? "Model enabled" : "Model disabled");
    } catch (error) {
      console.error("Error toggling model:", error);
      toast.error(`Failed to update model: ${error.message}`);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      await fetch(`${baseURL}/admin/ai-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setAPIKeys(apiKeys.filter(k => k.id !== keyId));
      toast.success("API key deleted");
    } catch (error) {
      console.error("Error deleting key:", error);
      toast.error("Failed to delete API key");
    }
  };

  const handleUpdatePriority = async (modelId: string, newPriority: number) => {
    try {
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${baseURL}/admin/ai-models/${modelId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ priority: newPriority })
      });

      if (!response.ok) {
        throw new Error('Failed to update priority');
      }

      setModels(models.map(m => m.id === modelId ? { ...m, priority: newPriority } : m));
      setEditingPriority(null);
      toast.success("Priority updated successfully");
    } catch (error) {
      console.error("Error updating priority:", error);
      toast.error("Failed to update priority");
    }
  };

  const handleMovePriority = async (modelId: string, direction: 'up' | 'down') => {
    const model = models.find(m => m.id === modelId);
    if (!model) return;

    const newPriority = direction === 'up' ? model.priority + 10 : Math.max(1, model.priority - 10);
    await handleUpdatePriority(modelId, newPriority);
  };

  const handleBulkReorderByPriority = async () => {
    try {
      setSavingPriorities(true);
      const baseURL = 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      // Sort models by current priority
      const sortedModels = [...models].sort((a, b) => b.priority - a.priority);
      
      // Reassign priorities from 100 down
      const updates = sortedModels.map((model, index) => ({
        id: model.id,
        priority: 100 - (index * 5)
      }));

      const response = await fetch(`${baseURL}/admin/ai-models/bulk-priority`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ updates })
      });

      if (!response.ok) {
        throw new Error('Failed to update priorities');
      }

      await loadData();
      toast.success("Priorities reorganized successfully");
    } catch (error) {
      console.error("Error reorganizing priorities:", error);
      toast.error("Failed to reorganize priorities");
    } finally {
      setSavingPriorities(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AdminSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            {/* Title Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                    <Brain className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">AI Models Management</h1>
                    <p className="text-sm text-muted-foreground">Configure AI models and API keys for XrozenAI</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center px-6 overflow-x-auto">
              <Button
                variant={activeTab === "api-keys" ? "default" : "ghost"}
                onClick={() => setActiveTab("api-keys")}
                className={cn(
                  "rounded-none border-b-2 py-6 px-6",
                  activeTab === "api-keys" ? "border-primary" : "border-transparent"
                )}
              >
                <Key className="w-4 h-4 mr-2" />
                API Keys
              </Button>
              <Button
                variant={activeTab === "models" ? "default" : "ghost"}
                onClick={() => setActiveTab("models")}
                className={cn(
                  "rounded-none border-b-2 py-6 px-6",
                  activeTab === "models" ? "border-primary" : "border-transparent"
                )}
              >
                <Brain className="w-4 h-4 mr-2" />
                AI Models
              </Button>
              <Button
                variant={activeTab === "usage" ? "default" : "ghost"}
                onClick={() => setActiveTab("usage")}
                className={cn(
                  "rounded-none border-b-2 py-6 px-6",
                  activeTab === "usage" ? "border-primary" : "border-transparent"
                )}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Usage & Cost
              </Button>
              <Button
                variant={activeTab === "info" ? "default" : "ghost"}
                onClick={() => setActiveTab("info")}
                className={cn(
                  "rounded-none border-b-2 py-6 px-6",
                  activeTab === "info" ? "border-primary" : "border-transparent"
                )}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Documentation
              </Button>
            </div>
          </header>

          <main className="px-8 py-8 space-y-8">
            {/* API Keys Tab */}
            {activeTab === "api-keys" && (
              <>
                {/* Action Buttons for API Keys */}
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">API Keys</h2>
                    <p className="text-sm text-muted-foreground">Manage API keys for different AI providers</p>
                  </div>
                  <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gradient-primary">
                        <Key className="w-4 h-4 mr-2" />
                        Add API Key
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add API Key</DialogTitle>
                        <DialogDescription>
                          Add an API key for AI model providers
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddAPIKey} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Provider</Label>
                          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="openrouter">OpenRouter</SelectItem>
                              <SelectItem value="openai">OpenAI</SelectItem>
                              <SelectItem value="gemini">Google Gemini</SelectItem>
                              <SelectItem value="google">Google AI</SelectItem>
                              <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Key Name</Label>
                          <Input
                            placeholder="e.g., OpenRouter Production"
                            value={keyName}
                            onChange={(e) => setKeyName(e.target.value)}
                            required
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>API Key</Label>
                          <Input
                            type="password"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            required
                          />
                        </div>
                        
                        <Button type="submit" className="w-full gradient-primary">
                          Add API Key
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Manage API keys for different AI providers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No API keys configured</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Key className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{key.key_name}</p>
                            <p className="text-sm text-muted-foreground">{key.provider}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <Badge variant={key.is_active ? "default" : "secondary"}>
                            {key.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the API key "{key.key_name}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteKey(key.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            )}

            {/* AI Models Tab */}
            {activeTab === "models" && (
              <>
                {/* Action Buttons for Models */}
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">AI Models</h2>
                    <p className="text-sm text-muted-foreground">Configure which AI models are available ({models.length} total)</p>
                  </div>
                  <Dialog open={addModelsDialogOpen} onOpenChange={setAddModelsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="gradient-primary">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Models
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <DialogTitle>Add AI Models</DialogTitle>
                            <DialogDescription>
                              Select models from different providers to add to your system (25 models available)
                            </DialogDescription>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allIds = [
                                ...AVAILABLE_MODELS.openai.map(m => m.id),
                                ...AVAILABLE_MODELS.gemini.map(m => m.id),
                                ...AVAILABLE_MODELS.openrouter.map(m => m.id)
                              ];
                              if (selectedModelsToAdd.length === allIds.length) {
                                setSelectedModelsToAdd([]);
                              } else {
                                setSelectedModelsToAdd(allIds);
                              }
                            }}
                          >
                            {selectedModelsToAdd.length === 25 ? 'Deselect All' : 'Select All 25'}
                          </Button>
                        </div>
                      </DialogHeader>
                      
                      {/* Provider Tabs */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="space-y-6">
                          {/* OpenAI Models */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Brain className="w-5 h-5 text-blue-500" />
                                OpenAI Models (6)
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const openaiIds = AVAILABLE_MODELS.openai.map(m => m.id);
                                  const allSelected = openaiIds.every(id => selectedModelsToAdd.includes(id));
                                  if (allSelected) {
                                    setSelectedModelsToAdd(selectedModelsToAdd.filter(id => !openaiIds.includes(id)));
                                  } else {
                                    setSelectedModelsToAdd([...new Set([...selectedModelsToAdd, ...openaiIds])]);
                                  }
                                }}
                              >
                                {AVAILABLE_MODELS.openai.every(m => selectedModelsToAdd.includes(m.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                            <div className="space-y-2 pl-7">
                              {AVAILABLE_MODELS.openai.map((model) => (
                                <label
                                  key={model.id}
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedModelsToAdd.includes(model.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModelsToAdd([...selectedModelsToAdd, model.id]);
                                      } else {
                                        setSelectedModelsToAdd(selectedModelsToAdd.filter((id) => id !== model.id));
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{model.name}</p>
                                    <p className="text-xs text-muted-foreground">Priority: {model.priority}</p>
                                  </div>
                                  <Badge variant="outline">OpenAI</Badge>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* Gemini Models */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Brain className="w-5 h-5 text-purple-500" />
                                Google Gemini Models (9)
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const geminiIds = AVAILABLE_MODELS.gemini.map(m => m.id);
                                  const allSelected = geminiIds.every(id => selectedModelsToAdd.includes(id));
                                  if (allSelected) {
                                    setSelectedModelsToAdd(selectedModelsToAdd.filter(id => !geminiIds.includes(id)));
                                  } else {
                                    setSelectedModelsToAdd([...new Set([...selectedModelsToAdd, ...geminiIds])]);
                                  }
                                }}
                              >
                                {AVAILABLE_MODELS.gemini.every(m => selectedModelsToAdd.includes(m.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                            <div className="space-y-2 pl-7">
                              {AVAILABLE_MODELS.gemini.map((model) => (
                                <label
                                  key={model.id}
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedModelsToAdd.includes(model.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModelsToAdd([...selectedModelsToAdd, model.id]);
                                      } else {
                                        setSelectedModelsToAdd(selectedModelsToAdd.filter((id) => id !== model.id));
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{model.name}</p>
                                    <p className="text-xs text-muted-foreground">Priority: {model.priority}</p>
                                  </div>
                                  <Badge variant="outline">Gemini</Badge>
                                </label>
                              ))}
                            </div>
                          </div>

                          {/* OpenRouter Free Models */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-lg flex items-center gap-2">
                                <Brain className="w-5 h-5 text-green-500" />
                                OpenRouter Free Models (10)
                              </h3>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const openrouterIds = AVAILABLE_MODELS.openrouter.map(m => m.id);
                                  const allSelected = openrouterIds.every(id => selectedModelsToAdd.includes(id));
                                  if (allSelected) {
                                    setSelectedModelsToAdd(selectedModelsToAdd.filter(id => !openrouterIds.includes(id)));
                                  } else {
                                    setSelectedModelsToAdd([...new Set([...selectedModelsToAdd, ...openrouterIds])]);
                                  }
                                }}
                              >
                                {AVAILABLE_MODELS.openrouter.every(m => selectedModelsToAdd.includes(m.id)) ? 'Deselect All' : 'Select All'}
                              </Button>
                            </div>
                            <div className="space-y-2 pl-7">
                              {AVAILABLE_MODELS.openrouter.map((model) => (
                                <label
                                  key={model.id}
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedModelsToAdd.includes(model.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedModelsToAdd([...selectedModelsToAdd, model.id]);
                                      } else {
                                        setSelectedModelsToAdd(selectedModelsToAdd.filter((id) => id !== model.id));
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium">{model.name}</p>
                                    <p className="text-xs text-muted-foreground">Priority: {model.priority}</p>
                                  </div>
                                  <Badge className="bg-green-500">Free</Badge>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer with Action Buttons */}
                      <div className="border-t pt-4 mt-4 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {selectedModelsToAdd.length} model(s) selected
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setAddModelsDialogOpen(false);
                              setSelectedModelsToAdd([]);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleAddSelectedModels}
                            disabled={selectedModelsToAdd.length === 0}
                            className="gradient-primary"
                          >
                            Add {selectedModelsToAdd.length > 0 && `(${selectedModelsToAdd.length})`} Models
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Available AI Models</CardTitle>
                    <CardDescription>
                      Configure which AI models are available for XrozenAI ({models.length} models) - Higher priority = Used first
                    </CardDescription>
                  </div>
                  {models.length > 0 && (
                    <Button
                      onClick={handleBulkReorderByPriority}
                      disabled={savingPriorities}
                      variant="outline"
                      size="sm"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingPriorities ? "Saving..." : "Reorganize Priorities"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {models.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No AI models configured</p>
                    <Button onClick={handleAddFreeModels} className="mt-4" variant="outline">
                      Add Free OpenRouter Models
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...models]
                      .sort((a, b) => b.priority - a.priority)
                      .map((model, index) => (
                      <div 
                        key={model.id} 
                        className={cn(
                          "p-4 border rounded-lg transition-all",
                          model.enabled ? "bg-card" : "bg-muted/30 opacity-60"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Priority Badge and Controls */}
                          <div className="flex flex-col items-center gap-2 min-w-[80px]">
                            <Badge 
                              variant={model.priority >= 80 ? "default" : model.priority >= 50 ? "secondary" : "outline"}
                              className="text-lg font-bold px-3 py-1"
                            >
                              #{index + 1}
                            </Badge>
                            
                            {editingPriority === model.id ? (
                              <div className="flex flex-col gap-1 w-full">
                                <Input
                                  type="number"
                                  value={priorityValue}
                                  onChange={(e) => setPriorityValue(parseInt(e.target.value) || 0)}
                                  className="h-8 text-center"
                                  min="1"
                                  max="100"
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 text-xs flex-1"
                                    onClick={() => handleUpdatePriority(model.id, priorityValue)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs flex-1"
                                    onClick={() => setEditingPriority(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-mono text-muted-foreground">
                                  P: {model.priority}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleMovePriority(model.id, 'up')}
                                    title="Increase Priority"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleMovePriority(model.id, 'down')}
                                    title="Decrease Priority"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setEditingPriority(model.id);
                                    setPriorityValue(model.priority);
                                  }}
                                >
                                  Edit
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Model Info */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  <p className="font-medium">{model.model_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground font-mono break-all">
                                  {model.model_id}
                                </p>
                              </div>
                              
                              <Button
                                variant={model.enabled ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleToggleModel(model.id, !model.enabled)}
                                className="shrink-0"
                              >
                                {model.enabled ? (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Enabled
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Disabled
                                  </>
                                )}
                              </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{model.provider}</Badge>
                              {model.is_free && <Badge className="bg-green-500">Free</Badge>}
                              {model.rate_limit_per_minute && (
                                <Badge variant="secondary">
                                  Limit: {model.rate_limit_per_minute}/min
                                </Badge>
                              )}
                              <Badge variant={model.priority >= 80 ? "default" : "secondary"}>
                                Priority: {model.priority >= 80 ? "High" : model.priority >= 50 ? "Medium" : "Low"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            )}

            {/* Usage & Cost Tab */}
            {activeTab === "usage" && (
              <>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Usage & Cost Analytics</h2>
                    <p className="text-sm text-muted-foreground">Track AI model usage and costs</p>
                  </div>
                  <Button 
                    onClick={loadUsageData} 
                    variant="outline" 
                    size="sm"
                    disabled={usageLoading}
                  >
                    {usageLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>

                {/* Summary Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-500" />
                        Total Requests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{usageStats.total_requests.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {usageStats.successful_requests} success, {usageStats.failed_requests} failed
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        Success Rate
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn(
                        "text-2xl font-bold",
                        usageStats.success_rate >= 90 ? "text-green-500" :
                        usageStats.success_rate >= 70 ? "text-yellow-500" : "text-red-500"
                      )}>
                        {usageStats.success_rate.toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Brain className="w-4 h-4 text-purple-500" />
                        Total Tokens
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{usageStats.total_tokens.toLocaleString()}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        In: {usageStats.input_tokens.toLocaleString()} | Out: {usageStats.output_tokens.toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        Estimated Cost
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">₹{usageStats.estimated_cost.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Per-Model Usage Table */}
                <Card className="mt-6 shadow-elegant">
                  <CardHeader>
                    <CardTitle>Usage by Model</CardTitle>
                    <CardDescription>
                      Detailed usage statistics for each AI model
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {usageLoading ? (
                      <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                        <p className="text-sm text-muted-foreground mt-4">Loading usage data...</p>
                      </div>
                    ) : modelUsageData.length === 0 ? (
                      <div className="text-center py-12">
                        <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">
                          No usage data available yet
                        </p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Usage will be tracked once you start using AI models
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 font-medium">Model</th>
                              <th className="text-right p-3 font-medium">Requests</th>
                              <th className="text-right p-3 font-medium">Success Rate</th>
                              <th className="text-right p-3 font-medium">Tokens</th>
                              <th className="text-right p-3 font-medium">Avg Time</th>
                              <th className="text-right p-3 font-medium">Cost</th>
                              <th className="text-left p-3 font-medium">Last Used</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modelUsageData.map((usage) => (
                              <tr key={usage.model_id} className="border-b hover:bg-accent/50">
                                <td className="p-3">
                                  <div>
                                    <p className="font-medium">{usage.model_name}</p>
                                    <p className="text-xs text-muted-foreground">{usage.provider}</p>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div>
                                    <p className="font-medium">{usage.request_count}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {usage.success_count}✓ {usage.fail_count}✗
                                    </p>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <Badge variant={
                                    usage.success_rate >= 90 ? "default" :
                                    usage.success_rate >= 70 ? "secondary" : "destructive"
                                  }>
                                    {usage.success_rate.toFixed(0)}%
                                  </Badge>
                                </td>
                                <td className="p-3 text-right font-mono text-sm">
                                  {usage.total_tokens.toLocaleString()}
                                </td>
                                <td className="p-3 text-right text-sm">
                                  {usage.avg_response_time ? `${usage.avg_response_time.toFixed(0)}ms` : '-'}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  ₹{usage.estimated_cost.toFixed(2)}
                                </td>
                                <td className="p-3 text-sm text-muted-foreground">
                                  {usage.last_used_at ? new Date(usage.last_used_at).toLocaleDateString() : 'Never'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Cost Breakdown Card */}
                {modelUsageData.length > 0 && (
                  <Card className="mt-6 shadow-elegant bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader>
                      <CardTitle>Cost Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Free Models Usage</p>
                            <p className="text-2xl font-bold text-green-500">
                              {modelUsageData.filter(m => m.estimated_cost === 0).reduce((sum, m) => sum + m.request_count, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">requests</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Paid Models Usage</p>
                            <p className="text-2xl font-bold text-blue-500">
                              {modelUsageData.filter(m => m.estimated_cost > 0).reduce((sum, m) => sum + m.request_count, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">requests</p>
                          </div>
                        </div>
                        <div className="pt-4 border-t">
                          <p className="text-sm text-muted-foreground mb-2">💡 Cost Saving Tips:</p>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Use free OpenRouter models for testing and development</li>
                            <li>• Set higher priority for free models to save costs</li>
                            <li>• Monitor success rates to identify and disable failing models</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Documentation Tab */}
            {activeTab === "info" && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold">Documentation</h2>
                  <p className="text-sm text-muted-foreground">Learn about the AI management system</p>
                </div>

                <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      Priority System & Automatic Fallback
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>🎯 Priority System:</strong> Models are used in order of priority (highest to lowest). Set priority 1-100 where higher numbers = higher priority.
                    </p>
                    <p>
                      <strong>🔄 Automatic Fallback:</strong> If a model fails (rate limit, timeout, error), the system automatically tries the next highest priority model. This ensures continuous service.
                    </p>
                    <p>
                      <strong>⚡ Smart Selection:</strong> Among models with the same priority, one is randomly selected to distribute load. Disabled models are never used.
                    </p>
                    <p>
                      <strong>📊 Recommended Priority Setup:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>Premium Models (GPT-4o, Claude, Gemini Pro): Priority 90-100</li>
                      <li>Standard Models (GPT-3.5, Gemini Flash): Priority 70-89</li>
                      <li>Free Models (OpenRouter): Priority 40-69</li>
                      <li>Fallback Models: Priority 1-39</li>
                    </ul>
                    <p className="mt-3">
                      <strong>🔑 How to Add Models:</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>First, add your API key (OpenAI, Gemini, etc.)</li>
                      <li>Then click "Add OpenAI Models" or "Add Gemini Models"</li>
                      <li>Models will be automatically added with recommended priorities</li>
                      <li>Adjust priorities as needed for your use case</li>
                    </ol>
                    <p>
                      <strong>💡 Pro Tip:</strong> Keep at least 2-3 free models enabled as fallback to ensure your system never runs out of options.
                    </p>
                    <p>
                      <strong>📈 Monitoring:</strong> All AI requests are logged with success/failure status and which model was used for debugging and optimization.
                    </p>
                  </CardContent>
                </Card>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>API Key Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>🔑 Adding API Keys:</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-1 ml-4">
                      <li>Go to the "API Keys" tab</li>
                      <li>Click "Add API Key"</li>
                      <li>Select the provider (OpenAI, Gemini, OpenRouter, etc.)</li>
                      <li>Enter a descriptive name for the key</li>
                      <li>Paste your API key</li>
                    </ol>
                    <p className="mt-3">
                      <strong>🔄 Key Rotation:</strong> The system automatically rotates between multiple keys of the same provider for load balancing. Keys that hit rate limits are temporarily deactivated and auto-recover after 5 minutes.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
