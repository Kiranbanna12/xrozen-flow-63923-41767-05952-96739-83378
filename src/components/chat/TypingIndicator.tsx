import type { TypingIndicator as TypingIndicatorType } from "@/types/chat.types";

interface TypingIndicatorProps {
  typingUsers: TypingIndicatorType[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].user?.full_name || "Someone"} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].user?.full_name || "Someone"} and ${typingUsers[1].user?.full_name || "someone"} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 sm:gap-2">
      <div className="flex gap-0.5 sm:gap-1">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
      </div>
      <span className="truncate">{getTypingText()}</span>
    </div>
  );
};
