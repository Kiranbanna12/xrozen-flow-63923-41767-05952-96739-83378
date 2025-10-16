import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatAccessGate } from "@/components/chat/ChatAccessGate";

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shareToken = searchParams.get("share");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [shareInfo, setShareInfo] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get("project") || null
  );
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    // Only load project data if:
    // 1. We have a selectedProjectId
    // 2. Either no shareToken OR shareInfo is loaded
    if (selectedProjectId && (!shareToken || shareInfo)) {
      console.log('🔧 Chat: useEffect triggered, loading project data');
      loadProjectData();
      if (!shareToken) {
        setSearchParams({ project: selectedProjectId });
      }
    } else if (selectedProjectId && shareToken && !shareInfo) {
      console.log('🔧 Chat: Waiting for shareInfo to load before loading project data');
    }
  }, [selectedProjectId, shareInfo]);

  const loadUserData = async () => {
    try {
      // If share token present, check permissions first
      if (shareToken) {
        console.log('🔧 Chat: Loading share data for token:', shareToken);
        const shareData = await apiClient.getProjectShareByToken(shareToken);
        console.log('🔧 Chat: Share data received:', shareData);
        
        if (!shareData || !shareData.is_active) {
          toast.error("This share link is invalid or has been deactivated");
          navigate("/");
          return;
        }

        if (!shareData.can_chat) {
          toast.error("You don't have chat access. Please ask the owner for chat permissions.");
          navigate(`/shared/${shareToken}`);
          return;
        }

        console.log('🔧 Chat: Share data loaded successfully');
        console.log('🔧 Chat: Project in share data:', shareData.project);
        console.log('🔧 Chat: Creator ID:', shareData.project?.creator_id);
        setShareInfo(shareData);
        setSelectedProjectId(shareData.project_id);
      }

      // Chat requires authentication
      const user = await apiClient.getCurrentUser();
      if (!user) {
        toast.error("Please login to access chat", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => navigate("/auth")
          }
        });
        
        // Redirect to shared project if share token exists
        if (shareToken) {
          navigate(`/shared/${shareToken}`);
        } else {
          navigate("/auth");
        }
        return;
      }

      const profile = await apiClient.getProfile(user.id);
      setCurrentUser(profile);
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        if (shareToken) {
          toast.error("Please login to access chat");
          navigate(`/shared/${shareToken}`);
        } else {
          navigate("/auth");
        }
      } else {
        toast.error("Failed to load user data");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async () => {
    if (!selectedProjectId) {
      console.log('🔧 Chat: No selectedProjectId, skipping project load');
      return;
    }

    console.log('🔧 Chat: Loading project data for:', selectedProjectId);
    console.log('🔧 Chat: Has shareToken:', !!shareToken);
    console.log('🔧 Chat: Has shareInfo:', !!shareInfo);

    try {
      // ALWAYS load fresh project data from API
      console.log('🔧 Chat: Loading project via API for ID:', selectedProjectId);
      const project = await apiClient.getProject(selectedProjectId);
      console.log('🔧 Chat: Project loaded from API:', project);
      console.log('🔧 Chat: Project creator_id:', project.creator_id);
      
      // Mark as shared if we have a share token
      setSelectedProject({
        ...project,
        is_shared: !!shareToken,
        share_token: shareToken || undefined
      });
      console.log('🔧 Chat: Selected project set:', project.name);
    } catch (error: any) {
      console.error("🔧 Chat: Failed to load project from API:", error);
      // Fallback to shareInfo only if API fails AND we have shareInfo AND it matches current project
      if (shareInfo && shareInfo.project_id === selectedProjectId) {
        console.log('🔧 Chat: Using shareInfo as fallback');
        const projectData = shareInfo.project || {};
        setSelectedProject({
          id: shareInfo.project_id,
          name: projectData.name || shareInfo.project_name || 'Shared Project',
          creator_id: projectData.creator_id,
          is_shared: true,
          share_token: shareToken
        });
        console.log('🔧 Chat: Selected project set from shareInfo (fallback) with creator_id:', projectData.creator_id);
      } else {
        console.error('🔧 Chat: No matching shareInfo available for fallback');
        toast.error("Failed to load project details");
      }
    }
  };

  const handleSelectProject = (projectId: string) => {
    console.log('🔧 Chat: handleSelectProject called with:', projectId);
    // Clear existing project first to force reload
    setSelectedProject(null);
    setSelectedProjectId(projectId);
    // Update URL params without share token for regular projects
    if (!shareToken) {
      setSearchParams({ project: projectId });
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
      <div className="flex w-full min-h-screen md:h-screen md:overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col bg-background dark:bg-background">
          {/* Header - Always visible on desktop, hidden on mobile when chat window is open */}
          <header className={`${selectedProjectId ? 'hidden md:flex' : 'flex'} sticky top-0 border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm z-50 flex-shrink-0`}>
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Messages</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    Project-based communication
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden md:min-h-0">
            {/* Chat List Sidebar - WhatsApp style: Hidden on mobile when chat is open */}
            <div className={`${selectedProjectId ? 'hidden md:flex' : 'flex'} w-full md:w-auto flex-col h-full overflow-hidden`}>
              <ChatList
                currentUserId={currentUser?.id}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
              />
            </div>

            {/* Chat Window - WhatsApp style: Full width on mobile, shared width on desktop */}
            {selectedProjectId && selectedProject ? (
              <div className={`${selectedProjectId ? 'flex' : 'hidden md:flex'} flex-1 flex-col w-full h-full overflow-hidden`}>
                <ChatAccessGate
                  projectId={selectedProjectId}
                  currentUserId={currentUser?.id}
                  onAccessGranted={() => console.log("✅ Chat access granted")}
                >
                  <ChatWindow
                    projectId={selectedProjectId}
                    projectName={selectedProject.name}
                    currentUserId={currentUser?.id}
                    projectCreatorId={selectedProject.creator_id}
                    onBack={() => setSelectedProjectId(null)}
                  />
                </ChatAccessGate>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center bg-background dark:bg-background">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-lg font-semibold">
                    Select a project to start chatting
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Choose a project from the list to view messages
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
