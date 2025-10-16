import { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Send, Loader2, Minimize2, Maximize2, ExternalLink, Fullscreen, GripVertical, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface ActionData {
  type: 'project' | 'client' | 'editor';
  id: string;
  name: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  actionData?: ActionData;
}

interface Position {
  x: number;
  y: number;
}

export function XrozenAI() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVisible, setIsVisible] = useState(() => {
    const saved = localStorage.getItem('xrozen-ai-visible');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem('xrozen-ai-position');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 100, y: window.innerHeight - 180 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  // Save visibility state
  useEffect(() => {
    localStorage.setItem('xrozen-ai-visible', JSON.stringify(isVisible));
  }, [isVisible]);

  // Save position
  useEffect(() => {
    localStorage.setItem('xrozen-ai-position', JSON.stringify(position));
  }, [position]);

  // Listen for visibility changes from settings
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'xrozen-ai-visible' && e.newValue !== null) {
        setIsVisible(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Handle dragging - Desktop and Mobile
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!isDragging || !buttonRef.current) return;

      // Calculate distance moved
      const startPos = (buttonRef.current as any)._dragStartPos;
      if (startPos) {
        const distance = Math.sqrt(
          Math.pow(clientX - startPos.x, 2) + 
          Math.pow(clientY - startPos.y, 2)
        );
        
        // If moved more than 5 pixels, consider it a drag
        if (distance > 5) {
          (buttonRef.current as any)._hasDragged = true;
        }
      }

      const newX = clientX - dragOffset.x;
      const newY = clientY - dragOffset.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - 80;
      const maxY = window.innerHeight - 80;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  // Check authentication
  useEffect(() => {
    console.log('XrozenAI - Component mounted');
    const checkAuth = async () => {
      try {
        const user = await apiClient.getCurrentUser();
        console.log('XrozenAI - Auth check result:', { isAuthenticated: !!user });
        setIsAuthenticated(!!user);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();

    // Check auth on storage changes (when user logs in/out)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        checkAuth();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      console.log('XrozenAI - Component unmounting');
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Load conversation history - synced with XrozenAI page
  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadRecentConversation();
    }
  }, [isOpen, isAuthenticated]);

  // Realtime subscription for data changes - DISABLED to prevent WebSocket errors
  useEffect(() => {
    // Disabled realtime subscriptions to prevent WebSocket connection failures
    // This was causing the repeated connection errors in the console
    console.log('XrozenAI - Realtime subscriptions disabled to prevent WebSocket errors');
    
    return () => {
      // Cleanup function - no channels to clean up since we disabled realtime
    };
  }, []);

  const loadRecentConversation = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      const conversations = await apiClient.getAIConversations();

      if (conversations && conversations.length > 0) {
        const convId = conversations[0].id;
        setConversationId(convId);

        const msgs = await apiClient.getAIMessages(convId);

        if (msgs) {
          setMessages(msgs.map((m: any) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            created_at: m.created_at
          })));
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    }
  };

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
      console.log('XrozenAI - Sending message:', userMessage);
      
      const data = await apiClient.chatWithAI(
        userMessage,
        conversationId || undefined,
        messages.filter(m => m.id !== tempId).map(m => ({
          role: m.role,
          content: m.content
        }))
      );

      console.log('XrozenAI - Response received:', data);

      // Update conversation ID if new
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Parse action data from response
      let responseContent = data.response;
      let actionData: ActionData | undefined;
      
      // Check if action data is provided directly
      if (data.actionData) {
        actionData = data.actionData;
      } else {
        // Fallback: try to parse from response text
        const actionMatch = responseContent.match(/__ACTION_DATA__(.+?)__ACTION_DATA__/);
        if (actionMatch) {
          try {
            actionData = JSON.parse(actionMatch[1]);
            responseContent = responseContent.replace(/__ACTION_DATA__.+?__ACTION_DATA__/, '').trim();
          } catch (e) {
            console.error('Failed to parse action data:', e);
          }
        }
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
        created_at: new Date().toISOString(),
        actionData
      }));

    } catch (error: any) {
      console.error('XrozenAI - Error sending message:', error);
      
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      
      toast({
        title: "Error",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    
    // Store initial position to detect if user actually dragged
    const initialPos = { x: e.clientX, y: e.clientY };
    
    // Set a flag to track if dragging occurred
    (buttonRef.current as any)._dragStartPos = initialPos;
    (buttonRef.current as any)._hasDragged = false;
    
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!buttonRef.current || e.touches.length === 0) return;
    
    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
    
    // Store initial position to detect if user actually dragged
    const initialPos = { x: touch.clientX, y: touch.clientY };
    
    // Set a flag to track if dragging occurred
    (buttonRef.current as any)._dragStartPos = initialPos;
    (buttonRef.current as any)._hasDragged = false;
    
    setIsDragging(true);
  };

  // Don't show on auth pages or when not authenticated
  const hideOnPaths = ['/auth', '/'];
  const shouldHide = hideOnPaths.includes(location.pathname);

  // Remove excessive logging - only log once
  if (!isAuthenticated || shouldHide) {
    return null;
  }

  return (
    <>
      {/* Floating Button - Draggable (Desktop & Mobile) */}
      {!isOpen && isVisible && (
        <div
          className="fixed z-[9999] group touch-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <Button
            ref={buttonRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onClick={(e) => {
              // Only open if user didn't drag
              const hasDragged = buttonRef.current ? (buttonRef.current as any)._hasDragged : false;
              
              if (!hasDragged) {
                console.log('XrozenAI - Button clicked, opening chat');
                setIsOpen(true);
              } else {
                console.log('XrozenAI - Button was dragged, not opening');
              }
              
              // Reset drag flag
              if (buttonRef.current) {
                (buttonRef.current as any)._hasDragged = false;
              }
            }}
            className={cn(
              "h-14 w-14 sm:h-16 sm:w-16 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-all duration-300",
              !isDragging && "hover:scale-105 active:scale-95"
            )}
            size="icon"
            title="Drag to move • Click to open XrozenAI"
          >
            <div className="relative">
              <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
              <GripVertical className="h-3 w-3 text-primary-foreground/50 absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Button>
        </div>
      )}

      {/* Settings Toggle - Mobile Responsive */}
      {isVisible === false && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 h-11 w-11 sm:h-12 sm:w-12 rounded-full shadow-lg z-[9998] bg-muted hover:bg-muted/90"
              size="icon"
              title="XrozenAI Settings"
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 sm:w-72" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">XrozenAI Settings</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Control the AI assistant visibility
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="ai-visible" className="text-sm sm:text-base cursor-pointer">
                  Show AI Assistant
                </Label>
                <Switch
                  id="ai-visible"
                  checked={isVisible}
                  onCheckedChange={setIsVisible}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Chat Popup - Mobile Responsive */}
      {isOpen && (
        <Card className={cn(
          "fixed shadow-2xl z-[9999] transition-all duration-300",
          "flex flex-col bg-background border-2 border-primary/20",
          // Mobile: Full screen bottom sheet style
          "bottom-0 left-0 right-0 rounded-t-2xl sm:rounded-lg",
          // Desktop: Floating card
          "sm:bottom-6 sm:right-6 sm:left-auto",
          isMinimized 
            ? "h-16 w-full sm:w-80" 
            : "h-[85vh] sm:h-[600px] w-full sm:w-[420px] lg:w-[480px]"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-3 sm:px-4 sm:py-4 border-b bg-primary text-primary-foreground rounded-t-2xl sm:rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-accent flex items-center justify-center flex-shrink-0 shadow-glow">
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-accent-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base truncate">XrozenAI</h3>
                <p className="text-[10px] sm:text-xs opacity-80 truncate">Your Project Assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigate('/xrozen-ai');
                  setIsOpen(false);
                }}
                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary-foreground/20 text-primary-foreground hidden sm:flex"
                title="Open Full Page"
              >
                <Fullscreen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary-foreground/20 text-primary-foreground hidden sm:flex"
                    title="Settings"
                  >
                    <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">XrozenAI Settings</h4>
                      <p className="text-xs text-muted-foreground">
                        Customize your AI assistant
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ai-visible-popup" className="text-sm cursor-pointer">
                        Show AI Button
                      </Label>
                      <Switch
                        id="ai-visible-popup"
                        checked={isVisible}
                        onCheckedChange={(checked) => {
                          setIsVisible(checked);
                          if (!checked) {
                            setIsOpen(false);
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Toggle off to hide the AI assistant button. You can always access it from the sidebar.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMinimize}
                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary-foreground/20 text-primary-foreground hidden sm:flex"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  console.log('XrozenAI - Closing chat');
                  setIsOpen(false);
                }}
                className="h-7 w-7 sm:h-8 sm:w-8 hover:bg-primary-foreground/20 text-primary-foreground"
                title="Close"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 px-3 py-4 sm:p-4" ref={scrollRef}>
                <div className="space-y-3 sm:space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground py-6 sm:py-8 px-2">
                      <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-glow">
                        <Sparkles className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                      </div>
                      <h4 className="font-bold text-base sm:text-lg mb-2">Welcome to XrozenAI!</h4>
                      <p className="text-xs sm:text-sm mb-4 sm:mb-6 text-muted-foreground/80 max-w-xs mx-auto">I can help you manage your workflow and perform actions</p>
                      <div className="text-xs sm:text-sm space-y-2 bg-muted/50 rounded-lg p-3 sm:p-4">
                        <p className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">Try asking:</p>
                        <ul className="space-y-1.5 sm:space-y-2 text-left">
                          <li className="flex items-start gap-2 p-2 bg-background/50 rounded-md hover:bg-accent/50 transition-colors">
                            <span className="text-primary flex-shrink-0">•</span>
                            <span className="break-words">"Create a new project called Marketing Video"</span>
                          </li>
                          <li className="flex items-start gap-2 p-2 bg-background/50 rounded-md hover:bg-accent/50 transition-colors">
                            <span className="text-primary flex-shrink-0">•</span>
                            <span className="break-words">"Add a client named John Doe"</span>
                          </li>
                          <li className="flex items-start gap-2 p-2 bg-background/50 rounded-md hover:bg-accent/50 transition-colors">
                            <span className="text-primary flex-shrink-0">•</span>
                            <span className="break-words">"Show me pending payments"</span>
                          </li>
                          <li className="flex items-start gap-2 p-2 bg-background/50 rounded-md hover:bg-accent/50 transition-colors">
                            <span className="text-primary flex-shrink-0">•</span>
                            <span className="break-words">"List all my projects"</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col gap-1.5 sm:gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300",
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] sm:max-w-[80%] rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm break-words",
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        )}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="text-xs sm:text-sm prose prose-xs sm:prose-sm dark:prose-invert max-w-none [&>*]:text-xs [&>*]:sm:text-sm">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-xs sm:text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className="text-[10px] sm:text-xs opacity-50 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      
                      {msg.actionData && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const routes = {
                              project: '/projects',
                              client: '/clients',
                              editor: '/editors'
                            };
                            navigate(routes[msg.actionData!.type]);
                            setIsOpen(false);
                          }}
                          className="gap-1.5 text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                        >
                          <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          View {msg.actionData.type}
                        </Button>
                      )}
                    </div>
                  ))}
                  
                  {loading && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-muted rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 rounded-bl-md shadow-sm">
                        <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary flex-shrink-0" />
                        <span className="text-xs sm:text-sm text-muted-foreground">XrozenAI is thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input - Mobile Optimized */}
              <div className="flex-shrink-0 px-3 py-3 sm:p-4 border-t bg-card/50 backdrop-blur-sm">
                <div className="flex gap-2 items-end bg-muted/50 rounded-2xl p-2 sm:p-2.5 border border-border/40">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ask XrozenAI anything..."
                    disabled={loading}
                    className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 min-h-[44px] sm:min-h-[52px] max-h-[100px] sm:max-h-[120px] resize-none text-xs sm:text-sm px-2 sm:px-3 py-2"
                    rows={1}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!input.trim() || loading}
                    size="icon"
                    className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0 transition-all hover:scale-105"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center">
                  <span className="hidden sm:inline">Press Enter to send • Shift+Enter for new line • </span>
                  Powered by Xrozen
                </p>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}