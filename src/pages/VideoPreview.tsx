import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Clock, CheckCircle, Filter, GitCompare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { UniversalVideoPlayer } from "@/components/video-preview/UniversalVideoPlayer";
import { FeedbackForm } from "@/components/video-preview/FeedbackForm";
import { FeedbackList } from "@/components/video-preview/FeedbackList";
import { Badge } from "@/components/ui/badge";

const VideoPreview = () => {
  const { versionId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('share');
  const { user, isAuthenticated } = useAuth();
  const [version, setVersion] = useState<any>(null);
  const [project, setProject] = useState<any>(null);
  const [shareInfo, setShareInfo] = useState<any>(null);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [allVersions, setAllVersions] = useState<any[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonVersionId, setComparisonVersionId] = useState<string | null>(null);
  const [comparisonFeedback, setComparisonFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    // Allow access if user is authenticated OR if there's a valid share token
    if (!isAuthenticated && !shareToken) {
      navigate("/auth");
      return;
    }
    loadVersionData();
    
    // Set up periodic feedback polling for real-time updates
    const feedbackInterval = setInterval(() => {
      if (versionId) {
        loadFeedback();
      }
    }, 10000); // Poll every 10 seconds for new feedback

    return () => {
      clearInterval(feedbackInterval);
    };
  }, [versionId, isAuthenticated, shareToken]);

  const loadVersionData = async () => {
    try {
      // If share token is present, use public endpoint
      if (shareToken) {
        if (!versionId) {
          toast.error("Version ID not found");
          return;
        }

        // Get share info first to check permissions
        const shareData = await apiClient.getProjectShareByToken(shareToken);
        
        if (!shareData || !shareData.is_active) {
          toast.error("This share link is invalid or has been deactivated");
          navigate("/");
          return;
        }

        setShareInfo(shareData);

        const versionData = await apiClient.getSharedVersionDetails(shareToken, versionId);
        console.log('Loaded shared version:', versionData);
        
        setVersion(versionData);
        setProject(versionData.project);

        // Load all versions for comparison
        try {
          const versions = await apiClient.getSharedProjectVersions(shareToken);
          setAllVersions(versions);
          setSelectedVersionId(versionId);
        } catch (error) {
          console.error("Error loading versions:", error);
        }

        // Load feedback
        await loadFeedback();
        setLoading(false);
        return;
      }

      // Standard authenticated flow
      if (!user?.id) {
        navigate("/auth");
        return;
      }

      // We need to get the project ID first since version API might be nested
      // For now, let's create a direct endpoint for getting a single version
      // This might need a backend endpoint like GET /video-versions/:id
      
      // For now, let's try to get all versions and filter by ID
      // This is not optimal but will work until we have a direct endpoint
      
      // First, let's see if we can find which project this version belongs to
      // by checking if there's a project context or getting all projects
      const projects = await apiClient.getProjects();
      
      let foundVersion = null;
      let foundProject = null;
      
      for (const project of projects) {
        try {
          const versions = await apiClient.getVideoVersions(project.id);
          foundVersion = versions.find((v: any) => v.id === versionId);
          if (foundVersion) {
            foundProject = project;
            break;
          }
        } catch (error) {
          // Continue searching other projects
          continue;
        }
      }

      if (!foundVersion) {
        toast.error("Version not found");
        navigate("/projects");
        return;
      }

      console.log('Found version:', foundVersion);
      console.log('Found project:', foundProject);
      setVersion(foundVersion);
      setProject(foundProject);

      // Load all versions for comparison
      if (foundProject) {
        try {
          const versions = await apiClient.getVideoVersions(foundProject.id);
          setAllVersions(versions);
          setSelectedVersionId(versionId);
        } catch (error) {
          console.error("Error loading versions:", error);
        }
      }

      // Load feedback - for now we'll implement this locally
      await loadFeedback();
    } catch (error) {
      console.error("Error loading version:", error);
      toast.error("Failed to load video preview");
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async (specificVersionId?: string, isComparison: boolean = false) => {
    try {
      const targetVersionId = specificVersionId || selectedVersionId || versionId;
      if (!targetVersionId) return;
      
      console.log("Loading feedback for version:", targetVersionId, "isComparison:", isComparison);
      
      // Use shared endpoint if share token is present
      let feedbackData;
      if (shareToken) {
        feedbackData = await apiClient.getSharedVersionFeedback(shareToken, targetVersionId);
      } else {
        feedbackData = await apiClient.getVideoFeedback(targetVersionId);
      }
      
      if (isComparison) {
        setComparisonFeedback(feedbackData || []);
      } else {
        setFeedback(feedbackData || []);
      }
      
      console.log("Loaded feedback:", feedbackData);
    } catch (error) {
      console.error("Error loading feedback:", error);
    }
  };

  const handleVersionChange = async (newVersionId: string) => {
    setSelectedVersionId(newVersionId);
    await loadFeedback(newVersionId, false);
    
    // Don't navigate - just load feedback for the selected version
    // User stays on current version's page but can view other version's feedback
  };

  const handleComparisonToggle = async () => {
    if (!comparisonMode) {
      setComparisonMode(true);
      // Load first available different version for comparison
      const otherVersion = allVersions.find(v => v.id !== selectedVersionId);
      if (otherVersion) {
        setComparisonVersionId(otherVersion.id);
        await loadFeedback(otherVersion.id, true);
      }
    } else {
      setComparisonMode(false);
      setComparisonVersionId(null);
      setComparisonFeedback([]);
    }
  };

  const handleComparisonVersionChange = async (newVersionId: string) => {
    setComparisonVersionId(newVersionId);
    await loadFeedback(newVersionId, true);
  };

  // Real-time subscriptions will be implemented later with polling or WebSocket
  // For now, we'll rely on manual refresh

  const handleAddFeedback = async (commentText: string, timestamp?: number) => {
    try {
      if (!versionId) {
        toast.error("Version not found");
        return;
      }

      // If using share token, check permissions
      if (shareToken && shareInfo) {
        // Check if user has edit permission
        if (!shareInfo.can_edit) {
          toast.error("You only have view access. Please ask the project owner for edit permissions to add feedback.", {
            duration: 5000,
          });
          return;
        }

        // Check if user is logged in (required for edit operations)
        if (!isAuthenticated || !user?.id) {
          toast.error("Please login to add feedback", {
            duration: 5000,
            action: {
              label: "Login",
              onClick: () => navigate("/auth")
            }
          });
          return;
        }
      }

      console.log("Adding feedback:", {
        comment_text: commentText,
        timestamp_seconds: timestamp !== undefined ? timestamp : currentTime
      });

      // Use shared feedback endpoint if share token is present
      if (shareToken) {
        await apiClient.addSharedProjectFeedback({
          version_id: versionId,
          comment_text: commentText,
          share_token: shareToken,
          timestamp_seconds: timestamp !== undefined ? timestamp : currentTime
        });
      } else {
        // Standard authenticated feedback
        if (!user?.id) {
          toast.error("Please log in to add feedback");
          return;
        }

        await apiClient.createVideoFeedback(versionId, {
          comment_text: commentText,
          timestamp_seconds: timestamp !== undefined ? timestamp : currentTime
        });
      }

      toast.success("Feedback added successfully!");
      
      // Reload feedback to show the new one
      await loadFeedback();
    } catch (error) {
      console.error("Error adding feedback:", error);
      toast.error("Failed to add feedback");
    }
  };

  const handleSeekToTimestamp = (seconds: number) => {
    if (playerRef.current && playerRef.current.seekTo) {
      playerRef.current.seekTo(seconds);
    }
  };

  const handleResolveFeedback = async (feedbackId: string, resolved: boolean) => {
    try {
      if (!versionId) return;
      
      console.log("Resolving feedback:", feedbackId, resolved);
      
      // Convert boolean to number (0 or 1) for SQLite
      await apiClient.updateVideoFeedback(versionId, feedbackId, {
        is_resolved: resolved ? 1 : 0
      });
      
      toast.success(resolved ? "Feedback marked as resolved" : "Feedback reopened");
      
      // Reload feedback to show the updated status
      await loadFeedback();
    } catch (error: any) {
      console.error("Error updating feedback:", error);
      toast.error(error?.message || "Failed to update feedback");
    }
  };

  const handleEditFeedback = async (feedbackId: string, newText: string) => {
    try {
      if (!versionId) return;
      
      await apiClient.updateVideoFeedback(versionId, feedbackId, {
        comment_text: newText
      });
      
      toast.success("Feedback updated successfully");
      await loadFeedback();
    } catch (error: any) {
      console.error("Error editing feedback:", error);
      toast.error(error?.message || "Failed to edit feedback");
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    try {
      if (!versionId) return;
      
      await apiClient.deleteVideoFeedback(versionId, feedbackId);
      
      toast.success("Feedback deleted successfully");
      await loadFeedback();
    } catch (error: any) {
      console.error("Error deleting feedback:", error);
      toast.error(error?.message || "Failed to delete feedback");
    }
  };

  const handleReplyToFeedback = async (parentId: string, replyText: string, timestamp?: number) => {
    try {
      if (!versionId || !user?.id) return;
      
      await apiClient.createVideoFeedback(versionId, {
        comment_text: replyText,
        timestamp_seconds: timestamp,
        parent_id: parentId
      });
      
      toast.success("Reply added successfully");
      await loadFeedback();
    } catch (error: any) {
      console.error("Error adding reply:", error);
      toast.error(error?.message || "Failed to add reply");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!version || !project) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        {/* Hide sidebar for shared access */}
        {!shareToken && <AppSidebar />}
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                {!shareToken && <SidebarTrigger />}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs sm:text-sm h-8 sm:h-9"
                  onClick={() => {
                    if (shareToken) {
                      navigate(`/shared/${shareToken}`);
                    } else {
                      navigate(`/projects/${project.id}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Project</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Badge variant="outline" className="text-xs">
                  V{version.version_number}
                </Badge>
                {version.status === 'approved' && (
                  <Badge className="bg-success text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Approved</span>
                  </Badge>
                )}
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-1 sm:mb-2">{project.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Version {version.version_number} Preview</p>
            </div>

            {/* Video Player and Add Feedback Form - Same Height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
              {/* Video Player */}
              <div className="lg:col-span-2">
                <Card className="shadow-elegant h-full">
                  <CardContent className="p-0">
                    <UniversalVideoPlayer
                      ref={playerRef}
                      url={version.file_url}
                      onTimeUpdate={setCurrentTime}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Add Feedback Form - Sidebar */}
              <div className="lg:col-span-1">
                <FeedbackForm
                  currentTime={currentTime}
                  onAddFeedback={handleAddFeedback}
                  playerRef={playerRef}
                  disabled={shareToken ? !shareInfo?.can_edit || !isAuthenticated : false}
                  disabledMessage={
                    shareToken && !shareInfo?.can_edit
                      ? "You have view-only access. Ask the owner for edit permissions."
                      : !isAuthenticated
                      ? "Please login to add feedback"
                      : undefined
                  }
                  videoUrl={version.file_url}
                />
              </div>
            </div>

            {/* Approval Status - Full Width */}
            {version.status === 'approved' && (
              <Card className="shadow-elegant border-2 border-success/50 mb-4 sm:mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-success text-sm sm:text-base">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    Version Approved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    This version has been approved and is ready for final delivery.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Version Filter and Comparison Controls */}
            <Card className="shadow-elegant mb-4 sm:mb-6">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                  {/* Version Selector */}
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                    <label className="text-xs sm:text-sm font-medium whitespace-nowrap">View:</label>
                    <Select value={selectedVersionId || versionId} onValueChange={handleVersionChange}>
                      <SelectTrigger className="flex-1 h-8 sm:h-9 text-xs sm:text-sm">
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        {allVersions.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs sm:text-sm">
                            Version {v.version_number} {v.id === versionId && "(Current)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comparison Toggle */}
                  <Button
                    variant={comparisonMode ? "default" : "outline"}
                    size="sm"
                    className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
                    onClick={handleComparisonToggle}
                    disabled={allVersions.length < 2}
                  >
                    <GitCompare className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    {comparisonMode ? "Hide" : "Compare"}
                  </Button>

                  {/* Stats */}
                  <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {feedback.length} Total
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-destructive/10">
                      {feedback.filter(f => !f.is_resolved).length} Open
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-success/10">
                      {feedback.filter(f => f.is_resolved).length} Done
                    </Badge>
                  </div>
                </div>

                {/* Comparison Version Selector */}
                {comparisonMode && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-1">
                      <GitCompare className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <label className="text-xs sm:text-sm font-medium whitespace-nowrap">Compare:</label>
                      <Select value={comparisonVersionId || ""} onValueChange={handleComparisonVersionChange}>
                        <SelectTrigger className="flex-1 h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                          {allVersions
                            .filter(v => v.id !== selectedVersionId)
                            .map((v) => (
                              <SelectItem key={v.id} value={v.id} className="text-xs sm:text-sm">
                                Version {v.version_number}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {comparisonFeedback.length} Total
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-destructive/10">
                        {comparisonFeedback.filter(f => !f.is_resolved).length} Open
                      </Badge>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* All Feedback List - Full Width Below */}
            {comparisonMode && comparisonVersionId ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Current Version Feedback */}
                <div>
                  <div className="mb-2 sm:mb-3">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold">
                      Version {allVersions.find(v => v.id === selectedVersionId)?.version_number} Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">Current selection</p>
                  </div>
                  <FeedbackList
                    feedback={feedback}
                    onSeekToTimestamp={handleSeekToTimestamp}
                    onResolveFeedback={handleResolveFeedback}
                    onEditFeedback={handleEditFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                    onReplyToFeedback={handleReplyToFeedback}
                    currentUserId={user?.id}
                  />
                </div>

                {/* Comparison Version Feedback */}
                <div>
                  <div className="mb-2 sm:mb-3">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold">
                      Version {allVersions.find(v => v.id === comparisonVersionId)?.version_number} Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">Comparison</p>
                  </div>
                  <FeedbackList
                    feedback={comparisonFeedback}
                    onSeekToTimestamp={handleSeekToTimestamp}
                    onResolveFeedback={handleResolveFeedback}
                    onEditFeedback={handleEditFeedback}
                    onDeleteFeedback={handleDeleteFeedback}
                    onReplyToFeedback={handleReplyToFeedback}
                    currentUserId={user?.id}
                  />
                </div>
              </div>
            ) : (
              <FeedbackList
                feedback={feedback}
                onSeekToTimestamp={handleSeekToTimestamp}
                onResolveFeedback={handleResolveFeedback}
                onEditFeedback={handleEditFeedback}
                onDeleteFeedback={handleDeleteFeedback}
                onReplyToFeedback={handleReplyToFeedback}
                currentUserId={user?.id}
              />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default VideoPreview;
