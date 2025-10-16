import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { chatApiClient } from "@/lib/chat-api-client";

interface ChatJoinDialogProps {
  projectId: string;
  projectName: string;
  shareId?: string;
  onJoinSuccess: () => void;
}

export const ChatJoinDialog = ({
  projectId,
  projectName,
  shareId,
  onJoinSuccess,
}: ChatJoinDialogProps) => {
  const [open, setOpen] = useState(true);
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const currentUser = await apiClient.getCurrentUser();
    
    // If authenticated, no need for guest name
    if (currentUser) {
      await joinChat();
      return;
    }

    // For guest users, validate name
    if (!guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    await joinChat();
  };

  const joinChat = async () => {
    setLoading(true);
    try {
      const currentUser = await apiClient.getCurrentUser();

      // Join the project chat
      const memberData = await apiClient.joinProjectChat({
        project_id: projectId,
        share_id: shareId,
        guest_name: !currentUser ? guestName.trim() : undefined,
      });

      // Send a system message about the join
      const userName = currentUser?.full_name || guestName.trim();
      await chatApiClient.sendSystemMessage(projectId, {
        content: `${userName} joined the chat`,
        message_type: 'system',
        metadata: {
          event: 'user_joined',
          user_name: userName,
        },
      });

      toast.success("You've joined the chat!");
      setOpen(false);
      onJoinSuccess();
    } catch (error: any) {
      console.error("Error joining chat:", error);
      toast.error(error.message || "Failed to join chat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Join Project Chat
          </DialogTitle>
          <DialogDescription>
            Join the conversation for <strong>{projectName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <UserPlus className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Ready to collaborate?</p>
              <p className="text-xs text-muted-foreground">
                Join the chat to discuss this project with the team
              </p>
            </div>
          </div>

          {/* Guest name input - only shown for non-authenticated users */}
          <div className="space-y-2">
            <Label htmlFor="guestName">Your Name (optional if logged in)</Label>
            <Input
              id="guestName"
              placeholder="Enter your name"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              This name will be displayed in the chat
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              onJoinSuccess(); // Still call this to allow viewing without joining
            }}
            disabled={loading}
          >
            View Only
          </Button>
          <Button onClick={handleJoin} disabled={loading} className="gradient-primary">
            {loading ? "Joining..." : "Join Chat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
