import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ArrowLeft, Video, MessageSquare, Eye, Edit, Lock, CheckCircle, AlertCircle, FileText, LogIn } from "lucide-react";
import { toast } from "sonner";
import { SharedVersionManagement } from "@/components/project-share/SharedVersionManagement";

const SharedProject = () => {
  const navigate = useNavigate();
  const { shareToken } = useParams();
  const [project, setProject] = useState<any>(null);
  const [shareInfo, setShareInfo] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [hasJoinedChat, setHasJoinedChat] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      setIsAuthenticated(!!user);
    } catch {
      setIsAuthenticated(false);
    }
  };

  useEffect(() => {
    if (shareToken) {
      loadSharedProject();
    }
  }, [shareToken, isAuthenticated]); // Re-load when authentication changes

  // Log access separately, but re-log when authentication changes
  useEffect(() => {
    if (shareToken) {
      logAccess();
    }
  }, [shareToken, isAuthenticated]);

  const logAccess = async () => {
    try {
      await apiClient.logShareAccess(shareToken!, {
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Error logging access:", error);
    }
  };

  const loadSharedProject = async () => {
    try {
      // Get share information with project details (public endpoint)
      const shareData = await apiClient.getProjectShareByToken(shareToken!);
      
      if (!shareData || !shareData.is_active) {
        toast.error("This share link is invalid or has been deactivated");
        navigate("/");
        return;
      }

      setShareInfo(shareData);

      // Project data is now included in the share response
      if (shareData.project) {
        setProject(shareData.project);
      } else {
        toast.error("Project not found");
        navigate("/");
        return;
      }

      // Load versions if has view access (using share token)
      if (shareData.can_view) {
        const versionsData = await apiClient.getSharedProjectVersions(shareToken!);
        setVersions(versionsData || []);
      }

      // Check if user has already joined chat
      if (shareData.can_chat) {
        checkChatMembership(shareData.project_id);
      }

      // If user is already authenticated, automatically track this access
      // This will add the project to their shared projects list
      if (isAuthenticated) {
        console.log('✅ User is authenticated, project will be tracked in shared projects');
      }
    } catch (error: any) {
      console.error("Error loading shared project:", error);
      toast.error("Failed to load project");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const checkChatMembership = async (projectId: string) => {
    try {
      // Only check if user is authenticated
      if (apiClient.isAuthenticated()) {
        const members = await apiClient.getProjectChatMembers(projectId);
        const currentUser = await apiClient.getCurrentUser();
        
        if (currentUser) {
          const isMember = members.some((m: any) => m.user_id === currentUser.id);
          setHasJoinedChat(isMember);
        }
      }
    } catch (error) {
      console.error("Error checking chat membership:", error);
      // Don't fail the whole page if chat check fails
    }
  };

  const handleJoinChat = async () => {
    try {
      if (!apiClient.isAuthenticated()) {
        toast.error("Please login to join the chat", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => navigate("/auth")
          }
        });
        navigate("/auth");
        return;
      }

      const currentUser = await apiClient.getCurrentUser();
      
      if (!currentUser) {
        toast.error("Please login to join the chat", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => navigate("/auth")
          }
        });
        navigate("/auth");
        return;
      }

      await apiClient.joinProjectChat({
        project_id: shareInfo.project_id,
        share_id: shareInfo.id,
      });

      setHasJoinedChat(true);
      setChatOpen(true);
      toast.success("You've joined the project chat!");
    } catch (error: any) {
      toast.error(error.message || "Failed to join chat");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "Draft", icon: FileText },
      in_review: { variant: "default", label: "In Review", icon: AlertCircle },
      approved: { variant: "default", label: "Approved", icon: CheckCircle, className: "bg-success" },
      completed: { variant: "default", label: "Completed", icon: CheckCircle, className: "bg-success" }
    };
    
    const config = variants[status] || variants.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project || !shareInfo) {
    return null;
  }

  // Main content component
  const ProjectContent = () => (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 py-4 gap-4">
          <div className="flex items-center gap-4">
            {/* Add sidebar trigger if authenticated */}
            {isAuthenticated && <SidebarTrigger />}
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                <Video className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-sm text-muted-foreground">Shared Project</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Access Permissions Badge */}
            <div className="flex gap-1">
              {shareInfo.can_view && (
                <Badge variant="outline" className="gap-1">
                  <Eye className="w-3 h-3" />
                  View
                </Badge>
              )}
              {shareInfo.can_edit && (
                <Badge variant="outline" className="gap-1">
                  <Edit className="w-3 h-3" />
                  Edit
                </Badge>
              )}
              {shareInfo.can_chat && (
                <Badge variant="outline" className="gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Chat
                </Badge>
              )}
            </div>

            {/* Chat Button */}
            {shareInfo.can_chat && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="default"
                        onClick={() => {
                          if (!isAuthenticated) {
                            toast.info("Redirecting to login...", {
                              duration: 2000
                            });
                            navigate("/auth");
                            return;
                          }
                          
                          if (!hasJoinedChat) {
                            handleJoinChat();
                          } else {
                            navigate(`/chat?project=${shareInfo.project_id}`);
                          }
                        }}
                        className={!isAuthenticated ? "gradient-primary opacity-90 hover:opacity-100" : "gradient-primary"}
                      >
                        {!isAuthenticated ? (
                          <>
                            <LogIn className="w-4 h-4 mr-2" />
                            Login to Join Chat
                          </>
                        ) : (
                          <>
                            <MessageSquare className="w-4 h-4 mr-2" />
                            {hasJoinedChat ? "Open Chat" : "Join Chat"}
                          </>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!isAuthenticated && (
                    <TooltipContent>
                      <p>Click to login and join the project chat</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </header>

      <main className="px-8 py-8 max-w-7xl mx-auto">
        {/* Project Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
              <p className="text-muted-foreground">{project.description || "No description"}</p>
            </div>
            {getStatusBadge(project.status)}
          </div>

          {/* Access Notice */}
          <Card className="shadow-elegant border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Limited Access View</h3>
                  <p className="text-sm text-muted-foreground">
                    You're viewing this project with {shareInfo.can_edit ? 'edit' : 'read-only'} access.
                    {shareInfo.can_chat && " You can also access the project chat."}
                    {!shareInfo.can_edit && " You cannot modify project settings or add feedback."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Project Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{project.project_type || "Not specified"}</p>
              </CardContent>
            </Card>

            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold capitalize">
                  {project.status.replace('_', ' ')}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Dates */}
          {(project.assigned_date || project.deadline) && (
            <Card className="shadow-elegant mt-4">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {project.assigned_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned Date</p>
                      <p className="font-medium">
                        {new Date(project.assigned_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {project.deadline && (
                    <div>
                      <p className="text-sm text-muted-foreground">Deadline</p>
                      <p className="font-medium">
                        {new Date(project.deadline).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Version Management */}
        {shareInfo.can_view && (
          <SharedVersionManagement
            projectId={shareInfo.project_id}
            versions={versions}
            onVersionsUpdate={loadSharedProject}
            canEdit={shareInfo.can_edit}
            shareToken={shareToken!}
          />
        )}

        {!shareInfo.can_view && (
          <Card className="shadow-elegant">
            <CardContent className="pt-6 text-center py-12">
              <Lock className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground text-lg font-semibold">
                You don't have permission to view project versions
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Contact the project owner for additional access
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );

  // Return with or without sidebar based on authentication
  if (isAuthenticated) {
    return (
      <SidebarProvider>
        <div className="flex w-full min-h-screen">
          <AppSidebar />
          <div className="flex-1">
            <ProjectContent />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return <ProjectContent />;
};

export default SharedProject;
