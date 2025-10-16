import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageActionsMenu } from "./MessageActionsMenu";
import { MessageStatusTicks } from "./MessageStatusTicks";
import { format } from "date-fns";
import { UserCircle, ChevronDown } from "lucide-react";
import type { Message, MessageStatus } from "@/types/chat.types";

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  currentUserId: string;
  onReply?: (message: Message) => void;
  onReplyPrivately?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onForward?: (message: Message) => void;
  onPin?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onReport?: (messageId: string) => void;
  onInfo?: (messageId: string) => void;
}

export const MessageBubble = ({
  message,
  isOwnMessage,
  currentUserId,
  onReply,
  onReplyPrivately,
  onEdit,
  onDelete,
  onReact,
  onForward,
  onPin,
  onStar,
  onReport,
  onInfo,
}: MessageBubbleProps) => {
  const sender = message.sender;
  const reactions = message.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;

  // WhatsApp color palette for sender names (exact colors)
  // Each sender gets a consistent color based on their user ID hash
  const senderColors = [
    '#00897B', // Teal (default) - Index 0
    '#7CB342', // Green - Index 1
    '#C0CA33', // Lime - Index 2
    '#F57C00', // Orange - Index 3
    '#E53935', // Red - Index 4
    '#8E24AA', // Purple - Index 5
    '#3949AB', // Indigo - Index 6
    '#00ACC1', // Cyan - Index 7
    '#D81B60', // Pink - Index 8
    '#6D4C41', // Brown - Index 9
    '#5E35B1', // Deep Purple - Index 10
    '#1E88E5', // Blue - Index 11
  ];

  // Get consistent color for any sender ID or name
  const getColorForSenderId = (senderId: string | undefined, senderName?: string): string => {
    // Use sender ID or name as unique identifier
    const identifier = senderId || senderName || 'unknown';
    
    // Generate consistent color index using simple but effective hash
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      const char = identifier.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and modulo to get color index (1-11, skip 0 for variety)
    const colorIndex = (Math.abs(hash) % (senderColors.length - 1)) + 1;
    
    // Debug logging
    console.log('🎨 Color Debug:', { 
      identifier: identifier.substring(0, 12) + '...',
      hash: hash,
      colorIndex: colorIndex,
      color: senderColors[colorIndex]
    });
    
    return senderColors[colorIndex];
  };

  // Get color for current message sender
  const getSenderColor = () => {
    if (isOwnMessage) return '#00897B';
    
    // Try multiple sources for unique identifier
    const senderId = message.sender_id || sender?.id;
    const senderName = sender?.full_name || sender?.email || (message as any).sender_name;
    
    console.log('🎨 Sender Info:', { 
      senderId: senderId?.substring(0, 10),
      senderName,
      isOwnMessage 
    });
    
    return getColorForSenderId(senderId, senderName);
  };

  // Get sender name with multiple fallbacks
  const getSenderName = () => {
    if (isOwnMessage) return 'You';
    
    // Try multiple sources for sender name
    return sender?.full_name 
      || sender?.email?.split('@')[0] 
      || (message as any).sender_name 
      || 'User';
  };

  // Get sender initials for avatar
  const getSenderInitials = () => {
    const name = getSenderName();
    
    if (name === 'You') return 'Y';
    
    // If name has multiple words, use first letter of each word (max 2)
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    
    // Single word or email - use first letter
    return name.charAt(0).toUpperCase();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} px-1 md:px-3 py-0.5`}>
      <div className="flex gap-2 max-w-[85%] md:max-w-[75%] lg:max-w-[65%] group">
        {/* Avatar for other users - WhatsApp style circular with dynamic color */}
        {!isOwnMessage && (
          <Avatar className="h-8 w-8 mt-0.5 flex-shrink-0 ring-1 ring-border/20">
            <AvatarImage 
              src={sender?.avatar_url} 
              className="object-cover"
            />
            <AvatarFallback 
              className="text-white font-semibold text-sm"
              style={{ backgroundColor: getSenderColor() }}
            >
              {getSenderInitials()}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="flex-1 flex flex-col gap-0.5">
          {/* Reply Reference - WhatsApp Professional Style */}
          {message.reply_to && (
            <div 
              className={`mb-1 px-2.5 py-1.5 rounded-md border-l-4 cursor-pointer hover:bg-black/5 transition-colors ${
                isOwnMessage 
                  ? "bg-black/10 border-white/50" 
                  : "bg-white/60 dark:bg-white/10 border-primary"
              }`}
              onClick={() => onReply?.(message.reply_to!)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Replied to Name - with dynamic color based on their ID */}
                  <p 
                    className="text-[12px] font-semibold mb-0.5 truncate"
                    style={{ 
                      color: message.reply_to.sender_id === currentUserId 
                        ? (isOwnMessage ? 'rgba(255,255,255,0.9)' : '#00897B')
                        : (isOwnMessage ? 'rgba(255,255,255,0.8)' : getColorForSenderId(message.reply_to.sender_id))
                    }}
                  >
                    {message.reply_to.sender_id === currentUserId 
                      ? 'You' 
                      : (message.reply_to.sender?.full_name || message.reply_to.sender?.email?.split('@')[0] || 'User')
                    }
                  </p>
                  {/* Replied Message Content */}
                  <p 
                    className={`text-[13px] leading-[18px] line-clamp-2 ${
                      isOwnMessage ? "text-white/70" : "text-foreground/70"
                    }`}
                  >
                    {message.reply_to.content}
                  </p>
                </div>
                {/* Reply Icon */}
                <div className={`flex-shrink-0 ${isOwnMessage ? "text-white/40" : "text-muted-foreground/40"}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 10l-5 5 5 5"/>
                    <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Message Content - Responsive */}
          <div className={`relative rounded-lg px-2.5 sm:px-3 py-1.5 ${
            isOwnMessage 
              ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-foreground dark:text-white pl-7 sm:pl-8 pr-2" 
              : "bg-muted pl-2 pr-7 sm:pr-8"
          } ${message.is_pinned ? 'ring-2 ring-yellow-400' : ''}`}>
            {/* Pinned Indicator */}
            {message.is_pinned && (
              <div className="absolute -top-2 left-1.5 sm:left-2 bg-yellow-400 text-yellow-900 text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-semibold">
                Pinned
              </div>
            )}

            {/* WhatsApp-style inline Actions Menu */}
            <div className={`absolute top-1 ${isOwnMessage ? "left-1.5" : "right-1.5"}`}>
              <MessageActionsMenu
                isOwnMessage={isOwnMessage}
                isPinned={message.is_pinned}
                isStarred={message.is_starred}
                onReply={() => onReply?.(message)}
                onReplyPrivately={() => onReplyPrivately?.(message)}
                onCopy={handleCopy}
                onReact={() => {}}
                onForward={() => onForward?.(message)}
                onPin={() => onPin?.(message.id)}
                onStar={() => onStar?.(message.id)}
                onEdit={isOwnMessage ? () => onEdit?.(message) : undefined}
                onDelete={() => onDelete?.(message.id)}
                onReport={!isOwnMessage ? () => onReport?.(message.id) : undefined}
                onInfo={isOwnMessage ? () => onInfo?.(message.id) : undefined}
              />
            </div>
            
            {/* Sender Name - Inside bubble (WhatsApp style with dynamic colors) */}
            {!isOwnMessage && (
              <p className="text-xs sm:text-[13px] font-semibold mb-0.5" style={{ color: getSenderColor() }}>
                {getSenderName()}
              </p>
            )}

            {/* File Attachment Preview - WhatsApp style */}
            {message.file_url && (
              <div className="mb-1">
                {message.message_type?.startsWith("image") ? (
                  <img
                    src={message.file_url}
                    alt="Attachment"
                    className="rounded-md max-w-full h-auto max-h-48 sm:max-h-60 object-cover"
                  />
                ) : (
                  <div className="flex items-center gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-background/20 rounded-md">
                    <span className="text-xs sm:text-[13px]">📎 File attachment</span>
                  </div>
                )}
              </div>
            )}

            {/* Message Text with inline timestamp - WhatsApp style - Responsive */}
            <div className="flex items-end gap-0.5 sm:gap-1">
              <p className="text-[13px] sm:text-[14.2px] leading-[17px] sm:leading-[19px] break-words whitespace-pre-wrap flex-1">{message.content}</p>
              
              {/* Timestamp & Status - Inline right side */}
              <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5 sm:ml-1 pb-[1px]">
                {(message as any).sending && (
                  <span className="text-[9px] sm:text-[10px] opacity-70">⏱</span>
                )}
                <span className={`text-[10px] sm:text-[11px] leading-[14px] sm:leading-[15px] whitespace-nowrap ${
                  isOwnMessage ? "text-gray-600 dark:text-gray-300" : "text-muted-foreground/80"
                }`}>
                  {format(new Date(message.created_at), "HH:mm")}
                </span>
                {isOwnMessage && !(message as any).sending && (
                  <MessageStatusTicks 
                    status={(message.status as MessageStatus) || 'delivered'}
                    readBy={message.read_by}
                    deliveredTo={message.delivered_to}
                    readCount={message.read_by?.length}
                    deliveredCount={message.delivered_to?.length}
                  />
                )}
                {message.is_starred && (
                  <span className="text-yellow-400 text-[10px]">⭐</span>
                )}
              </div>
            </div>
          </div>

          {/* Reactions - WhatsApp style - Responsive */}
          {hasReactions && (
            <div className={`flex gap-0.5 sm:gap-1 ${isOwnMessage ? "justify-end" : "justify-start"} -mt-1`}>
              {Object.entries(reactions).map(([emoji, userIds]: [string, any]) => (
                <button
                  key={emoji}
                  onClick={() => onReact?.(message.id, emoji)}
                  className="flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 bg-background/90 border border-border rounded-full text-xs sm:text-[13px] hover:bg-accent/50 transition-colors shadow-sm"
                >
                  <span className="text-sm sm:text-base">{emoji}</span>
                  {Array.isArray(userIds) && userIds.length > 1 && (
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">{userIds.length}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
