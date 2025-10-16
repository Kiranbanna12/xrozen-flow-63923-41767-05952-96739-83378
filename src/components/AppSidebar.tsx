import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCircle,
  MessageSquare,
  FileText,
  User,
  Settings,
  Sparkles,
  Bell,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";

type UserRole = "editor" | "client" | "agency";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Editors",
    url: "/editors",
    icon: UserCircle,
    roles: ["client", "agency"],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    roles: ["editor", "agency"],
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "XrozenAI",
    url: "/xrozen-ai",
    icon: Sparkles,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
    roles: ["editor", "client", "agency"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["editor", "client", "agency"],
  },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    // Load user role using API client
    const loadUserRole = async () => {
      try {
        // Only try to load if authenticated
        if (!apiClient.isAuthenticated()) {
          console.log('🔧 AppSidebar: Not authenticated, skipping user role load');
          return;
        }
        
        const user = await apiClient.getCurrentUser();
        if (!user) return;

        // Get user profile to determine role
        const profile = await apiClient.getProfile(user.id);
        if (profile) {
          setUserRole(profile.user_category as UserRole);
        }
      } catch (error) {
        console.error("Error loading user role:", error);
        // Don't set role to anything if there's an error
      }
    };

    loadUserRole();
  }, []);

  // Load unread message count with real-time updates
  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        if (!apiClient.isAuthenticated()) return;
        
        const data = await apiClient.getUnreadCounts();
        setTotalUnread(data.total_unread);
        console.log('🔔 AppSidebar: Updated unread count:', data.total_unread);
      } catch (error) {
        console.error("Error loading unread count:", error);
      }
    };

    loadUnreadCount();

    // Listen for WebSocket chat updates for instant notifications
    const handleChatUpdate = (data: any) => {
      console.log('🔔 AppSidebar: Chat update received:', data.event);
      if (data.event === 'message:new') {
        // Instant update when new message arrives
        console.log('🔔 AppSidebar: New message, refreshing count');
        loadUnreadCount();
      }
    };

    // Listen for custom chat:read event (when user reads messages)
    const handleChatRead = () => {
      console.log('🔔 AppSidebar: Chat read event, refreshing count');
      loadUnreadCount();
    };

    // Import websocketClient dynamically to avoid circular deps
    import('@/lib/websocket-client').then(({ websocketClient }) => {
      websocketClient.on('chat:update', handleChatUpdate);
    });

    // Listen to custom events
    window.addEventListener('chat:read', handleChatRead);

    // Also refresh periodically as fallback (reduced to 10 seconds)
    const interval = setInterval(loadUnreadCount, 10000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('chat:read', handleChatRead);
      import('@/lib/websocket-client').then(({ websocketClient }) => {
        websocketClient.off('chat:update', handleChatUpdate);
      });
    };
  }, []);

  // Memoize filtered items for better performance
  const filteredNavItems = useMemo(() => 
    navItems.filter((item) =>
      userRole ? item.roles.includes(userRole) : true // Show all items by default
    ),
    [userRole]
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar className="border-r bg-sidebar dark:bg-sidebar">
      <SidebarHeader className="border-b px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-sidebar dark:bg-sidebar">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold gradient-text">Xrozen Workflow</h2>
        <div className="mt-1.5 sm:mt-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-primary/10 dark:bg-primary/20 rounded-lg border border-primary/20 dark:border-primary/30">
          <p className="text-xs font-medium text-primary capitalize">
            {userRole || 'Loading...'} Account
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 sm:px-3 bg-sidebar dark:bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 sm:px-3 text-xs">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className="h-9 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm"
                  >
                    <item.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0" />
                    <span className="truncate">{item.title}</span>
                    {item.title === "Chat" && totalUnread > 0 && (
                      <Badge 
                        variant="default" 
                        className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs bg-[#25D366] hover:bg-[#25D366] text-white animate-in fade-in zoom-in duration-200 flex-shrink-0"
                      >
                        {totalUnread > 99 ? '99+' : totalUnread}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3 sm:p-4 bg-sidebar dark:bg-sidebar">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Xrozen
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
