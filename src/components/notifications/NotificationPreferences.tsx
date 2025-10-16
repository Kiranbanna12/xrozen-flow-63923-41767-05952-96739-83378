import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";

const NOTIFICATION_EVENTS = [
  { key: 'project_created', label: 'Project Created', category: 'Projects' },
  { key: 'project_assigned', label: 'Project Assigned', category: 'Projects' },
  { key: 'project_status_changed', label: 'Project Status Changed', category: 'Projects' },
  { key: 'version_added', label: 'New Version Added', category: 'Projects' },
  { key: 'deadline_approaching', label: 'Deadline Approaching', category: 'Projects' },
  { key: 'deadline_overdue', label: 'Deadline Overdue', category: 'Projects' },
  { key: 'feedback_added', label: 'Feedback Added', category: 'Feedback' },
  { key: 'correction_requested', label: 'Correction Requested', category: 'Feedback' },
  { key: 'project_approved', label: 'Project Approved', category: 'Feedback' },
  { key: 'invoice_generated', label: 'Invoice Generated', category: 'Payments' },
  { key: 'invoice_due', label: 'Invoice Due', category: 'Payments' },
  { key: 'payment_received', label: 'Payment Received', category: 'Payments' },
  { key: 'chat_message', label: 'Chat Message', category: 'Communication' },
];

export function NotificationPreferences() {
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      // Load from localStorage for now (can be extended to backend)
      const savedPrefs = localStorage.getItem(`notification_prefs_${user.id}`);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      } else {
        // Default: all enabled
        const defaultPrefs: Record<string, boolean> = {};
        NOTIFICATION_EVENTS.forEach(event => {
          defaultPrefs[`${event.key}_in_app`] = true;
          defaultPrefs[`${event.key}_email`] = true;
        });
        setPreferences(defaultPrefs);
        localStorage.setItem(`notification_prefs_${user.id}`, JSON.stringify(defaultPrefs));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (eventKey: string, channel: 'email' | 'in_app', enabled: boolean) => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) return;

      const prefKey = `${eventKey}_${channel}`;
      const newPrefs = { ...preferences, [prefKey]: enabled };
      
      setPreferences(newPrefs);
      localStorage.setItem(`notification_prefs_${user.id}`, JSON.stringify(newPrefs));

      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    }
  };

  if (loading) {
    return <div className="text-xs sm:text-sm text-muted-foreground">Loading preferences...</div>;
  }

  const categories = [...new Set(NOTIFICATION_EVENTS.map(e => e.category))];

  return (
    <div className="space-y-3 sm:space-y-4">
      {categories.map((category) => (
        <div key={category} className="space-y-2 sm:space-y-3">
          <h4 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {category}
          </h4>
          <div className="space-y-2">
            {NOTIFICATION_EVENTS.filter(e => e.category === category).map((event) => (
              <div 
                key={event.key}
                className="flex items-center justify-between py-2 sm:py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className="text-xs sm:text-sm font-medium flex-1 min-w-0 truncate">
                  {event.label}
                </span>
                <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id={`${event.key}-app`}
                      checked={preferences[`${event.key}_in_app`] !== false}
                      onCheckedChange={(checked) => updatePreference(event.key, 'in_app', checked)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label 
                      htmlFor={`${event.key}-app`}
                      className="text-[10px] sm:text-xs text-muted-foreground cursor-pointer"
                    >
                      In-App
                    </Label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      id={`${event.key}-email`}
                      checked={preferences[`${event.key}_email`] !== false}
                      onCheckedChange={(checked) => updatePreference(event.key, 'email', checked)}
                      className="data-[state=checked]:bg-primary"
                    />
                    <Label 
                      htmlFor={`${event.key}-email`}
                      className="text-[10px] sm:text-xs text-muted-foreground cursor-pointer"
                    >
                      Email
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
