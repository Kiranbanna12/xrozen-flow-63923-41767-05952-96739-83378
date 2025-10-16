import { useState, useEffect } from "react";
import { Search, Users, MessageSquare, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { chatApiClient } from "@/lib/chat-api-client";
import { toast } from "sonner";
import type { Conversation } from "@/types/chat.types";
import { format } from "date-fns";

interface ConversationSelectorProps {
  selectedConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  currentUserId: string;
}

export const ConversationSelector = ({
  selectedConversationId,
  onSelectConversation,
  currentUserId,
}: ConversationSelectorProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await chatApiClient.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      conv.name?.toLowerCase().includes(searchLower) ||
      conv.lastMessage?.content?.toLowerCase().includes(searchLower)
    );
  });

  const ConversationItem = ({ conversation }: { conversation: Conversation }) => {
    const isSelected = conversation.id === selectedConversationId;
    const hasUnread = (conversation.unreadCount || 0) > 0;

    return (
      <button
        onClick={() => onSelectConversation(conversation.id)}
        className={`w-full p-3 flex gap-3 items-start hover:bg-accent/50 transition-colors ${
          isSelected ? "bg-accent" : ""
        }`}
      >
        {/* Avatar */}
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarFallback>
            {conversation.conversation_type === "group" ? (
              <Users className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5" />
            )}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between mb-1">
            <p className={`font-semibold truncate ${hasUnread ? "text-foreground" : "text-muted-foreground"}`}>
              {conversation.name || "Unnamed Chat"}
            </p>
            {conversation.lastMessage && (
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                {format(new Date(conversation.lastMessage.created_at), "HH:mm")}
              </span>
            )}
          </div>

          {conversation.lastMessage && (
            <p className={`text-sm truncate ${hasUnread ? "font-semibold" : "text-muted-foreground"}`}>
              {conversation.lastMessage.content}
            </p>
          )}

          {hasUnread && (
            <Badge variant="default" className="mt-1 h-5 min-w-[20px] flex items-center justify-center">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="w-80 border-r bg-card flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Chats</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Chat</DialogTitle>
              </DialogHeader>
              {/* TODO: Add user search and conversation creation */}
              <p className="text-sm text-muted-foreground">
                Feature coming soon! You can create direct chats and groups.
              </p>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          <div>
            {filteredConversations.map((conversation) => (
              <ConversationItem key={conversation.id} conversation={conversation} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
