import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle, Eye, Link as LinkIcon, Play, MessageSquare, ChevronDown, Clock } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface VersionManagementProps {
  projectId: string;
  versions: any[];
  onVersionsUpdate: () => void;
  userRole: string | null;
  isProjectCreator?: boolean;
  sectionTitle?: string;
  isSubProject?: boolean;
}

export const VersionManagement = ({ 
  projectId, 
  versions, 
  onVersionsUpdate, 
  userRole, 
  isProjectCreator = false,
  sectionTitle,
  isSubProject = false 
}: VersionManagementProps) => {
  // Ensure versions is always an array
  const safeVersions = Array.isArray(versions) ? versions : [];
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<any>(null);
  const [formData, setFormData] = useState({
    preview_url: "",
    final_url: ""
  });
  
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedVersionForFeedback, setSelectedVersionForFeedback] = useState<any>(null);
  
  const [viewFeedbackDialogOpen, setViewFeedbackDialogOpen] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState<any>(null);
  const [currentVersionFeedback, setCurrentVersionFeedback] = useState<any[]>([]);
  
  // Status management state
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [selectedVersionForStatusChange, setSelectedVersionForStatusChange] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [finalLinkUrl, setFinalLinkUrl] = useState('');
  const [correctionsText, setCorrectionsText] = useState('');
  
  // Final link management state
  const [finalLinkDialogOpen, setFinalLinkDialogOpen] = useState(false);
  const [selectedVersionForFinalLink, setSelectedVersionForFinalLink] = useState<any>(null);
  const [newFinalLink, setNewFinalLink] = useState('');
  
  // Feedback summary state
  const [feedbackSummary, setFeedbackSummary] = useState<{[key: string]: any}>({});

  // Load feedback summary when component mounts or versions change
  useEffect(() => {
    loadFeedbackSummary();
  }, [projectId, versions]);

  const loadFeedbackSummary = async () => {
    try {
      console.log('🔧 VersionManagement: Loading feedback summary for project:', projectId);
      const summary = await apiClient.getProjectFeedbackSummary(projectId);
      console.log('🔧 VersionManagement: Feedback summary received:', summary);
      const summaryMap: {[key: string]: any} = {};
      summary.forEach((item: any) => {
        summaryMap[item.version_id] = item;
        console.log(`🔧 VersionManagement: Version ${item.version_id} has ${item.total_feedback} feedback`);
      });
      setFeedbackSummary(summaryMap);
      console.log('🔧 VersionManagement: Feedback summary state updated');
    } catch (error) {
      console.error("Error loading feedback summary:", error);
    }
  };

  const loadVersionFeedback = async (versionId: string) => {
    try {
      console.log('🔧 Loading feedback for version:', versionId);
      const feedback = await apiClient.getVideoFeedback(versionId);
      console.log('🔧 Received feedback:', feedback);
      setCurrentVersionFeedback(feedback);
      
      // Find the version details for display
      const version = safeVersions.find(v => v.id === versionId);
      setViewingFeedback(version);
      setViewFeedbackDialogOpen(true);
    } catch (error) {
      console.error("Error loading version feedback:", error);
      toast.error("Failed to load feedback");
    }
  };
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.preview_url.trim()) {
      toast.error("Preview URL is required");
      return;
    }

    if (!isValidUrl(formData.preview_url)) {
      toast.error("Please enter a valid preview URL");
      return;
    }

    if (formData.final_url && !isValidUrl(formData.final_url)) {
      toast.error("Please enter a valid final URL");
      return;
    }

    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      if (editingVersion) {
        await apiClient.updateVideoVersion(projectId, editingVersion.id, {
          file_url: formData.preview_url,
          approval_status: editingVersion.approval_status || 'pending'
        });
        toast.success("Version updated successfully");
      } else {
        await apiClient.createVideoVersion(projectId, {
          preview_url: formData.preview_url
        });
        toast.success("Version added successfully");
      }

      handleDialogClose();
      onVersionsUpdate();
    } catch (error: any) {
      console.error("Error saving version:", error);
      toast.error(error.message || "Failed to save version");
    }
  };

  const handleEdit = (version: any) => {
    setEditingVersion(version);
    setFormData({
      preview_url: version.file_url || "",
      final_url: ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (versionId: string) => {
    try {
      await apiClient.deleteVideoVersion(projectId, versionId);
      toast.success("Version deleted successfully");
      onVersionsUpdate();
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error("Failed to delete version");
    }
  };

  const handleStatusClick = (version: any) => {
    // Only allow status changes for clients and project creators
    if (userRole === 'client' || isProjectCreator) {
      setSelectedVersionForStatusChange(version);
      setSelectedStatus('');
      setFinalLinkUrl('');
      setCorrectionsText('');
      setStatusChangeDialogOpen(true);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status");
      return;
    }

    if (selectedStatus === 'corrections_needed' && !correctionsText.trim()) {
      toast.error("Please provide corrections feedback");
      return;
    }

    try {
      const updateData: any = { approval_status: selectedStatus };
      
      if (selectedStatus === 'corrections_needed' && correctionsText.trim()) {
        updateData.feedback = correctionsText;
      }

      await apiClient.updateVideoVersion(projectId, selectedVersionForStatusChange.id, updateData);
      
      toast.success(`Version status updated to ${selectedStatus.replace('_', ' ')}`);
      setStatusChangeDialogOpen(false);
      setSelectedVersionForStatusChange(null);
      setSelectedStatus('');
      setFinalLinkUrl('');
      setCorrectionsText('');
      onVersionsUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleApprovalAction = async (versionId: string, status: 'approved' | 'rejected' | 'corrections_needed') => {
    if (status === 'corrections_needed') {
      const version = safeVersions.find(v => v.id === versionId);
      setSelectedVersionForFeedback(version);
      setFeedbackText(version?.feedback || "");
      setFeedbackDialogOpen(true);
      return;
    }

    if (status === 'approved') {
      try {
        await apiClient.updateVideoVersion(projectId, versionId, { 
          approval_status: 'approved'
        });
        toast.success("Version approved!");
        onVersionsUpdate();
      } catch (error) {
        console.error("Error updating approval status:", error);
        toast.error("Failed to update approval status");
      }
      return;
    }

    try {
      await apiClient.updateVideoVersion(projectId, versionId, { 
        approval_status: status
      });
      toast.success(`Version ${status}`);
      onVersionsUpdate();
    } catch (error) {
      console.error("Error updating approval status:", error);
      toast.error("Failed to update approval status");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please enter feedback");
      return;
    }

    try {
      // Get current user for feedback attribution
      const currentUser = await apiClient.getCurrentUser();
      
      // Add feedback as a new entry in video_feedback table
      await apiClient.createVideoFeedback(selectedVersionForFeedback.id, {
        comment_text: feedbackText,
        timestamp_seconds: null, // No specific timestamp for general feedback
        is_resolved: false
      });

      // Update version status to corrections_needed if not already
      if (selectedVersionForFeedback.approval_status !== 'corrections_needed') {
        await apiClient.updateVideoVersion(projectId, selectedVersionForFeedback.id, {
          approval_status: 'corrections_needed'
        });
      }

      toast.success("Feedback added successfully");
      
      // Close the feedback dialog first
      setFeedbackDialogOpen(false);
      setFeedbackText("");
      
      // Reload everything to show updated counts and data
      await Promise.all([
        loadFeedbackSummary(),
        onVersionsUpdate()
      ]);
      
      // If we came from viewing feedback, reload and show the updated feedback
      if (viewingFeedback && viewingFeedback.id === selectedVersionForFeedback.id) {
        await loadVersionFeedback(selectedVersionForFeedback.id);
      }
      
      setSelectedVersionForFeedback(null);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleViewFeedback = (version: any) => {
    setViewingFeedback(version);
    setViewFeedbackDialogOpen(true);
  };

  const handleRequestFinalLink = (version: any) => {
    setSelectedVersionForFinalLink(version);
    setNewFinalLink('');
    setFinalLinkDialogOpen(true);
  };

  const handleAddFinalLink = async () => {
    if (!newFinalLink.trim()) {
      toast.error("Please provide final link");
      return;
    }

    if (!isValidUrl(newFinalLink)) {
      toast.error("Please enter a valid URL");
      return;
    }

    try {
      await apiClient.updateVideoVersion(projectId, selectedVersionForFinalLink.id, {
        final_url: newFinalLink
      });
      
      toast.success("Final link added successfully");
      setFinalLinkDialogOpen(false);
      setSelectedVersionForFinalLink(null);
      setNewFinalLink('');
      onVersionsUpdate();
    } catch (error) {
      console.error("Error adding final link:", error);
      toast.error("Failed to add final link");
    }
  };


  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingVersion(null);
    setFormData({ preview_url: "", final_url: "" });
  };

  const getApprovalBadge = (status: string, version: any) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pending", icon: AlertCircle },
      approved: { variant: "outline", label: "Approved", icon: CheckCircle, className: "bg-primary/10 text-primary border-primary/30" },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
      corrections_needed: { variant: "outline", label: "Corrections Needed", icon: AlertCircle, className: "bg-yellow-50 text-yellow-700 border-yellow-300" }
    };
    
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    const isClickable = (userRole === 'client' || isProjectCreator) && status === 'pending';
    
    return (
      <Badge 
        variant={config.variant} 
        className={`text-xs ${config.className} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={isClickable ? () => handleStatusClick(version) : undefined}
      >
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
        {isClickable && <ChevronDown className="w-3 h-3 ml-1" />}
      </Badge>
    );
  };

  // Mobile card layout for versions
  const renderVersionCard = (version: any) => {
    const summary = feedbackSummary[version.id];
    
    return (
      <Card key={version.id} className="mb-3 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header with version and status */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">Version {version.version_number}</h4>
                <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleDateString()}</p>
              </div>
              {getApprovalBadge(version.approval_status, version)}
            </div>

            {/* Video Links */}
            <div className="space-y-2">
              {version.file_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs justify-center"
                  onClick={() => navigate(`/video-preview/${version.id}`)}
                >
                  <Play className="w-3 h-3 mr-2" />
                  Watch & Review
                </Button>
              )}
              {version.final_url && (
                <a 
                  href={version.final_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-primary hover:underline text-xs"
                >
                  <LinkIcon className="w-3 h-3" />
                  Final Link
                </a>
              )}
            </div>

            {/* Feedback count */}
            {summary && summary.total_feedback > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-9 text-xs"
                onClick={() => loadVersionFeedback(version.id)}
              >
                <MessageSquare className="w-3 h-3 mr-2" />
                {summary.total_feedback} Feedback
              </Button>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {/* Client Actions */}
              {userRole === 'client' && version.approval_status === 'pending' && (
                <>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                    onClick={() => handleApprovalAction(version.id, 'approved')}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleApprovalAction(version.id, 'rejected')}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="w-full h-8 text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                    onClick={() => handleApprovalAction(version.id, 'corrections_needed')}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Corrections Needed
                  </Button>
                </>
              )}
              
              {userRole === 'client' && version.approval_status !== 'pending' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => handleStatusClick(version)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Change Status
                </Button>
              )}

              {/* Editor Actions */}
              {(userRole === 'editor' || isProjectCreator) && (
                <>
                  <Button 
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleEdit(version)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  {version.approval_status === 'pending' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleDelete(version.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  )}
                </>
              )}

              {/* Final Link Management */}
              {version.approval_status === 'approved' && !version.final_url && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                  onClick={() => handleRequestFinalLink(version)}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  Add Final Link
                </Button>
              )}

              {version.final_url && (userRole === 'editor' || isProjectCreator) && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => handleRequestFinalLink(version)}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  Update Final Link
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Card className="shadow-elegant">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {sectionTitle || "Video Versions"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Manage different versions of the project video
              </CardDescription>
            </div>
            {(userRole === 'editor' || isProjectCreator) && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Version</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {safeVersions.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 sm:py-8 text-xs sm:text-sm">No versions added yet</p>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3">
                {safeVersions.map(version => renderVersionCard(version))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Version</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Created</TableHead>
                  <TableHead className="text-xs sm:text-sm">File Link</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-xs sm:text-sm hidden md:table-cell">Feedback</TableHead>
                  <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeVersions.map((version) => {
                  const summary = feedbackSummary[version.id];
                  return (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium text-xs sm:text-sm">v{version.version_number}</TableCell>
                    <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{new Date(version.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {version.file_url && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => navigate(`/video-preview/${version.id}`)}
                          >
                            <Play className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Watch & Review</span>
                          </Button>
                        )}
                        {version.final_url && (
                          <div className="flex items-center gap-2">
                            <a 
                              href={version.final_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                            >
                              <LinkIcon className="w-3 h-3" />
                              Final Link
                            </a>
                          </div>
                        )}
                        {!version.file_url && !version.final_url && (
                          <span className="text-muted-foreground">Not added</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm">{getApprovalBadge(version.approval_status, version)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {summary ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => loadVersionFeedback(version.id)}
                        >
                          <MessageSquare className="w-3 h-3 sm:mr-1" />
                          <span className="hidden sm:inline">{summary.total_feedback} feedback</span>
                          <span className="sm:hidden">{summary.total_feedback}</span>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">No feedback</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 sm:gap-2 flex-wrap">
                        {/* Client Actions */}
                        {userRole === 'client' && (
                          <>
                            {version.approval_status === 'pending' && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                                  onClick={() => handleApprovalAction(version.id, 'approved')}
                                >
                                  <CheckCircle className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Approve</span>
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-8 text-xs"
                                  onClick={() => handleApprovalAction(version.id, 'rejected')}
                                >
                                  <XCircle className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Reject</span>
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-8 text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                  onClick={() => handleApprovalAction(version.id, 'corrections_needed')}
                                >
                                  <AlertCircle className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Corrections</span>
                                </Button>
                              </>
                            )}
                            {version.approval_status !== 'pending' && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => handleStatusClick(version)}
                              >
                                <Edit className="w-3 h-3 sm:mr-1" />
                                <span className="hidden sm:inline">Change</span>
                              </Button>
                            )}
                          </>
                        )}

                        {/* Editor/Creator Actions */}
                        {(userRole === 'editor' || isProjectCreator) && (
                          <>
                            <Button 
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => handleEdit(version)}
                            >
                              <Edit className="w-3 h-3 sm:mr-1" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                            {version.approval_status === 'pending' && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                className="h-8 text-xs"
                                onClick={() => handleDelete(version.id)}
                              >
                                <Trash2 className="w-3 h-3 sm:mr-1" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            )}
                          </>
                        )}

                        {/* Final Link Management - For Everyone */}
                        {version.approval_status === 'approved' && !version.final_url && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                            onClick={() => handleRequestFinalLink(version)}
                          >
                            <LinkIcon className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Add Final</span>
                          </Button>
                        )}

                        {version.final_url && (userRole === 'editor' || isProjectCreator) && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => handleRequestFinalLink(version)}
                          >
                            <LinkIcon className="w-3 h-3 sm:mr-1" />
                            <span className="hidden sm:inline">Update Final</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Version Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingVersion ? "Edit Version" : "Add New Version"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingVersion ? "Update the version details" : "Add a new video version"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="preview_url" className="text-xs sm:text-sm">Preview URL *</Label>
                <Input
                  id="preview_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.preview_url}
                  onChange={(e) => setFormData({ ...formData, preview_url: e.target.value })}
                  className="mt-1.5 h-9 text-xs sm:text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the Google Drive or video hosting URL</p>
              </div>
              <div>
                <Label htmlFor="final_url" className="text-xs sm:text-sm">Final URL (Optional)</Label>
                <Input
                  id="final_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.final_url}
                  onChange={(e) => setFormData({ ...formData, final_url: e.target.value })}
                  className="mt-1.5 h-9 text-xs sm:text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Add final approved version link</p>
              </div>
            </div>
            <DialogFooter className="mt-4 sm:mt-6 flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" size="sm" className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary">
                {editingVersion ? "Update" : "Add"} Version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add Corrections Feedback</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Provide detailed feedback about what needs to be corrected in Version {selectedVersionForFeedback?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <Textarea
              placeholder="Enter your detailed feedback here... You can use formatting and be as descriptive as needed."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={8}
              className="resize-none text-xs sm:text-sm"
            />
            <p className="text-xs text-muted-foreground">Be specific about timestamps, scenes, or elements that need changes</p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary" onClick={handleSubmitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Dialog */}
      <Dialog open={viewFeedbackDialogOpen} onOpenChange={setViewFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Feedback for Version {viewingFeedback?.version_number}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Client corrections and feedback
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            {currentVersionFeedback.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {currentVersionFeedback.map((feedback, index) => (
                  <div key={feedback.id || index} className="bg-primary/10 border border-primary/20 p-3 sm:p-4 rounded-lg">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs sm:text-sm text-foreground">
                            {feedback.user_name || 'Anonymous'}
                          </span>
                          <Badge variant={feedback.is_resolved ? "default" : "destructive"} className="text-xs">
                            {feedback.is_resolved ? "Resolved" : "Unresolved"}
                          </Badge>
                          {feedback.timestamp_seconds === null && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                              General
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(feedback.created_at).toLocaleDateString()} {new Date(feedback.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {feedback.timestamp_seconds !== null && (
                        <Badge variant="outline" className="text-xs bg-card dark:bg-card flex-shrink-0">
                          <Clock className="w-3 h-3 mr-1" />
                          {Math.floor(feedback.timestamp_seconds / 60)}:{(feedback.timestamp_seconds % 60).toFixed(0).padStart(2, '0')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm whitespace-pre-wrap text-foreground bg-card dark:bg-card p-2 sm:p-3 rounded border border-border">
                      {feedback.comment_text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No feedback available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add feedback using the button below or visit the video preview page for detailed feedback
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs sm:text-sm h-9"
              onClick={() => {
                setViewFeedbackDialogOpen(false);
                navigate(`/video-preview/${viewingFeedback?.id}`);
              }}
            >
              <Eye className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">View in Player</span>
              <span className="sm:hidden">View</span>
            </Button>
            <Button 
              variant="outline"
              size="sm"
              className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary"
              onClick={() => {
                // Keep the current viewing version in state so we can reopen after submitting
                setSelectedVersionForFeedback(viewingFeedback);
                setFeedbackText("");
                setViewFeedbackDialogOpen(false);
                setFeedbackDialogOpen(true);
              }}
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              Add Feedback
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={() => setViewFeedbackDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Change Version Status</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update the status for Version {selectedVersionForStatusChange?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="status" className="text-xs sm:text-sm">Select Status</Label>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStatus('approved')}
                  className={`text-xs sm:text-sm ${selectedStatus === 'approved' ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
                >
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStatus('rejected')}
                  className={`text-xs sm:text-sm ${selectedStatus === 'rejected' ? 'bg-destructive/10 border-destructive/30 text-destructive' : ''}`}
                >
                  <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedStatus('corrections_needed')}
                  className={`text-xs sm:text-sm ${selectedStatus === 'corrections_needed' ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : ''}`}
                >
                  <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Corrections
                </Button>
              </div>
            </div>

            {selectedStatus === 'corrections_needed' && (
              <div>
                <Label htmlFor="corrections" className="text-xs sm:text-sm">Corrections Feedback *</Label>
                <Textarea
                  id="corrections"
                  placeholder="Enter detailed feedback about what needs to be corrected..."
                  value={correctionsText}
                  onChange={(e) => setCorrectionsText(e.target.value)}
                  rows={5}
                  className="resize-none text-xs sm:text-sm mt-1.5"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Provide specific feedback about what needs to be changed
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={() => setStatusChangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary" onClick={handleStatusChange}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Link Dialog */}
      <Dialog open={finalLinkDialogOpen} onOpenChange={setFinalLinkDialogOpen}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add Final Link</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Add the final approved video link for Version {selectedVersionForFinalLink?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <Label htmlFor="final_link" className="text-xs sm:text-sm">Final Link *</Label>
              <Input
                id="final_link"
                type="url"
                placeholder="https://..."
                value={newFinalLink}
                onChange={(e) => setNewFinalLink(e.target.value)}
                className="mt-1.5 h-9 text-xs sm:text-sm"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Provide the final approved video link
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
            <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={() => setFinalLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary" onClick={handleAddFinalLink}>
              Add Final Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
