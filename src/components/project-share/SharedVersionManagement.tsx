import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Play, Link as LinkIcon, MessageSquare, Eye, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface SharedVersionManagementProps {
  projectId: string;
  versions: any[];
  onVersionsUpdate: () => void;
  canEdit: boolean;
  shareToken: string;
}

export const SharedVersionManagement = ({ 
  projectId, 
  versions, 
  onVersionsUpdate, 
  canEdit,
  shareToken 
}: SharedVersionManagementProps) => {
  const safeVersions = Array.isArray(versions) ? versions : [];
  const navigate = useNavigate();
  
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedVersionForFeedback, setSelectedVersionForFeedback] = useState<any>(null);
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

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please enter feedback");
      return;
    }

    try {
      // For shared users, we'll add feedback through a special API
      await apiClient.addSharedProjectFeedback({
        version_id: selectedVersionForFeedback.id,
        comment_text: feedbackText,
        share_token: shareToken,
      });
      
      toast.success("Feedback submitted successfully");
      setFeedbackDialogOpen(false);
      setFeedbackText("");
      setSelectedVersionForFeedback(null);
      onVersionsUpdate();
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleRequestCorrections = (version: any) => {
    if (!canEdit) {
      toast.error("You don't have permission to add feedback");
      return;
    }

    if (!isAuthenticated) {
      toast.error("Please login to add feedback", {
        duration: 5000,
        action: {
          label: "Login",
          onClick: () => {
            // Save current location to return after login
            localStorage.setItem('returnUrl', `/shared/${shareToken}`);
            navigate("/auth");
          }
        }
      });
      // Save current location to return after login
      localStorage.setItem('returnUrl', `/shared/${shareToken}`);
      navigate("/auth");
      return;
    }
    
    setSelectedVersionForFeedback(version);
    setFeedbackText("");
    setFeedbackDialogOpen(true);
  };

  const getApprovalBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pending", icon: AlertCircle },
      approved: { variant: "default", label: "Approved", icon: CheckCircle, className: "bg-success" },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
      corrections_needed: { variant: "default", label: "Corrections Needed", icon: AlertCircle, className: "bg-yellow-500 text-yellow-900" }
    };
    
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Card className="shadow-elegant">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Video Versions</CardTitle>
              <CardDescription>
                {canEdit 
                  ? "View versions and add feedback" 
                  : "View-only access to project versions"}
              </CardDescription>
            </div>
            {canEdit && (
              <Badge variant="outline" className="gap-1">
                <MessageSquare className="w-3 h-3" />
                Can Add Feedback
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {safeVersions.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No versions added yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {safeVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">v{version.version_number}</TableCell>
                    <TableCell>{new Date(version.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        {version.file_url && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => navigate(`/video-preview/${version.id}?share=${shareToken}`)}
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Watch & Review
                          </Button>
                        )}
                        {version.final_url && (
                          <div className="flex items-center gap-2 mt-2">
                            <a 
                              href={version.final_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 font-semibold text-sm bg-green-50 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors"
                            >
                              <LinkIcon className="w-3 h-3 mr-1 inline" />
                              Final Link
                            </a>
                          </div>
                        )}
                        {!version.file_url && !version.final_url && (
                          <span className="text-muted-foreground">Not available</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getApprovalBadge(version.approval_status)}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestCorrections(version)}
                        >
                          {!isAuthenticated ? (
                            <>
                              <LogIn className="w-3 h-3 mr-1" />
                              Login to Add Feedback
                            </>
                          ) : (
                            <>
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Add Feedback
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" />
                          Read Only
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Feedback</DialogTitle>
            <DialogDescription>
              Provide feedback for Version {selectedVersionForFeedback?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your feedback here... Be specific about what you'd like to see changed."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={10}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              Your feedback will be sent to the project team for review.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
