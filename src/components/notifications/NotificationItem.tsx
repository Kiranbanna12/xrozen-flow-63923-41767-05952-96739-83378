import { useNotifications } from "@/hooks/useNotifications";
import { Notification } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { getNotificationIcon } from "./notificationIcons";
import { toast } from "sonner";

interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markAsRead(notification.id);
      toast.success("Notification marked as read");
    } catch (error) {
      toast.error("Failed to mark as read");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(notification.id);
      toast.success("Notification deleted");
    } catch (error) {
      toast.error("Failed to delete notification");
    }
  };

  const Icon = getNotificationIcon(notification.type);
  const priorityColor = {
    info: 'text-primary',
    important: 'text-orange-500',
    critical: 'text-red-500',
  }[notification.priority];

  const priorityBorder = {
    info: 'border-l-primary',
    important: 'border-l-orange-500',
    critical: 'border-l-red-500',
  }[notification.priority];

  return (
    <div
      className={cn(
        "relative group transition-all duration-200",
        "border-b border-l-4 hover:shadow-md",
        "p-3 sm:p-4 cursor-pointer",
        "w-full max-w-full overflow-hidden",
        !notification.read && "bg-accent/40 dark:bg-accent/40 hover:bg-accent/60 dark:hover:bg-accent/60",
        notification.read && "bg-card dark:bg-card hover:bg-accent/30 dark:hover:bg-accent/30",
        priorityBorder
      )}
      onClick={handleClick}
    >
      <div className="flex gap-2 sm:gap-3 w-full max-w-full">
        {/* Icon */}
        <div className={cn("mt-0.5 sm:mt-1 flex-shrink-0", priorityColor)}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-start justify-between gap-2 w-full">
            <div className="flex items-start gap-2 flex-1 min-w-0 overflow-hidden">
              <h4 className={cn(
                "font-medium text-xs sm:text-sm leading-tight line-clamp-2",
                !notification.read && "font-semibold"
              )}>
                {notification.title}
              </h4>
              {!notification.read && (
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5 sm:mt-1" />
              )}
            </div>
          </div>

          <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2 sm:line-clamp-3 break-words">
            {notification.message}
          </p>

          <div className="flex items-center gap-2 sm:gap-3 mt-2 flex-wrap w-full overflow-hidden">
            <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(notification.created_at), {
                addSuffix: true,
              })}
            </span>
            {notification.link && (
              <span className="flex items-center gap-1 text-[10px] sm:text-xs text-primary whitespace-nowrap">
                <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                <span className="hidden sm:inline">View details</span>
              </span>
            )}
            {notification.priority !== 'info' && (
              <span className={cn(
                "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
                notification.priority === 'critical' && "bg-red-100 text-red-700",
                notification.priority === 'important' && "bg-orange-100 text-orange-700"
              )}>
                {notification.priority.charAt(0).toUpperCase() + notification.priority.slice(1)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-1 sm:gap-0 flex-shrink-0 ml-auto">
          {!notification.read && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleMarkAsRead}
              title="Mark as read"
            >
              <Check className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            onClick={handleDelete}
            title="Delete"
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
