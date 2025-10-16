import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, Video, MessageSquare, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'project' | 'message' | 'approval' | 'deadline';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      const activities: ActivityItem[] = [];

      // Get recent projects
      const projects = await apiClient.getProjects();
      if (projects) {
        projects.slice(0, 5).forEach(project => {
          activities.push({
            id: project.id,
            type: 'project',
            title: project.name || project.title,
            description: `Project ${project.status?.replace('_', ' ') || 'in progress'}`,
            timestamp: project.updated_at,
            status: project.status,
          });
        });
      }

      // Get recent messages
      const messages = await apiClient.getMessages();
      if (messages && Array.isArray(messages)) {
        messages.slice(0, 5).forEach(message => {
          activities.push({
            id: message.id,
            type: 'message',
            title: message.sender_id === user.id ? 'Sent a message' : 'Received a message',
            description: message.content?.substring(0, 50) + '...',
            timestamp: message.created_at,
          });
        });
      }

      // Sort all activities by timestamp
      activities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Video className="h-4 w-4" />;
      case 'message':
        return <MessageSquare className="h-4 w-4" />;
      case 'approval':
        return <CheckCircle className="h-4 w-4" />;
      case 'deadline':
        return <Clock className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_review':
        return 'default';
      case 'approved':
        return 'success';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ScrollArea className="h-[350px] sm:h-[400px] pr-2 sm:pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-[#f5f6f6] dark:hover:bg-[#202428] transition-colors"
                >
                  <div className="mt-0.5 sm:mt-1 flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-0.5 sm:space-y-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-xs sm:text-sm truncate">{activity.title}</p>
                      {activity.status && (
                        <Badge variant={getStatusColor(activity.status) as any} className="text-xs shrink-0">
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
