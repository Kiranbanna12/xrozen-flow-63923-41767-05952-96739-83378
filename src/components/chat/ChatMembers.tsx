import { useState, useEffect } from "react";
import { Users, Crown, UserMinus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface ChatMembersProps {
  projectId: string;
  currentUserId: string;
  projectCreatorId: string;
  onMemberRemoved?: () => void; // Callback to refresh messages after removal
}

interface Member {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  joined_at: string;
  is_active: boolean;
  user_name?: string;
  user_email?: string;
}

export const ChatMembers = ({ projectId, currentUserId, projectCreatorId, onMemberRemoved }: ChatMembersProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const isAdmin = currentUserId === projectCreatorId;

  useEffect(() => {
    if (open) {
      loadMembers();
    }
  }, [open, projectId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getProjectChatMembers(projectId);
      
      // Enrich member data with user profiles
      const enrichedMembers = await Promise.all(
        response.map(async (member: Member) => {
          if (member.user_id) {
            try {
              const profile = await apiClient.getProfile(member.user_id);
              return {
                ...member,
                user_name: profile.full_name || profile.email,
                user_email: profile.email,
              };
            } catch (error) {
              console.error("Failed to load profile for member:", member.user_id, error);
              return member;
            }
          }
          return member;
        })
      );

      setMembers(enrichedMembers);
    } catch (error) {
      console.error("Failed to load members:", error);
      toast.error("Failed to load chat members");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await apiClient.removeChatMember(projectId, memberId);
      toast.success("Member removed from chat");
      setMembers(members.filter(m => m.id !== memberId));
      setRemoveMemberId(null);
      
      // Call the callback to refresh messages and show system notification
      if (onMemberRemoved) {
        onMemberRemoved();
      }
    } catch (error: any) {
      console.error("Failed to remove member:", error);
      toast.error(error.message || "Failed to remove member");
    }
  };

  const getMemberDisplayName = (member: Member) => {
    if (member.user_name) return member.user_name;
    if (member.guest_name) return member.guest_name;
    if (member.user_email) return member.user_email;
    return "Unknown User";
  };

  const getMemberInitials = (member: Member) => {
    const name = getMemberDisplayName(member);
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isMemberAdmin = (member: Member) => {
    return member.user_id === projectCreatorId;
  };

  const formatJoinedDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            {members.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                {members.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Chat Members ({members.length})
            </SheetTitle>
            <SheetDescription>
              {isAdmin ? "You can manage chat members" : "View all chat members"}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No members yet
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getMemberInitials(member)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {getMemberDisplayName(member)}
                        </p>
                        {isMemberAdmin(member) && (
                          <Badge variant="default" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            <Crown className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                        {member.user_id === currentUserId && (
                          <Badge variant="outline" className="gap-1">
                            You
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        Joined {formatJoinedDate(member.joined_at)}
                      </p>
                    </div>

                    {isAdmin && member.user_id !== currentUserId && !isMemberAdmin(member) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setRemoveMemberId(member.id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {isAdmin && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-700">
                  <p className="font-medium">Admin Privileges</p>
                  <p className="text-xs text-yellow-600 mt-1">
                    You can remove members from this chat
                  </p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Remove Member Confirmation Dialog */}
      <AlertDialog open={!!removeMemberId} onOpenChange={(open) => !open && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This member will be removed from the chat and won't be able to send or view messages.
              They can rejoin if they have access to the share link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMemberId && handleRemoveMember(removeMemberId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
