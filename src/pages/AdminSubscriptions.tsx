import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Crown } from "lucide-react";
import { toast } from "sonner";

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user email is in local admin list
      if (!isAdminEmail(user.email)) {
        toast.error("Access denied. Admin only.");
        navigate("/dashboard");
        return;
      }

      loadSubscriptions();
    } catch (error) {
      console.error("Auth check failed:", error);
      navigate("/auth");
    }
  };

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const subscriptionsData = await apiClient.getSubscriptions();
      
      // Ensure we have an array to work with
      const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData : [];
      
      setSubscriptions(subscriptions);
      toast.success(`Loaded ${subscriptions.length} subscriptions`);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
      toast.error("Failed to load subscriptions");
      // Fallback to empty array if API fails
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId: string, newStatus: string) => {
    try {
      const updates = {
        subscription_active: newStatus === 'active' ? 1 : 0,
        subscription_tier: newStatus === 'active' ? 'premium' : 'basic'
      };
      
      await apiClient.updateSubscriptionStatus(subscriptionId, updates);
      toast.success("Subscription status updated successfully");
      loadSubscriptions(); // Reload data
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Failed to update subscription");
    }
  };

  const extendSubscription = async (subscriptionId: string, days: number) => {
    try {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + days);
      
      const updates = {
        trial_end_date: newEndDate.toISOString().split('T')[0]
      };
      
      await apiClient.updateSubscriptionStatus(subscriptionId, updates);
      toast.success(`Subscription extended by ${days} days`);
      loadSubscriptions(); // Reload data
    } catch (error) {
      console.error("Error extending subscription:", error);
      toast.error("Failed to extend subscription");
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, any> = {
      active: { label: "Active", className: "bg-success" },
      expired: { label: "Expired", className: "bg-destructive" },
      cancelled: { label: "Cancelled", className: "bg-secondary" },
      limited: { label: "Limited", className: "bg-warning" }
    };
    const config = configs[status] || configs.active;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AdminLayout title="Subscription Management" description="Manage user subscriptions">
      <div className="space-y-6">
            <Card className="shadow-elegant">
              <CardHeader>
                <CardTitle>All Subscriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.full_name || "N/A"}</TableCell>
                        <TableCell>{sub.user_email || "N/A"}</TableCell>
                        <TableCell>
                          {sub.plan_name || "Basic Plan"}
                          <div className="text-xs text-muted-foreground">
                            ₹{sub.amount || 0}/mo
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(sub.status)}</TableCell>
                        <TableCell>
                          {sub.start_date ? new Date(sub.start_date).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Select
                              value={sub.status}
                              onValueChange={(value) => updateSubscriptionStatus(sub.id, value)}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="expired">Expired</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => extendSubscription(sub.id, 30)}
                            >
                              +30 Days
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
      </div>
    </AdminLayout>
  );
}
