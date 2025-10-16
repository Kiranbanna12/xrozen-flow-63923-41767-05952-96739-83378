import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Receipt, Download, CheckCircle2, Clock, XCircle, Search,
  Calendar, CreditCard, Filter, FileText, ArrowUpDown
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  description: string;
  date: string;
  invoice_url?: string;
  payment_method?: string;
}

const BillingHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterAndSortPayments();
  }, [payments, searchTerm, statusFilter, sortOrder]);

  const loadPayments = async () => {
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const paymentsData = await apiClient.getPayments();
        setPayments(paymentsData);
      } catch (error) {
        console.error("Failed to load payments:", error);
        // Set mock data for demonstration
        setPayments([
          {
            id: "1",
            amount: 2499,
            currency: "INR",
            status: "completed",
            description: "Pro Plan - Monthly Subscription",
            date: new Date().toISOString(),
            payment_method: "•••• 4242",
          },
          {
            id: "2",
            amount: 2499,
            currency: "INR",
            status: "completed",
            description: "Pro Plan - Monthly Subscription",
            date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            payment_method: "•••• 4242",
          },
        ]);
      }
    } catch (error: any) {
      console.error("Load payments error:", error);
      toast.error("Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPayments = () => {
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (payment) =>
          payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => payment.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    setFilteredPayments(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-success text-white text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning text-white text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-destructive text-white text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleDownloadInvoice = (payment: Payment) => {
    if (payment.invoice_url) {
      window.open(payment.invoice_url, "_blank");
    } else {
      toast.info("Generating invoice...");
      // In production, this would call an API to generate the invoice
    }
  };

  const calculateTotal = () => {
    return filteredPayments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading billing history...</p>
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
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Billing History</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    View all your transactions and invoices
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full">
              <div className="grid gap-4 sm:gap-6">
                {/* Summary Cards */}
                <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Spent</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold">
                        ₹{calculateTotal().toLocaleString()}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Transactions</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold">
                        {payments.length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Successful</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold text-success">
                        {payments.filter((p) => p.status === "completed").length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Filters */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <CardTitle className="text-base sm:text-lg">Filter & Search</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 text-xs sm:text-sm h-9 sm:h-10"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                        className="text-xs sm:text-sm h-9 sm:h-10"
                      >
                        <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions List */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-lg sm:text-xl">Transactions</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          {filteredPayments.length} transaction{filteredPayments.length !== 1 ? "s" : ""} found
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info("Export feature coming soon!")}
                        className="text-xs sm:text-sm"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredPayments.length === 0 ? (
                      <div className="text-center py-12">
                        <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No transactions found</p>
                        {(searchTerm || statusFilter !== "all") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("all");
                            }}
                            className="mt-4 text-xs sm:text-sm"
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredPayments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors flex-wrap gap-3"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm sm:text-base font-semibold truncate">
                                    {payment.description}
                                  </p>
                                  {getStatusBadge(payment.status)}
                                </div>
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(payment.date), "MMM dd, yyyy")}
                                  </span>
                                  {payment.payment_method && (
                                    <span className="flex items-center gap-1">
                                      <CreditCard className="w-3 h-3" />
                                      {payment.payment_method}
                                    </span>
                                  )}
                                  <span className="text-[10px] sm:text-xs text-muted-foreground/70">
                                    ID: {payment.id}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-base sm:text-lg font-bold">
                                  ₹{payment.amount.toLocaleString()}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                                  {payment.currency}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadInvoice(payment)}
                                className="text-xs"
                              >
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Invoice</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default BillingHistory;
