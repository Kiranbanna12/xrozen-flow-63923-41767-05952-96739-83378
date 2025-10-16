import { useState, useEffect } from 'react';
import { Phone, Video, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface Member {
  user_id: string;
  full_name?: string;
  email?: string;
  is_active: boolean;
}

interface CallMemberSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectCreatorId?: string;
  currentUserId: string;
  onSelectMember: (memberId: string, memberName: string, callType: 'audio' | 'video') => void;
}

export const CallMemberSelector = ({
  isOpen,
  onClose,
  projectId,
  projectCreatorId,
  currentUserId,
  onSelectMember,
}: CallMemberSelectorProps) => {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCallType, setSelectedCallType] = useState<'audio' | 'video'>('audio');

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, projectId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      // Get chat members
      const chatMembers = await apiClient.getProjectChatMembers(projectId);
      
      // Get profiles for all members
      const memberProfiles = await Promise.all(
        chatMembers.map(async (member: any) => {
          try {
            const profile = await apiClient.getProfile(member.user_id);
            return {
              user_id: member.user_id,
              full_name: profile.full_name,
              email: profile.email,
              is_active: member.is_active,
            };
          } catch (error) {
            console.error('Failed to load profile:', error);
            return {
              user_id: member.user_id,
              full_name: 'Unknown',
              email: '',
              is_active: member.is_active,
            };
          }
        })
      );

      // Add project creator if not already in list
      if (projectCreatorId && !memberProfiles.find(m => m.user_id === projectCreatorId)) {
        try {
          const creatorProfile = await apiClient.getProfile(projectCreatorId);
          memberProfiles.unshift({
            user_id: projectCreatorId,
            full_name: creatorProfile.full_name,
            email: creatorProfile.email,
            is_active: true,
          });
        } catch (error) {
          console.error('Failed to load creator profile:', error);
        }
      }

      // Filter out current user and inactive members
      const activeMembers = memberProfiles.filter(
        m => m.user_id !== currentUserId && m.is_active
      );

      setMembers(activeMembers);
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMember = (member: Member) => {
    const memberName = member.full_name || member.email || 'Unknown';
    onSelectMember(member.user_id, memberName, selectedCallType);
    onClose();
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Member to Call</DialogTitle>
          <DialogDescription>
            Choose a member to start an audio or video call
          </DialogDescription>
        </DialogHeader>

        {/* Call Type Selection */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={selectedCallType === 'audio' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setSelectedCallType('audio')}
          >
            <Phone className="h-4 w-4 mr-2" />
            Audio Call
          </Button>
          <Button
            variant={selectedCallType === 'video' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setSelectedCallType('video')}
          >
            <Video className="h-4 w-4 mr-2" />
            Video Call
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No members available to call</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleSelectMember(member)}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(member.full_name || member.email || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.full_name || member.email}
                    </p>
                    {member.full_name && member.email && (
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    )}
                  </div>
                  {selectedCallType === 'audio' ? (
                    <Phone className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Video className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
