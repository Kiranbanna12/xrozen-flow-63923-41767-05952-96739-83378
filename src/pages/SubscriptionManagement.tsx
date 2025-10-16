import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Crown, CreditCard, User, Zap, CheckCircle2, XCircle, AlertCircle,
  Calendar, ArrowRight, Plus, Trash2, Star, Shield, Clock
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand: string;
  expiry: string;
  is_default: boolean;
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: string;
  icon: any;
  color: string;
  gradient: string;
  features: string[];
}

const TIERS: SubscriptionTier[] = [
  {
    id: "basic",
    name: "Basic",
    price: "₹999",
    icon: User,
    color: "bg-secondary",
    gradient: "from-gray-500 to-gray-600",
    features: [
      "Up to 5 Projects",
      "Up to 3 Clients",
      "Basic Support",
      "1 GB Storage",
      "Email Notifications",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹2,499",
    icon: Zap,
    color: "bg-primary",
    gradient: "from-green-500 to-emerald-600",
    features: [
      "Up to 50 Projects",
      "Up to 20 Clients",
      "Priority Support",
      "10 GB Storage",
      "Email & SMS Notifications",
      "Advanced Analytics",
      "API Access",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "₹4,999",
    icon: Crown,
    color: "bg-success",
    gradient: "from-purple-500 to-pink-600",
    features: [
      "Unlimited Projects",
      "Unlimited Clients",
      "24/7 Premium Support",
      "Unlimited Storage",
      "All Notifications",
      "Advanced Analytics",
      "API Access",
      "Custom Branding",
    ],
  },
];

const SubscriptionManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const profileData = await apiClient.getProfile();
        setProfile({ ...user, ...profileData });
      } catch (error) {
        setProfile(user);
      }

      // Load payment methods
      try {
        const methods = await apiClient.getPaymentMethods();
        setPaymentMethods(methods);
      } catch (error) {
        console.error("Failed to load payment methods:", error);
      }
    } catch (error: any) {
      console.error("Load data error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    if (tier === profile?.subscription_tier) {
      toast.info("You are already on this plan");
      return;
    }

    setProcessing(true);
    try {
      await apiClient.upgradeSubscription(tier);
      toast.success("Subscription upgraded successfully!");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to upgrade subscription");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    setProcessing(true);
    try {
      await apiClient.cancelSubscription();
      toast.success("Subscription cancelled. It will remain active until the end of the billing period.");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel subscription");
    } finally {
      setProcessing(false);
    }
  };

  const handleSetDefaultPayment = async (id: string) => {
    try {
      await apiClient.setDefaultPaymentMethod(id);
      toast.success("Default payment method updated");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment method");
    }
  };

  const handleRemovePayment = async (id: string) => {
    try {
      await apiClient.removePaymentMethod(id);
      toast.success("Payment method removed");
      await loadData();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove payment method");
    }
  };

  const currentTier = profile?.subscription_tier || "basic";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading subscription details...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Subscription Management</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    Manage your plan and payment methods
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full">
              <div className="grid gap-4 sm:gap-6">
                {/* Current Subscription Card */}
                <Card className="shadow-elegant border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-lg sm:text-xl">Current Subscription</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          {profile?.subscription_active ? "Active" : "Inactive"}
                        </CardDescription>
                      </div>
                      {profile?.subscription_active && (
                        <Badge className="bg-success text-xs sm:text-sm">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        {React.createElement(TIERS.find(t => t.id === currentTier)?.icon || User, {
                          className: "w-8 h-8 sm:w-10 sm:h-10 text-primary"
                        })}
                        <div>
                          <h3 className="text-xl sm:text-2xl font-bold capitalize">{currentTier}</h3>
                          <p className="text-sm sm:text-base text-muted-foreground">
                            {TIERS.find(t => t.id === currentTier)?.price}/month
                          </p>
                        </div>
                      </div>
                      {profile?.subscription_end_date && (
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Next billing date</p>
                          <p className="text-sm sm:text-base font-semibold">
                            {format(new Date(profile.subscription_end_date), "MMM dd, yyyy")}
                          </p>
                        </div>
                      )}
                    </div>
                    {profile?.subscription_active && (
                      <>
                        <Separator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto text-destructive hover:bg-destructive/10 text-xs sm:text-sm">
                              <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                              Cancel Subscription
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your subscription will remain active until the end of the current billing period. 
                                After that, you'll be downgraded to the Basic plan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={handleCancelSubscription}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                {processing ? "Cancelling..." : "Yes, Cancel"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Available Plans */}
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold">Available Plans</h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">Upgrade or change your subscription</p>
                  </div>
                  <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {TIERS.map((tier) => {
                      const IconComponent = tier.icon;
                      const isCurrent = tier.id === currentTier;
                      
                      return (
                        <Card key={tier.id} className={cn("shadow-elegant transition-all hover:shadow-2xl", isCurrent && "border-primary border-2")}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className={cn("p-2 rounded-lg bg-gradient-to-br", tier.gradient)}>
                                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                              </div>
                              {isCurrent && (
                                <Badge className="bg-primary">
                                  <Star className="w-3 h-3 mr-1" />
                                  Current
                                </Badge>
                              )}
                            </div>
                            <CardTitle className="text-xl sm:text-2xl">{tier.name}</CardTitle>
                            <div className="space-y-1">
                              <p className="text-2xl sm:text-3xl font-bold">{tier.price}</p>
                              <p className="text-xs sm:text-sm text-muted-foreground">per month</p>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <Separator />
                            <ul className="space-y-2">
                              {tier.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                            <Button
                              onClick={() => handleUpgrade(tier.id)}
                              disabled={isCurrent || processing}
                              className={cn("w-full text-xs sm:text-sm", isCurrent ? "" : "gradient-primary")}
                              variant={isCurrent ? "outline" : "default"}
                            >
                              {isCurrent ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Current Plan
                                </>
                              ) : (
                                <>
                                  {processing ? "Processing..." : "Upgrade"}
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Payment Methods */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-lg sm:text-xl">Payment Methods</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Manage your saved payment methods</CardDescription>
                      </div>
                      <Button onClick={() => toast.info("Add payment method feature coming soon!")} size="sm" className="text-xs sm:text-sm">
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Add Method
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-8">
                        <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No payment methods added</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4 text-xs sm:text-sm"
                          onClick={() => toast.info("Add payment method feature coming soon!")}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Your First Method
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((method) => (
                          <div key={method.id} className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm sm:text-base font-semibold capitalize">{method.brand}</p>
                                  {method.is_default && (
                                    <Badge className="bg-success text-[10px] sm:text-xs">Default</Badge>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-muted-foreground">•••• {method.last4}</p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground">Expires {method.expiry}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {!method.is_default && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSetDefaultPayment(method.id)}
                                  className="text-xs"
                                >
                                  Set Default
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This payment method will be permanently removed from your account.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleRemovePayment(method.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Subscription Info */}
                <Card className="shadow-elegant bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      Subscription Benefits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">Flexible Billing</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">Cancel anytime, no questions asked</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Shield className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">Secure Payments</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">All transactions are encrypted and secure</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm font-semibold">No Hidden Fees</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">What you see is what you pay</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default SubscriptionManagement;
