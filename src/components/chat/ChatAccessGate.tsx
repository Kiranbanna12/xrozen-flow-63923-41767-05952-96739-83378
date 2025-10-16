import { useState, useEffect } from "react";
import { AlertCircle, Lock, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface ChatAccessGateProps {
  projectId: string;
  currentUserId: string;
  onAccessGranted: () => void;
  children: React.ReactNode;
}

export const ChatAccessGate = ({
  projectId,
  currentUserId,
  onAccessGranted,
  children,
}: ChatAccessGateProps) => {
  const [accessStatus, setAccessStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let isActive = true;
    
    const pollAccess = async () => {
      if (!isActive) return;
      
      const status = await checkAccess();
      
      // Only continue polling if:
      // 1. Component is still mounted
      // 2. User doesn't have access yet (pending, can_request, etc.)
      if (isActive && status && !status.hasAccess) {
        interval = setTimeout(() => pollAccess(), 5000);
      }
    };
    
    // Start initial check and polling
    pollAccess();

    return () => {
      isActive = false;
      if (interval) {
        clearTimeout(interval);
      }
    };
  }, [projectId]);

  const checkAccess = async () => {
    try {
      // Only show loading on first check, not on polling
      if (!accessStatus) {
        setLoading(true);
      }
      
      const status = await apiClient.getChatAccessStatus(projectId);
      console.log("🔒 Chat access status:", status);
      setAccessStatus(status);
      
      if (status.hasAccess) {
        onAccessGranted();
      }
      
      return status; // Return status for interval logic
    } catch (error) {
      console.error("Failed to check access:", error);
      if (!accessStatus) {
        toast.error("Failed to check chat access");
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async () => {
    try {
      setRequesting(true);
      await apiClient.createChatJoinRequest(projectId);
      toast.success("Join request sent. Waiting for admin approval.");
      await checkAccess(); // Refresh status
    } catch (error: any) {
      console.error("Failed to request access:", error);
      toast.error(error.message || "Failed to send join request");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
          <p className="text-xs sm:text-sm text-muted-foreground">Checking access...</p>
        </div>
      </div>
    );
  }

  // User has access - show chat
  if (accessStatus?.hasAccess) {
    return <>{children}</>;
  }

  // User needs to request or is pending
  return (
    <div className="flex items-center justify-center h-full p-3 sm:p-4 md:p-6">
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
            {accessStatus?.status === "pending" && (
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[#25D366]" />
            )}
            {accessStatus?.status === "removed" && (
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            )}
            {accessStatus?.status === "rejected" && (
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
            )}
            {accessStatus?.status === "can_request" && (
              <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            )}
          </div>
          <CardTitle className="text-base sm:text-lg md:text-xl">
            {accessStatus?.status === "pending" && "Join Request Pending"}
            {accessStatus?.status === "removed" && "Access Removed"}
            {accessStatus?.status === "rejected" && "Request Rejected"}
            {accessStatus?.status === "can_request" && "Chat Access Required"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {accessStatus?.status === "pending" && (
              "Your request to join this chat is pending admin approval. You'll be notified once it's approved."
            )}
            {accessStatus?.status === "removed" && (
              "You were removed from this chat by the admin. You can request to rejoin if needed."
            )}
            {accessStatus?.status === "rejected" && (
              "Your previous join request was rejected. You can send a new request."
            )}
            {accessStatus?.status === "can_request" && (
              "This is a private project chat. Request access to join the conversation."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          {accessStatus?.status === "pending" ? (
            <div className="flex items-center gap-1.5 sm:gap-2 p-3 sm:p-4 bg-[#25D366]/10 dark:bg-[#25D366]/20 rounded-lg">
              <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#25D366] flex-shrink-0" />
              <p className="text-xs sm:text-sm text-[#1a8c4a] dark:text-[#25D366]">
                Waiting for admin approval...
              </p>
            </div>
          ) : (
            <Button
              className="w-full text-xs sm:text-sm h-9 sm:h-10"
              onClick={handleRequestAccess}
              disabled={requesting}
            >
              {requesting ? "Sending Request..." : "Request to Join Chat"}
            </Button>
          )}
          
          {(accessStatus?.status === "removed" || accessStatus?.status === "rejected") && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 text-center">
              Note: Admin approval is required to rejoin
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
