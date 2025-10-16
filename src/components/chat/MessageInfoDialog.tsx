/**
 * Message Info Dialog
 * Shows detailed delivery and read status for a message
 */

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck } from 'lucide-react';
import { chatApiClient } from '@/lib/chat-api-client';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MessageInfoDialogProps {
  messageId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MessageInfoDialog = ({ messageId, open, onOpenChange }: MessageInfoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{
    delivered_to: Array<{ user_id: string; timestamp: string; user: any }>;
    read_by: Array<{ user_id: string; timestamp: string; user: any }>;
  } | null>(null);

  useEffect(() => {
    if (open && messageId) {
      loadMessageInfo();
    }
  }, [open, messageId]);

  const loadMessageInfo = async () => {
    if (!messageId) return;
    
    setLoading(true);
    try {
      const data = await chatApiClient.getMessageInfo(messageId);
      setInfo(data);
    } catch (error) {
      console.error('Failed to load message info:', error);
    } finally {
      setLoading(false);
    }
  };

  const UserItem = ({ user, timestamp }: { user: any; timestamp: string }) => (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-accent/50 rounded-lg transition-colors">
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.avatar_url} />
        <AvatarFallback>
          {user.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-medium">{user.full_name || user.email}</p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(timestamp), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Message Info</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : info ? (
          <Tabs defaultValue="read" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="read" className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-[#25D366]" />
                Read ({info.read_by.length})
              </TabsTrigger>
              <TabsTrigger value="delivered" className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-[#25D366]" />
                Delivered ({info.delivered_to.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="read">
              <ScrollArea className="h-[300px] pr-4">
                {info.read_by.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No one has read this message yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {info.read_by.map((item) => (
                      <UserItem key={item.user_id} user={item.user} timestamp={item.timestamp} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="delivered">
              <ScrollArea className="h-[300px] pr-4">
                {info.delivered_to.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Message not delivered yet
                  </p>
                ) : (
                  <div className="space-y-1">
                    {info.delivered_to.map((item) => (
                      <UserItem key={item.user_id} user={item.user} timestamp={item.timestamp} />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-center py-8 text-muted-foreground">
            Failed to load message info
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
