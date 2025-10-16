import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Plus, Trash2, MessageSquare, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export default function XrozenAI() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      // Wait for auth context to initialize
      if (authLoading) {
        console.log('🔧 XrozenAI: Auth context still loading, waiting...');
        return;
      }
      
      // Check if user is authenticated through context
      if (!isAuthenticated || !apiClient.isAuthenticated()) {
        console.log('🔧 XrozenAI: Not authenticated, redirecting to auth');
        navigate('/auth');
        return;
      }
      
      console.log('🔧 XrozenAI: User authenticated, loading conversations');
      loadConversations();
    };
    
    checkAuth();
  }, [navigate, isAuthenticated, authLoading]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Load conversations
  const loadConversations = async () => {
    if (!apiClient.isAuthenticated()) {
      console.log('🔧 XrozenAI: Not authenticated, skipping conversation load');
      setLoadingConversations(false);
      return;
    }
    
    try {
      console.log('🔧 XrozenAI: Loading conversations...');
      const data = await apiClient.getAIConversations();

      console.log('🔧 XrozenAI: Conversations received:', data?.length || 0);
      setConversations(data || []);
      
      // Auto-select most recent conversation only on first load
      if (data && data.length > 0 && !selectedConversation) {
        const firstConv = data[0];
        console.log('🔧 XrozenAI: Auto-selecting first conversation:', firstConv.id);
        setSelectedConversation(firstConv.id);
        await loadMessages(firstConv.id);
      }
      console.log('🔧 XrozenAI: Conversations loaded successfully');
    } catch (error) {
      console.error('🔧 XrozenAI: Error loading conversations:', error);
      // Don't redirect to auth for AI-specific endpoints - they might not be available
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        console.log('🔧 XrozenAI: AI endpoint not available, but keeping user logged in');
        // Just show empty state instead of redirecting to auth
        setConversations([]);
      }
    } finally {
      setLoadingConversations(false);
    }
  };

  // Load messages for a conversation
  const loadMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      console.log('🔧 XrozenAI: Loading messages for conversation:', conversationId);
      
      // Skip loading for temporary conversations
      if (conversationId.startsWith('temp_')) {
        console.log('🔧 XrozenAI: Temporary conversation, skipping message load');
        setMessages([]);
        return;
      }
      
      // Fetch messages from API
      const msgs = await apiClient.getAIMessages(conversationId);
      console.log('🔧 XrozenAI: Messages loaded:', msgs?.length || 0);
      
      if (msgs && Array.isArray(msgs)) {
        setMessages(msgs.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          created_at: m.created_at
        })));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('🔧 XrozenAI: Error loading messages:', error);
      setMessages([]);
      toast({
        title: "Error",
        description: "Failed to load conversation messages",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Create new conversation
  const createNewConversation = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      // Create a temporary conversation ID for new chats
      // The actual conversation will be created when the first message is sent
      const tempId = `temp_${Date.now()}`;
      const newConversation = {
        id: tempId,
        title: 'New Conversation',
        updated_at: new Date().toISOString()
      };

      setConversations(prev => [newConversation, ...prev]);
      setSelectedConversation(newConversation.id);
      setMessages([]);
      setInput('');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new conversation",
        variant: "destructive"
      });
    }
  };

  // Delete conversation
  const deleteConversation = async (conversationId: string) => {
    try {
      // For now, just remove from local state
      // The API doesn't have a deleteAIConversation method yet
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  };

  // Send message - auto-create conversation if needed
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const tempId = `temp-${Date.now()}`;
    
    setInput('');
    setLoading(true);
    
    // Add user message immediately
    setMessages(prev => [...prev, {
      id: tempId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    try {
      console.log('🔧 XrozenAI: Sending message to conversation:', selectedConversation);
      
      // Pass conversation ID only if it's not temporary
      const convIdToSend = selectedConversation?.startsWith('temp_') ? undefined : selectedConversation || undefined;
      
      const response = await apiClient.chatWithAI(
        userMessage,
        convIdToSend,
        messages.filter(m => m.id !== tempId) // Send existing messages for context
      );
      
      console.log('🔧 XrozenAI: Response received:', response);
      
      // Update conversation ID if new conversation was created
      if (response.conversationId) {
        const newConvId = response.conversationId;
        
        // If we had a temp conversation or no conversation, update to the new one
        if (!selectedConversation || selectedConversation.startsWith('temp_')) {
          console.log('🔧 XrozenAI: New conversation created:', newConvId);
          setSelectedConversation(newConvId);
          
          // Update the conversation list to replace temp with real conversation
          setConversations(prev => {
            // Remove temp conversation if exists
            const filtered = prev.filter(c => !c.id.startsWith('temp_'));
            
            // Check if conversation already exists
            const exists = filtered.find(c => c.id === newConvId);
            
            if (exists) {
              // Update existing conversation
              return filtered.map(c => 
                c.id === newConvId 
                  ? { ...c, title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''), updated_at: new Date().toISOString() }
                  : c
              );
            } else {
              // Add new conversation at the top
              return [{
                id: newConvId,
                title: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : ''),
                updated_at: new Date().toISOString()
              }, ...filtered];
            }
          });
        } else {
          // Update existing conversation's timestamp
          setConversations(prev => prev.map(c => 
            c.id === newConvId 
              ? { ...c, updated_at: new Date().toISOString() }
              : c
          ));
        }
      }

      // Parse action data from response
      let responseContent = response.response || response.message || 'No response received';
      const actionMatch = responseContent.match(/__ACTION_DATA__(.+?)__ACTION_DATA__/);
      if (actionMatch) {
        responseContent = responseContent.replace(/__ACTION_DATA__.+?__ACTION_DATA__/, '').trim();
      }

      // Replace temp message with actual message
      setMessages(prev => prev.map(m => 
        m.id === tempId 
          ? { ...m, id: `user-${Date.now()}` }
          : m
      ).concat({
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: responseContent,
        created_at: new Date().toISOString()
      }));

    } catch (error: any) {
      console.error('🔧 XrozenAI: Error sending message:', error);
      
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background overflow-hidden">
        <AppSidebar />
        
        <main className="flex-1 flex flex-col h-screen overflow-hidden w-full max-w-full relative">
          {/* Fixed Header */}
          <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm fixed top-0 right-0 left-0 z-50 w-full">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full max-w-full">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">XrozenAI</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Your intelligent workflow assistant</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                {/* History Button */}
                <Sheet open={showHistory} onOpenChange={setShowHistory}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3">
                      <History className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">Chat History</span>
                      <span className="sm:hidden">History</span>
                    </Button>
                  </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] lg:w-[380px] p-0 overflow-hidden flex flex-col">
                <SheetHeader className="px-4 py-4 sm:px-6 sm:py-5 border-b bg-card/50">
                  <SheetTitle className="text-base sm:text-lg font-bold">Conversation History</SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-hidden flex flex-col px-4 sm:px-6 py-4">
                  <Button 
                    onClick={() => {
                      createNewConversation();
                      setShowHistory(false);
                    }} 
                    className="w-full gap-2 mb-4 h-9 sm:h-10 text-xs sm:text-sm"
                    size="sm"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                    New Conversation
                  </Button>

                  <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="space-y-1 sm:space-y-2 pb-4">
                      {loadingConversations ? (
                        <div className="p-4 text-center text-muted-foreground text-xs sm:text-sm">
                          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mx-auto mb-2" />
                          Loading...
                        </div>
                      ) : conversations.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 opacity-50" />
                          <p className="text-xs sm:text-sm">No conversations yet</p>
                          <p className="text-[10px] sm:text-xs mt-1 opacity-70">Start a new chat to begin</p>
                        </div>
                      ) : (
                        conversations.map((conv) => (
                          <div
                            key={conv.id}
                            className={cn(
                              "group flex items-center gap-2 p-2 sm:p-3 rounded-lg cursor-pointer transition-all duration-200",
                              selectedConversation === conv.id
                                ? "bg-primary/10 border border-primary/20 shadow-sm"
                                : "hover:bg-muted hover:shadow-sm"
                            )}
                            onClick={async () => {
                              console.log('🔧 XrozenAI: Conversation clicked:', conv.id);
                              setSelectedConversation(conv.id);
                              setShowHistory(false);
                              // Load messages after closing the sheet
                              await loadMessages(conv.id);
                            }}
                          >
                            <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <p className="text-xs sm:text-sm font-medium truncate">{conv.title}</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                {new Date(conv.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 sm:h-7 sm:w-7 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conv.id);
                              }}
                              title="Delete conversation"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </SheetContent>
            </Sheet>
                
                <Button 
                  onClick={createNewConversation} 
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                >
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">New Conversation</span>
                  <span className="sm:hidden">New</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Chat messages area - scrollable with padding for fixed header and input */}
          <div className="flex-1 overflow-y-auto w-full max-w-full overflow-x-hidden pt-[64px] sm:pt-[72px] pb-[150px] sm:pb-[160px] lg:pb-[170px]" ref={scrollRef}>
            <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {messages.length === 0 ? (
                <div className="min-h-[calc(100vh-280px)] flex items-center justify-center">
                  <div className="text-center py-8 sm:py-12 px-4 w-full">
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 sm:mb-6">
                      <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />
                    </div>
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-2 sm:mb-3">Welcome to XrozenAI</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-6 sm:mb-8 max-w-md mx-auto break-words">
                      Your intelligent assistant for managing projects, clients, and workflow
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 sm:p-6 max-w-2xl mx-auto text-left">
                      <p className="text-sm sm:text-base font-medium mb-3 sm:mb-4">Try asking:</p>
                      <div className="grid gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-md hover:bg-accent/50 transition-colors">
                          <div className="text-primary text-xs sm:text-sm flex-shrink-0">•</div>
                          <p className="text-xs sm:text-sm break-words">"Create a new project called Marketing Video"</p>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-md hover:bg-accent/50 transition-colors">
                          <div className="text-primary text-xs sm:text-sm flex-shrink-0">•</div>
                          <p className="text-xs sm:text-sm break-words">"Add a client named John Doe with email john@example.com"</p>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-md hover:bg-accent/50 transition-colors">
                          <div className="text-primary text-xs sm:text-sm flex-shrink-0">•</div>
                          <p className="text-xs sm:text-sm break-words">"Show me all pending projects"</p>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-md hover:bg-accent/50 transition-colors">
                          <div className="text-primary text-xs sm:text-sm flex-shrink-0">•</div>
                          <p className="text-xs sm:text-sm break-words">"List my recent payments"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full max-w-full",
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-4 shadow-sm break-words overflow-hidden",
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      )}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-xs sm:prose-sm dark:prose-invert max-w-none [&>*]:text-xs [&>*]:sm:text-sm">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap text-xs sm:text-sm break-words">{msg.content}</p>
                      )}
                      <p className="text-[10px] sm:text-xs opacity-50 mt-1 sm:mt-2">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              
              {loading && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-muted rounded-2xl px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-4 flex items-center gap-2 sm:gap-3 rounded-bl-md shadow-sm">
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-muted-foreground">XrozenAI is thinking...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Input area at bottom */}
          <div className="flex-shrink-0 border-t bg-card/50 backdrop-blur-sm w-full max-w-full overflow-hidden fixed bottom-0 right-0 left-0 z-40">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
              <div className="flex gap-2 sm:gap-3 items-end bg-muted/50 rounded-2xl p-2 sm:p-2.5 shadow-lg border border-border/40 w-full max-w-full">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask XrozenAI anything about your workflow..."
                  disabled={loading}
                  className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-[44px] sm:min-h-[52px] lg:min-h-[60px] max-h-[120px] sm:max-h-[160px] lg:max-h-[200px] resize-none text-xs sm:text-sm lg:text-base px-2 sm:px-3 lg:px-4 py-2 sm:py-3"
                  rows={1}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  size="icon"
                  className="h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0 transition-all hover:scale-105"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center px-2 sm:px-4">
                <span className="hidden sm:inline">Press Enter to send • Shift+Enter for new line</span>
                <span className="sm:hidden">Tap send or press Enter</span>
              </p>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
