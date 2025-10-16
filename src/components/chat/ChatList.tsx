import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Pin, Share2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";

interface ChatListProps {
  currentUserId: string;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}

interface ProjectChat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  pinned: boolean;
  is_shared?: boolean;
  share_token?: string;
}

export const ChatList = ({ currentUserId, selectedProjectId, onSelectProject }: ChatListProps) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ProjectChat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadChats();
  }, [currentUserId]);

  // Real-time updates and auto-refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Chat list refreshing on visibility');
        loadChats(true);
      }
    };

    const handleFocus = () => {
      console.log('🔄 Chat list refreshing on focus');
      loadChats(true);
    };

    // WebSocket listener for instant updates
    const handleChatUpdate = (data: any) => {
      console.log('🔔 ChatList: Chat update received:', data.event);
      if (data.event === 'message:new' || data.event === 'message:status') {
        console.log('🔔 ChatList: Refreshing chat list instantly');
        loadChats(true);
      }
    };

    // Listen for custom chat:read event
    const handleChatRead = () => {
      console.log('🔔 ChatList: Chat read event, refreshing');
      loadChats(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('chat:read', handleChatRead);

    // Import websocketClient and add listener
    import('@/lib/websocket-client').then(({ websocketClient }) => {
      websocketClient.on('chat:update', handleChatUpdate);
    });

    // Reduced refresh interval to 3 seconds for instant feel
    const refreshInterval = setInterval(() => {
      console.log('🔄 Chat list auto-refreshing (fallback)');
      loadChats(true);
    }, 3000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('chat:read', handleChatRead);
      clearInterval(refreshInterval);
      import('@/lib/websocket-client').then(({ websocketClient }) => {
        websocketClient.off('chat:update', handleChatUpdate);
      });
    };
  }, [currentUserId]);

  const loadChats = async (isBackgroundRefresh = false) => {
    try {
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      }
      
      console.log('🔄 Loading chats...', { isBackgroundRefresh });
      
      // Load all projects where user is creator
      const ownedProjects = await apiClient.getProjects();
      
      // Load shared projects with chat access
      let sharedProjectsWithChat: any[] = [];
      try {
        const allSharedProjects = await apiClient.getMySharedProjects();
        // Filter only projects where user has chat access
        sharedProjectsWithChat = allSharedProjects.filter((p: any) => p.share_info?.can_chat);
        console.log('💬 Shared projects with chat access:', sharedProjectsWithChat.length);
      } catch (error) {
        console.error("Failed to load shared projects:", error);
      }

      // Combine both lists, removing duplicates
      const allProjects = [...ownedProjects];
      sharedProjectsWithChat.forEach((sharedProject: any) => {
        if (!allProjects.find(p => p.id === sharedProject.id)) {
          allProjects.push({ 
            ...sharedProject, 
            is_shared: true
            // Name already includes project name from backend
          });
        }
      });

      console.log('💬 Total chat projects:', allProjects.length);

      // Get unread counts for all projects
      let unreadData: { projects: any[]; total_unread: number } = { projects: [], total_unread: 0 };
      try {
        unreadData = await apiClient.getUnreadCounts();
        console.log('💬 Unread counts loaded:', unreadData);
      } catch (error) {
        console.error("Failed to load unread counts:", error);
      }

      // Map projects to chat list items with unread counts
      const chatsWithMessages = allProjects.map((project) => {
        const unreadInfo = unreadData.projects.find((p: any) => p.project_id === project.id);
        
        return {
          id: project.id,
          name: project.name,
          lastMessage: unreadInfo?.last_message_preview || "No messages yet",
          lastMessageTime: unreadInfo?.last_message_at || project.created_at,
          unreadCount: unreadInfo?.unread_count || 0,
          pinned: false, // TODO: Implement pinning
          is_shared: (project as any).is_shared || false,
          share_token: (project as any).share_info?.share_token
        };
      });

      // Sort by latest message time (most recent first)
      chatsWithMessages.sort((a, b) => {
        // Handle invalid dates by using fallback
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        
        // If both times are invalid, maintain current order
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1; // Put invalid dates at bottom
        if (isNaN(timeB)) return -1; // Put invalid dates at bottom
        
        return timeB - timeA; // Descending order (newest first)
      });

      console.log('💬 Sorted chats:', chatsWithMessages.map(c => ({
        name: c.name,
        lastMessageTime: c.lastMessageTime,
        unreadCount: c.unreadCount
      })));

      setChats(chatsWithMessages);
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(search.toLowerCase())
  );

  // Separate pinned and regular chats
  const pinnedChats = filteredChats.filter(c => c.pinned);
  const regularChats = filteredChats.filter(c => !c.pinned);

  // Sort both pinned and regular chats by latest message time
  const sortByLatestMessage = (a: ProjectChat, b: ProjectChat) => {
    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
    
    if (isNaN(timeA) && isNaN(timeB)) return 0;
    if (isNaN(timeA)) return 1;
    if (isNaN(timeB)) return -1;
    
    return timeB - timeA; // Newest first
  };

  pinnedChats.sort(sortByLatestMessage);
  regularChats.sort(sortByLatestMessage);

  const handleChatClick = (chat: ProjectChat) => {
    console.log('🔧 ChatList: Clicking chat:', chat.id, 'is_shared:', chat.is_shared, 'share_token:', chat.share_token);
    
    // Always use onSelectProject for consistency, let parent handle routing
    onSelectProject(chat.id);
    
    // For shared projects, also update URL if needed
    if (chat.is_shared && chat.share_token && window.location.search.includes('share=')) {
      // Already have share param, just update project
      const url = new URL(window.location.href);
      url.searchParams.set('project', chat.id);
      window.history.replaceState({}, '', url.toString());
    }
  };

  return (
    <div className="w-full md:w-80 lg:w-96 border-r flex flex-col bg-card h-full overflow-hidden">
      {/* Search Bar - Fixed at top */}
      <div className="p-3 sm:p-4 border-b space-y-2 bg-card flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 sm:pl-9 h-9 text-xs sm:text-sm"
          />
        </div>
      </div>

      {/* Chat List - Scrollable content area */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 sm:p-2 space-y-0.5 sm:space-y-1">
          {pinnedChats.length > 0 && (
            <>
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-muted-foreground flex items-center gap-1.5 sm:gap-2">
                <Pin className="h-3 w-3 flex-shrink-0" />
                PINNED
              </div>
              {pinnedChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  isSelected={chat.id === selectedProjectId}
                  onClick={() => handleChatClick(chat)}
                />
              ))}
            </>
          )}

          {regularChats.length > 0 && pinnedChats.length > 0 && (
            <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-muted-foreground">
              ALL CHATS
            </div>
          )}

          {regularChats.map((chat) => (
            <ChatListItem
              key={chat.id}
              chat={chat}
              isSelected={chat.id === selectedProjectId}
              onClick={() => handleChatClick(chat)}
            />
          ))}

          {filteredChats.length === 0 && !loading && (
            <div className="p-6 sm:p-8 text-center text-muted-foreground text-xs sm:text-sm">
              {search ? "No projects found" : "No projects yet"}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

interface ChatListItemProps {
  chat: ProjectChat;
  isSelected: boolean;
  onClick: () => void;
}

const ChatListItem = ({ chat, isSelected, onClick }: ChatListItemProps) => {
  return (
    <div
      onClick={onClick}
      className={`p-2 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 ${
        isSelected 
          ? "bg-[#f0f2f5] dark:bg-[#2a2f32] border-l-4 border-l-[#25D366]" 
          : "hover:bg-[#f5f6f6] dark:hover:bg-[#202428]"
      }`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
          <h3 className={`font-semibold text-xs sm:text-sm truncate ${isSelected ? 'text-foreground' : ''}`}>
            {chat.name}
          </h3>
          {chat.is_shared && (
            <Badge variant="outline" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs shrink-0">
              <Share2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </Badge>
          )}
        </div>
        {chat.unreadCount > 0 && (
          <Badge 
            variant="default" 
            className="ml-1.5 sm:ml-2 h-4 sm:h-5 min-w-4 sm:min-w-5 rounded-full px-1 sm:px-1.5 text-[10px] sm:text-xs shrink-0 bg-[#25D366] hover:bg-[#25D366] animate-in fade-in zoom-in duration-200"
          >
            {chat.unreadCount}
          </Badge>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate flex-1">
          {chat.lastMessage}
        </p>
        <span className="text-[10px] sm:text-xs text-muted-foreground ml-1.5 sm:ml-2 shrink-0">
          {format(new Date(chat.lastMessageTime), "HH:mm")}
        </span>
      </div>
    </div>
  );
};
