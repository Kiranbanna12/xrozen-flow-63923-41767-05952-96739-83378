import { UserPlus, UserMinus, UserCheck, AlertCircle } from "lucide-react";

interface SystemMessageProps {
  type: "join" | "leave" | "join_request" | "join_approved";
  userName: string;
  timestamp: string;
}

export const SystemMessage = ({ type, userName, timestamp }: SystemMessageProps) => {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getMessageContent = () => {
    switch (type) {
      case "join":
        return {
          icon: <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />,
          text: "joined the chat",
        };
      case "leave":
        return {
          icon: <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600" />,
          text: "left the chat",
        };
      case "join_request":
        return {
          icon: <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />,
          text: "requested to join the chat",
        };
      case "join_approved":
        return {
          icon: <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600" />,
          text: "joined the chat",
        };
      default:
        return {
          icon: <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />,
          text: "joined the chat",
        };
    }
  };

  const { icon, text } = getMessageContent();

  return (
    <div className="flex items-center justify-center my-3 sm:my-3.5 md:my-4 px-2">
      <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-1.5 md:py-2 rounded-full bg-muted/50 text-muted-foreground text-xs sm:text-sm max-w-full">
        <div className="flex-shrink-0">
          {icon}
        </div>
        <span className="truncate">
          <span className="font-medium text-foreground">{userName}</span> {text}
        </span>
        <span className="text-[10px] sm:text-xs opacity-70 flex-shrink-0">{formatTime(timestamp)}</span>
      </div>
    </div>
  );
};
