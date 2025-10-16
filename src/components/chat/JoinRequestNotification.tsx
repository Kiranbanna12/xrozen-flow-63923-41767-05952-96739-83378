import { useState } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface JoinRequest {
  id: string;
  user_id: string;
  user_name?: string;
  requested_at: string;
}

interface JoinRequestNotificationProps {
  request: JoinRequest;
  projectId: string;
  onRequestProcessed: () => void;
}

export const JoinRequestNotification = ({
  request,
  projectId,
  onRequestProcessed,
}: JoinRequestNotificationProps) => {
  const [processing, setProcessing] = useState(false);
  
  console.log('🔔 Rendering JoinRequestNotification:', {
    requestId: request.id,
    userName: request.user_name,
    projectId
  });

  const handleApprove = async () => {
    try {
      setProcessing(true);
      await apiClient.approveChatJoinRequest(projectId, request.id);
      toast.success("Join request approved");
      onRequestProcessed();
    } catch (error: any) {
      console.error("Failed to approve request:", error);
      toast.error(error.message || "Failed to approve request");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    try {
      setProcessing(true);
      await apiClient.rejectChatJoinRequest(projectId, request.id);
      toast.success("Join request rejected");
      onRequestProcessed();
    } catch (error: any) {
      console.error("Failed to reject request:", error);
      toast.error(error.message || "Failed to reject request");
    } finally {
      setProcessing(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="mb-3 sm:mb-3.5 md:mb-4 p-2.5 sm:p-3 md:p-4 border-2 border-[#25D366]/30 bg-gradient-to-r from-[#25D366]/10 to-[#25D366]/5 dark:from-[#25D366]/20 dark:to-[#25D366]/10 dark:border-[#25D366]/40 rounded-lg sm:rounded-xl shadow-sm">
      <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-[#25D366]/20 dark:bg-[#25D366]/30 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-[#25D366] dark:text-[#25D366]" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2 mb-1">
            <span className="font-semibold text-foreground text-sm sm:text-base truncate">
              {request.user_name || "User"}
            </span>
            <span className="text-xs sm:text-sm text-muted-foreground">
              requested to join
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] sm:text-xs">
              {formatTime(request.requested_at)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700 text-white h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
            onClick={handleApprove}
            disabled={processing}
          >
            <Check className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Approve</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
            onClick={handleReject}
            disabled={processing}
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
            <span className="hidden sm:inline">Reject</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
