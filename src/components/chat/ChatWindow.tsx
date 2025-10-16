import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { MessageInfoDialog } from "./MessageInfoDialog";
import { SystemMessage } from "./SystemMessage";
import { ChatMembers } from "./ChatMembers";
import { JoinRequestNotification } from "./JoinRequestNotification";
import { ChatBackground } from "./ChatBackground";
import { ChatSearch } from "./ChatSearch";
import { CallDialog } from "./CallDialog";
import { CallMemberSelector } from "./CallMemberSelector";
import { DateSeparator } from "./DateSeparator";
import { MoreVertical, Search, Phone, Video, ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { chatApiClient } from "@/lib/chat-api-client";
import { useRealtimeChat } from "@/hooks/useRealtimeChat";
import { useWebRTC } from "@/hooks/useWebRTC";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

interface ChatWindowProps {
  projectId: string;
  projectName: string;
  currentUserId: string;
  projectCreatorId?: string;
  onBack?: () => void;
}

export const ChatWindow = ({ projectId, projectName, currentUserId, projectCreatorId, onBack }: ChatWindowProps) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const [messageInfoOpen, setMessageInfoOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [isChatMember, setIsChatMember] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [onlineMembers, setOnlineMembers] = useState<Set<string>>(new Set());
  const [totalMembers, setTotalMembers] = useState(0);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callerName: string; callType: 'audio' | 'video' } | null>(null);
  const [memberSelectorOpen, setMemberSelectorOpen] = useState(false);
  const [pendingCallType, setPendingCallType] = useState<'audio' | 'video'>('audio');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const isAdmin = currentUserId === projectCreatorId;
  // NEW: Creator is always a member, OR check if user is in chat members list
  const canApproveRequests = isAdmin || isChatMember;
  
  // Debug logs
  console.log('🔧 ChatWindow Props:', {
    projectId,
    projectName,
    currentUserId,
    projectCreatorId,
    isAdmin,
    isChatMember,
    canApproveRequests,
    joinRequestsCount: joinRequests.length
  });

  // Store sendCallSignal ref
  const sendCallSignalRef = useRef<((signal: any) => void) | null>(null);

  // WebRTC hook for audio/video calls
  const webrtc = useWebRTC({
    sendSignal: (signal) => {
      if (sendCallSignalRef.current) {
        sendCallSignalRef.current(signal);
      }
    },
    onIncomingCall: (callerId, callerName, callType) => {
      console.log('📞 Incoming call from:', callerName, callType);
      setIncomingCall({ callerId, callerName, callType });
      setCallDialogOpen(true);
    },
    onCallEnded: () => {
      console.log('📞 Call ended');
      setCallDialogOpen(false);
      setIncomingCall(null);
    },
  });

  // Real-time chat hook
  const { isConnected, sendTypingIndicator, sendPresence, sendMessageStatus, sendCallSignal } = useRealtimeChat({
    conversationId: projectId,
    onNewMessage: (newMessage) => {
      console.log('🔧 ChatWindow: New message received via WebSocket:', newMessage);
      setMessages((prev) => {
        // Check if message already exists to prevent duplicates
        const existingMessage = prev.find(msg => 
          msg.id === newMessage.id || 
          (msg.content === newMessage.content && msg.sender_id === newMessage.sender_id && msg.sending)
        );
        
        if (existingMessage) {
          console.log('🔧 ChatWindow: Message already exists or is temporary, updating');
          return prev.map(msg => {
            if (msg.id === newMessage.id) {
              return { ...newMessage, sending: false };
            }
            if (msg.sending && msg.content === newMessage.content && msg.sender_id === newMessage.sender_id) {
              return { ...newMessage, sending: false };
            }
            return msg;
          });
        }
        
        console.log('🔧 ChatWindow: Adding new message to list');
        return [...prev, { ...newMessage, sending: false }];
      });
      // Scroll to bottom when new message arrives
      setTimeout(scrollToBottom, 100);
    },
    onMessageUpdate: (updatedMessage) => {
      console.log('🔧 ChatWindow: Message updated via WebSocket:', updatedMessage);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === updatedMessage.id ? updatedMessage : msg))
      );
    },
    onMessageDelete: (messageId) => {
      console.log('🔧 ChatWindow: Message deleted via WebSocket:', messageId);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    },
    onTypingChange: (typing) => {
      console.log('🔧 ChatWindow: Typing status changed:', typing);
      setTypingUsers(typing);
      
      // Update online members based on typing activity
      const onlineUserIds = new Set<string>();
      onlineUserIds.add(currentUserId); // Current user is always online
      
      // Add typing users to online set
      typing.forEach((user: any) => {
        if (user.user_id) onlineUserIds.add(user.user_id);
      });
      
      setOnlineMembers(onlineUserIds);
    },
    onJoinRequest: (data) => {
      console.log('🔧 ChatWindow: Join request received:', data);
      loadJoinRequests(); // Reload requests for all members
      loadMessages(); // Reload messages to show system message
      setTimeout(scrollToBottom, 100); // Scroll to show notification
    },
    onRequestApproved: (data) => {
      console.log('🔧 ChatWindow: Request approved:', data);
      loadJoinRequests(); // Reload requests to remove approved request
      loadMessages(); // Reload messages to show approval message
      checkChatMembership(); // Recheck membership in case current user was approved
      setTimeout(scrollToBottom, 100); // Scroll to show notification
      
      // If current user was approved, show success message
      if (data.user_id === currentUserId) {
        toast.success(`You have been approved by ${data.approved_by_name || 'admin'}`);
      }
    },
    onRequestRejected: (data) => {
      console.log('🔧 ChatWindow: Request rejected:', data);
      loadJoinRequests(); // Reload requests to remove rejected request
      
      // If current user was rejected, they need to see updated status
      if (data.user_id === currentUserId) {
        toast.error("Your join request was rejected");
        // Reload to show updated access gate
        window.location.reload();
      }
    },
    onMemberRemoved: (data) => {
      console.log('🔧 ChatWindow: Member removed:', data);
      loadMessages(); // Reload messages to show system message
      setTimeout(scrollToBottom, 100); // Scroll to show notification
      // If current user was removed, they need to be kicked out
      if (data.user_id === currentUserId) {
        toast.error("You have been removed from this chat");
        // Reload to show access gate
        window.location.reload();
      }
    },
    onPresenceChange: (onlineUsers) => {
      console.log('🔧 ChatWindow: Presence changed:', onlineUsers);
      console.log('🔧 ChatWindow: Online users array:', onlineUsers);
      console.log('🔧 ChatWindow: Online users count:', onlineUsers?.length || 0);
      
      // Update online members with proper Set - always include current user
      if (Array.isArray(onlineUsers)) {
        const onlineSet = new Set(onlineUsers);
        // Always include current user as online
        onlineSet.add(currentUserId);
        setOnlineMembers(onlineSet);
        console.log('🔧 ChatWindow: Updated online members:', onlineSet.size);
      }
    },
    onMessageStatusChange: (data) => {
      console.log('🔧 ChatWindow: Message status changed:', data);
      console.log('🔧 ChatWindow: Status data:', { messageId: data.messageId, status: data.status, userId: data.userId });
      
      // Update message status in local state with proper tracking
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === data.messageId) {
            const updatedMsg = { ...msg };
            
            // Ensure arrays are initialized
            const delivered_to = Array.isArray(updatedMsg.delivered_to) ? [...updatedMsg.delivered_to] : [];
            const read_by = Array.isArray(updatedMsg.read_by) ? [...updatedMsg.read_by] : [];
            
            if (data.status === 'delivered') {
              // Add user to delivered_to array if not already there
              if (!delivered_to.includes(data.userId)) {
                delivered_to.push(data.userId);
                updatedMsg.delivered_to = delivered_to;
                console.log('🔧 Updated delivered_to:', delivered_to);
              }
              
              // Update status to delivered if at least one person received it
              if (delivered_to.length > 0) {
                updatedMsg.status = 'delivered';
              }
            } else if (data.status === 'read') {
              // Add user to both arrays if not present
              if (!delivered_to.includes(data.userId)) {
                delivered_to.push(data.userId);
                updatedMsg.delivered_to = delivered_to;
              }
              if (!read_by.includes(data.userId)) {
                read_by.push(data.userId);
                updatedMsg.read_by = read_by;
                console.log('🔧 Updated read_by:', read_by);
              }
              
              // Update status to read
              updatedMsg.status = 'read';
              updatedMsg.is_read = true;
            }
            
            console.log('🔧 Final message status:', { 
              id: updatedMsg.id, 
              status: updatedMsg.status,
              delivered_count: updatedMsg.delivered_to?.length || 0,
              read_count: updatedMsg.read_by?.length || 0
            });
            
            return updatedMsg;
          }
          return msg;
        })
      );
    },
    onCallSignal: (data) => {
      console.log('📞 ChatWindow: Call signal received:', data);
      handleCallSignal(data);
    },
  });

  // Update sendCallSignal ref when it changes
  useEffect(() => {
    sendCallSignalRef.current = sendCallSignal || null;
  }, [sendCallSignal]);

  useEffect(() => {
    loadMessages();
    checkChatMembership();
    loadJoinRequests(); // Load for all users, render conditionally
    
    // Always set current user as online initially
    setOnlineMembers(new Set([currentUserId]));
    
    // Send online presence when component mounts
    if (sendPresence) {
      console.log('🔧 ChatWindow: Sending online presence for project:', projectId);
      sendPresence('online');
      
      // Send presence again after a short delay to ensure WebSocket is ready
      setTimeout(() => {
        sendPresence('online');
      }, 1000);
      
      // Send presence periodically on mobile to keep status updated
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      let presenceInterval: NodeJS.Timeout | null = null;
      
      if (isMobile) {
        presenceInterval = setInterval(() => {
          if (document.visibilityState === 'visible') {
            sendPresence('online');
          }
        }, 30000); // Every 30 seconds
      }
      
      return () => {
        if (presenceInterval) {
          clearInterval(presenceInterval);
        }
      };
    }
    
    // Mark project as read when chat is opened
    markProjectRead();
    
    // Send offline presence when component unmounts
    return () => {
      if (sendPresence) {
        console.log('🔧 ChatWindow: Sending offline presence for project:', projectId);
        sendPresence('offline');
      }
    };
  }, [projectId, sendPresence, currentUserId]);

  // Polling fallback for mobile when WebSocket is disconnected
  useEffect(() => {
    let pollingInterval: NodeJS.Timeout | null = null;

    // Only enable polling on mobile or when WebSocket is disconnected
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    if (isMobile || !isConnected) {
      console.log('🔧 ChatWindow: Starting polling fallback for mobile/disconnected state');
      
      // Poll every 3 seconds for new messages
      pollingInterval = setInterval(async () => {
        if (!isConnected) {
          console.log('🔧 ChatWindow: Polling for new messages (WebSocket disconnected)');
          try {
            const latestMessages = await chatApiClient.getMessages(projectId);
            
            // Check if there are new messages
            if (latestMessages && latestMessages.length > messages.length) {
              console.log('🔧 ChatWindow: New messages found via polling:', latestMessages.length - messages.length);
              setMessages(latestMessages);
              setTimeout(scrollToBottom, 100);
            }
          } catch (error) {
            console.error('🔧 ChatWindow: Polling error:', error);
          }
        }
      }, 3000);
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [projectId, isConnected, messages.length]);

  // Handle visibility change for mobile browsers
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('🔧 ChatWindow: Page became visible, refreshing messages');
        // Reload messages when page becomes visible (mobile app switching)
        loadMessages();
        loadJoinRequests();
        
        // Resend presence
        if (sendPresence) {
          sendPresence('online');
        }
      }
    };

    const handleFocus = () => {
      console.log('🔧 ChatWindow: Window focused, refreshing messages');
      // Reload when window gets focus
      loadMessages();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [projectId, sendPresence]);

  // Mark project as read
  const markProjectRead = async () => {
    try {
      await apiClient.markProjectAsRead(projectId);
      console.log('✅ Project marked as read');
      
      // Trigger notification update in sidebar and chat list
      // This will cause other components to refresh their unread counts
      window.dispatchEvent(new CustomEvent('chat:read', { detail: { projectId } }));
    } catch (error) {
      console.error('Failed to mark project as read:', error);
    }
  };

  // Handle incoming call signals
  const handleCallSignal = (data: any) => {
    console.log('📞 Processing call signal:', data);
    
    // Ignore signals from self
    if (data.senderId === currentUserId) {
      console.log('📞 Ignoring signal from self');
      return;
    }
    
    switch (data.type) {
      case 'call-offer':
        // Incoming call - only process if not already in a call
        if (webrtc.callStatus === 'idle') {
          console.log('📞 Received call offer from:', data.senderId);
          setIncomingCall({
            callerId: data.senderId,
            callerName: data.senderName || 'Unknown',
            callType: data.callType,
          });
          setCallDialogOpen(true);
          // Store offer to answer later
          (window as any).__pendingCallOffer = { offer: data.offer, callType: data.callType };
        } else {
          console.log('📞 Already in a call, rejecting new call');
          // Send busy signal
          if (sendCallSignal) {
            sendCallSignal({
              type: 'call-rejected',
              recipientId: data.senderId,
            });
          }
        }
        break;
        
      case 'call-answer':
        // Call answered by remote peer
        console.log('📞 Call answered by remote peer');
        webrtc.handleAnswer(data.answer);
        break;
        
      case 'ice-candidate':
        // ICE candidate
        console.log('📞 Received ICE candidate');
        webrtc.handleIceCandidate(data.candidate);
        break;
        
      case 'call-rejected':
        // Call rejected
        console.log('📞 Call rejected by remote peer');
        toast.error('Call was rejected');
        webrtc.endCall();
        setCallDialogOpen(false);
        setIncomingCall(null);
        break;
        
      case 'call-ended':
        // Call ended by remote peer
        console.log('📞 Call ended by remote peer');
        toast.info('Call ended');
        webrtc.endCall();
        setCallDialogOpen(false);
        setIncomingCall(null);
        break;
        
      default:
        console.log('📞 Unknown call signal type:', data.type);
    }
  };

  // Get current user's profile for call signaling
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const profile = await apiClient.getProfile(currentUserId);
        setCurrentUserProfile(profile);
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }
    };
    loadUserProfile();
  }, [currentUserId]);

  // Start audio call - Show member selector
  const handleStartAudioCall = () => {
    setPendingCallType('audio');
    setMemberSelectorOpen(true);
  };

  // Start video call - Show member selector
  const handleStartVideoCall = () => {
    setPendingCallType('video');
    setMemberSelectorOpen(true);
  };

  // Handle member selection for call
  const handleCallMember = async (recipientId: string, recipientName: string, callType: 'audio' | 'video') => {
    try {
      console.log(`📞 ChatWindow: Starting ${callType} call to:`, recipientName);
      console.log('📞 ChatWindow: User agent:', navigator.userAgent);
      console.log('📞 ChatWindow: Protocol:', window.location.protocol);
      console.log('📞 ChatWindow: Hostname:', window.location.hostname);
      
      // Check permissions first
      const device = callType === 'video' ? 'camera and microphone' : 'microphone';
      toast.info(`Requesting ${device} access...`);
      
      console.log('📞 ChatWindow: Requesting permissions...');
      const hasPermission = await webrtc.requestPermissions(callType);
      console.log('📞 ChatWindow: Permission result:', hasPermission);
      
      if (!hasPermission) {
        console.log('📞 ChatWindow: Permission denied or devices not available');
        return;
      }
      
      // Add sender name to the call
      const senderName = currentUserProfile?.full_name || currentUserProfile?.email || 'Unknown';
      
      console.log('📞 ChatWindow: Starting WebRTC call...');
      // Start the call
      await webrtc.startCall(recipientId, recipientName, callType);
      
      // Update signal with sender info
      if (sendCallSignal) {
        sendCallSignal({
          senderName,
          senderId: currentUserId,
        });
      }
      
      setCallDialogOpen(true);
      toast.success(`Calling ${recipientName}...`);
      console.log('📞 ChatWindow: Call started successfully');
    } catch (error: any) {
      console.error('📞 ChatWindow: Failed to start call:', error);
      console.error('📞 ChatWindow: Error details:', {
        name: error?.name,
        message: error?.message
      });
      const device = callType === 'video' ? 'camera/microphone' : 'microphone';
      toast.error(`Failed to start call. Please allow ${device} access.`);
    }
  };

  // Mark messages as delivered/read when they appear in view
  useEffect(() => {
    if (!sendMessageStatus || !isConnected) return;
    
    // Process only visible messages from others
    const messagesToProcess = messages.filter(msg => msg.sender_id !== currentUserId);
    
    messagesToProcess.forEach((message) => {
      const delivered_to = Array.isArray(message.delivered_to) ? message.delivered_to : [];
      const read_by = Array.isArray(message.read_by) ? message.read_by : [];
      
      // Mark as delivered immediately if not already
      if (!delivered_to.includes(currentUserId)) {
        console.log('🔧 ChatWindow: Marking message as delivered:', message.id);
        sendMessageStatus(message.id, 'delivered');
      }
    });
    
    // Mark as read after a delay (simulate reading time)
    const readTimer = setTimeout(() => {
      messagesToProcess.forEach((message) => {
        const read_by = Array.isArray(message.read_by) ? message.read_by : [];
        
        if (!read_by.includes(currentUserId)) {
          console.log('🔧 ChatWindow: Marking message as read:', message.id);
          sendMessageStatus(message.id, 'read');
        }
      });
    }, 1500); // 1.5 second delay
    
    return () => clearTimeout(readTimer);
  }, [messages.length, currentUserId, sendMessageStatus, isConnected]); // Only trigger when message count changes

  const checkChatMembership = async () => {
    try {
      const members = await apiClient.getProjectChatMembers(projectId);
      const isMember = members.some((m: any) => m.user_id === currentUserId && m.is_active);
      console.log('🔧 ChatWindow: Chat membership check:', { isMember, currentUserId, membersCount: members.length });
      setIsChatMember(isMember);
      
      // Set total members count (including creator)
      setTotalMembers(members.length + 1); // +1 for creator
    } catch (error) {
      console.error('Failed to check chat membership:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, joinRequests]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    try {
      const messagesData = await chatApiClient.getMessages(projectId);
      setMessages(messagesData || []);
    } catch (error) {
      console.error("Failed to load messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  };

  const loadJoinRequests = async () => {
    try {
      console.log('🔧 ChatWindow: Loading join requests for project:', projectId);
      const requests = await apiClient.getChatJoinRequests(projectId);
      console.log("📋 Join requests loaded:", requests);
      console.log("📋 Raw requests count:", requests?.length || 0);
      
      // Enrich with user profiles
      const enrichedRequests = await Promise.all(
        requests.map(async (request: any) => {
          if (request.user_id) {
            try {
              const profile = await apiClient.getProfile(request.user_id);
              return {
                ...request,
                user_name: profile.full_name || profile.email,
              };
            } catch (error) {
              console.error("Failed to load profile:", error);
              return request;
            }
          }
          return request;
        })
      );
      
      console.log("📋 Enriched requests:", enrichedRequests);
      setJoinRequests(enrichedRequests);
    } catch (error) {
      console.error("Failed to load join requests:", error);
    }
  };

  const handleRequestProcessed = () => {
    loadJoinRequests();
    loadMessages(); // Reload to show system message
    setTimeout(scrollToBottom, 100); // Scroll after messages load
  };

  const handleSendMessage = async (content: string, attachment?: File) => {
    try {
      console.log('🔧 ChatWindow: Sending message:', content);
      
      let attachmentUrl = null;
      let attachmentType = null;

      // TODO: Implement file upload to storage
      // if (attachment) {
      //   const uploadResult = await uploadFile(attachment);
      //   attachmentUrl = uploadResult.url;
      //   attachmentType = attachment.type;
      // }

      if (editingMessage) {
        // Update existing message
        console.log('🔧 ChatWindow: Updating message:', editingMessage.id);
        await chatApiClient.editMessage(editingMessage.id, content);
        setEditingMessage(null);
        await loadMessages(); // Fallback to reload if WebSocket doesn't work
      } else {
        // Create new message
        console.log('🔧 ChatWindow: Creating new message for project:', projectId);
        const messageData = {
          conversation_id: projectId,
          content,
          message_type: attachmentType || 'text',
          file_url: attachmentUrl,
          reply_to_message_id: replyingTo?.id,
        };
        
        console.log('🔧 ChatWindow: Message data:', messageData);
        
        // Optimistic update - add message immediately to UI
        const tempMessage = {
          id: `temp_${Date.now()}`,
          content,
          sender_id: currentUserId,
          recipient_id: null,
          project_id: projectId,
          message_type: attachmentType || 'text',
          file_url: attachmentUrl,
          reply_to_message_id: replyingTo?.id,
          is_read: false,
          created_at: new Date().toISOString(),
          sender_name: 'You',
          recipient_name: null,
          sending: true // Flag to show it's being sent
        };
        
        console.log('🔧 ChatWindow: Adding optimistic message:', tempMessage.id);
        setMessages(prev => [...prev, tempMessage]);
        setReplyingTo(null);
        
        try {
          const newMessage = await chatApiClient.sendMessage(messageData);
          console.log('🔧 ChatWindow: Message sent successfully:', newMessage);
          
          // Replace temporary message with real message
          setMessages(prev => 
            prev.map(msg => 
              msg.id === tempMessage.id ? { ...newMessage, sending: false } : msg
            )
          );
          
          // Trigger notification update for other users
          // WebSocket will handle this automatically, but we can also trigger local update
          console.log('🔔 Message sent, triggering notification update');
        } catch (sendError) {
          console.error('🔧 ChatWindow: Failed to send message:', sendError);
          // Remove the temporary message on error
          setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
          throw sendError;
        }
      }
    } catch (error) {
      console.error("🔧 ChatWindow: Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      await chatApiClient.deleteMessage(messageToDelete);
      await loadMessages();
      toast.success("Message deleted");
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      await chatApiClient.reactToMessage(messageId, emoji);
      await loadMessages();
    } catch (error) {
      console.error("Failed to add reaction:", error);
      toast.error("Failed to add reaction");
    }
  };

  const handlePin = async (messageId: string) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      await chatApiClient.pinMessage(messageId);
      await loadMessages();
      toast.success(message?.is_pinned ? "Message unpinned" : "Message pinned");
    } catch (error) {
      console.error("Failed to pin message:", error);
      toast.error("Failed to pin message");
    }
  };

  const handleStar = async (messageId: string) => {
    try {
      const message = messages.find((m) => m.id === messageId);
      await chatApiClient.starMessage(messageId);
      await loadMessages();
      toast.success(message?.is_starred ? "Message unstarred" : "Message starred");
    } catch (error) {
      console.error("Failed to star message:", error);
      toast.error("Failed to star message");
    }
  };

  const handleInfo = (messageId: string) => {
    setSelectedMessageId(messageId);
    setMessageInfoOpen(true);
  };

  const handleClearChatHistory = async () => {
    if (!confirm("Are you sure you want to clear chat history? This will only clear messages for you.")) {
      return;
    }
    
    try {
      // In a real implementation, this would mark messages as hidden for this user only
      // For now, just show a message
      toast.info("Clear chat history feature - Coming soon");
      // await apiClient.clearChatHistory(projectId, currentUserId);
      // await loadMessages();
    } catch (error) {
      console.error("Failed to clear chat history:", error);
      toast.error("Failed to clear chat history");
    }
  };

  const handleSearchResultSelect = (messageId: string) => {
    setHighlightedMessageId(messageId);
    
    // Scroll to the message
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Clear highlight after 2 seconds
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Chat Header - WhatsApp Style with Back Button on Mobile - Fixed at Top on Mobile, Sticky on Desktop */}
      <div className="fixed md:sticky top-0 left-0 right-0 border-b bg-card/95 backdrop-blur-sm px-3 sm:px-4 md:px-6 py-3 sm:py-3.5 md:py-4 flex items-center justify-between shadow-sm z-50 w-full max-w-full flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Back Button - Only visible on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden flex-shrink-0 h-8 w-8"
            onClick={() => {
              // Clear selection to go back to chat list
              if (onBack) {
                onBack();
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-xs sm:text-sm md:text-base truncate">{projectName}</h2>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <p className="text-[10px] sm:text-xs text-muted-foreground">Project Chat</p>
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} flex-shrink-0`} 
                   title={isConnected ? 'Connected' : 'Disconnected'} />
              <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {isConnected 
                  ? (onlineMembers.size > 0 
                      ? `${onlineMembers.size} online${totalMembers > 0 ? ` of ${totalMembers}` : ''}`
                      : 'Online')
                  : 'Connecting...'
                }
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-0.5 sm:gap-1 md:gap-2 flex-shrink-0">
          {/* Members List */}
          {projectCreatorId && (
            <ChatMembers
              projectId={projectId}
              currentUserId={currentUserId}
              projectCreatorId={projectCreatorId}
              onMemberRemoved={loadMessages}
            />
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={handleStartAudioCall}
            title="Start audio call"
          >
            <Phone className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
            onClick={handleStartVideoCall}
            title="Start video call"
          >
            <Video className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                <MoreVertical className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toast.info("View project details - Coming soon")}>
                View project details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Already available in header")}>
                Manage participants
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleClearChatHistory()}>
                Clear chat history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* WhatsApp-Style Search - Fixed Below Header */}
      {searchOpen && (
        <div className="fixed top-[60px] left-0 right-0 z-40 bg-background dark:bg-background border-b shadow-sm">
          <ChatSearch
            messages={messages}
            onResultSelect={handleSearchResultSelect}
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
          />
        </div>
      )}

      {/* Messages Area - Responsive with padding for sticky header and fixed input */}
      <div 
        className="flex-1 w-full overflow-y-auto overflow-x-hidden px-2 sm:px-3 md:px-6 pt-16 md:pt-0 pb-20 md:pb-0" 
        style={{ 
          paddingTop: searchOpen ? '120px' : undefined
        }}
      >
        {/* Join Requests - Responsive */}
        {canApproveRequests && joinRequests.length > 0 && (
          <div className="px-1 sm:px-2 md:px-4 pt-3 sm:pt-3.5 md:pt-4 pb-2">
            {joinRequests.map((request) => (
              <JoinRequestNotification
                key={request.id}
                request={request}
                projectId={projectId}
                onRequestProcessed={handleRequestProcessed}
              />
            ))}
          </div>
        )}
        
        {/* Debug: Show if can't see requests - Responsive */}
        {!canApproveRequests && joinRequests.length > 0 && (
          <div className="px-1 sm:px-2 md:px-4 pt-3 sm:pt-3.5 md:pt-4 pb-2">
            <div className="p-2 sm:p-2.5 md:p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-xs sm:text-sm">
              <p className="text-yellow-800 dark:text-yellow-200">
                {joinRequests.length} pending request(s). You need to be a chat member to approve.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2 sm:space-y-3 md:space-y-4 py-2 sm:py-3 md:py-4">

          {messages.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12 text-xs sm:text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((message, index) => {
              // Check if we need to show a date separator
              const showDateSeparator = index === 0 || 
                new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString();
              
              return (
                <div key={message.id}>
                  {/* Date Separator */}
                  {showDateSeparator && (
                    <DateSeparator date={message.created_at} />
                  )}
                  
                  {/* Render system messages differently */}
                  {message.is_system_message ? (
                    (() => {
                      try {
                        const data = message.system_message_data 
                          ? JSON.parse(message.system_message_data)
                          : { type: message.system_message_type, user_name: 'User' };
                        
                        return (
                          <SystemMessage
                            type={data.type || message.system_message_type}
                            userName={data.user_name || 'User'}
                            timestamp={message.created_at}
                          />
                        );
                      } catch (error) {
                        console.error('Failed to parse system message:', error);
                        return null;
                      }
                    })()
                  ) : (
                    // Render regular messages
                    <div 
                      id={`message-${message.id}`}
                      className={highlightedMessageId === message.id ? "animate-pulse bg-yellow-100 dark:bg-yellow-900/20 rounded-lg transition-colors" : ""}
                    >
                      <MessageBubble
                        message={message}
                        currentUserId={currentUserId}
                        isOwnMessage={message.sender_id === currentUserId}
                        onReply={setReplyingTo}
                        onEdit={setEditingMessage}
                        onDelete={(id) => {
                          setMessageToDelete(id);
                          setDeleteDialogOpen(true);
                        }}
                        onReact={handleReact}
                        onPin={handlePin}
                        onStar={handleStar}
                        onInfo={handleInfo}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Typing Indicator */}
        <TypingIndicator typingUsers={typingUsers} />
      </div>

      {/* Message Input - Fixed at Bottom on mobile, sticky on desktop */}
      <div className="fixed md:sticky bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-t shadow-lg w-full max-w-full flex-shrink-0 md:mt-auto">
        <MessageInput
          onSend={handleSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          editingMessage={editingMessage}
          onCancelEdit={() => setEditingMessage(null)}
          onTyping={(isTyping) => sendTypingIndicator(isTyping)}
        />
      </div>

      {/* Message Info Dialog */}
      <MessageInfoDialog
        messageId={selectedMessageId || ""}
        open={messageInfoOpen}
        onOpenChange={setMessageInfoOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Member Selector for Calls */}
      <CallMemberSelector
        isOpen={memberSelectorOpen}
        onClose={() => setMemberSelectorOpen(false)}
        projectId={projectId}
        projectCreatorId={projectCreatorId}
        currentUserId={currentUserId}
        onSelectMember={handleCallMember}
      />

      {/* Call Dialog */}
      <CallDialog
        isOpen={callDialogOpen}
        callStatus={incomingCall ? 'ringing' : webrtc.callStatus}
        callType={incomingCall ? incomingCall.callType : webrtc.callType}
        remotePeerInfo={incomingCall ? { id: incomingCall.callerId, name: incomingCall.callerName } : webrtc.remotePeerInfo}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        isMuted={webrtc.isMuted}
        isVideoOff={webrtc.isVideoOff}
        onAnswer={async () => {
          if (incomingCall) {
            try {
              // Get stored offer
              const pendingOffer = (window as any).__pendingCallOffer;
              if (pendingOffer) {
                console.log('📞 Answering call from:', incomingCall.callerName);
                toast.info(`Answering call from ${incomingCall.callerName}...`);
                
                // Answer the call
                await webrtc.answerCall(pendingOffer.offer, pendingOffer.callType);
                
                // Clear pending offer
                delete (window as any).__pendingCallOffer;
                
                // Update UI
                setIncomingCall(null);
              } else {
                toast.error('Call offer expired. Please try again.');
                setCallDialogOpen(false);
                setIncomingCall(null);
              }
            } catch (error) {
              console.error('Failed to answer call:', error);
              toast.error('Failed to answer call. Please check your permissions.');
              setCallDialogOpen(false);
              setIncomingCall(null);
            }
          }
        }}
        onReject={() => {
          console.log('📞 Rejecting call');
          webrtc.rejectCall();
          setCallDialogOpen(false);
          setIncomingCall(null);
          delete (window as any).__pendingCallOffer;
        }}
        onEnd={() => {
          console.log('📞 Ending call');
          webrtc.endCall();
          setCallDialogOpen(false);
          setIncomingCall(null);
          delete (window as any).__pendingCallOffer;
        }}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
      />
    </div>
  );
};
