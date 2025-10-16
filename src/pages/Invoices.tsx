// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, TrendingUp, DollarSign, Clock, Filter, Calendar } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import InvoiceCard from "@/components/invoices/InvoiceCard";
import InvoiceGenerationDialog from "@/components/invoices/InvoiceGenerationDialog";
import InvoiceFilters from "@/components/invoices/InvoiceFilters";
import InvoiceDetailsDialog from "@/components/invoices/InvoiceDetailsDialog";
import PaymentDialog from "@/components/invoices/PaymentDialog";
import TransactionsTable from "@/components/invoices/TransactionsTable";
import { generateInvoicePDF } from "@/components/invoices/InvoicePDF";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [editors, setEditors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [showProjectsOverview, setShowProjectsOverview] = useState(true);

  // Filters
  const [selectedEditor, setSelectedEditor] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
  }, [currentUserId]);

  useEffect(() => {
    applyFilters();
  }, [selectedEditor, selectedMonth, invoices]);

  const checkAuth = async () => {
    try {
      console.log('🔧 Invoices: Starting authentication check');

      // Check authentication first
      if (!apiClient.isAuthenticated()) {
        console.log('🔧 Invoices: Not authenticated, redirecting');
        navigate("/auth");
        return;
      }

      const user = await apiClient.getCurrentUser();
      if (!user) {
        console.log('🔧 Invoices: No user data, redirecting');
        navigate("/auth");
        return;
      }

      console.log('🔧 Invoices: User authenticated, setting current user ID:', user.id);
      setCurrentUserId(user.id);

      // Load profile using apiClient
      try {
        const profile = await apiClient.getProfile(user.id);
        if (profile) {
          console.log('🔧 Invoices: Profile loaded successfully');
          setUserProfile(profile);
        }
      } catch (profileError) {
        console.error('🔧 Invoices: Error loading profile:', profileError);
        // Don't redirect on profile error, just log it
      }
    } catch (error: any) {
      console.error('🔧 Invoices: Auth check failed:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('🔧 Invoices: Auth error, redirecting to login');
        navigate("/auth");
      } else {
        console.error('🔧 Invoices: Unexpected error during auth check:', error);
        navigate("/auth");
      }
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('🔧 Invoices: Loading invoices data');

      // Load invoices using apiClient
      const invoicesData = await apiClient.getInvoices();
      setInvoices(invoicesData || []);
      console.log('🔧 Invoices: Invoices loaded:', invoicesData?.length || 0);

      // Load editors using apiClient
      const editorsData = await apiClient.getEditors();
      setEditors(editorsData || []);
      console.log('🔧 Invoices: Editors loaded:', editorsData?.length || 0);

      // Load projects using apiClient
      const projectsData = await apiClient.getProjects();
      setProjects(projectsData || []);
      console.log('🔧 Invoices: Projects loaded:', projectsData?.length || 0);

      // Load all invoice items for projects overview
      const allItems: any[] = [];
      for (const invoice of invoicesData || []) {
        try {
          const items = await apiClient.getInvoiceItems(invoice.id);
          if (items) {
            allItems.push(...items.map(item => ({
              ...item,
              invoice_id: invoice.id,
              invoice_month: invoice.month,
              editor_name: invoice.editor?.full_name || "Unknown",
              editor_id: invoice.editor_id,
              invoice_status: invoice.status
            })));
          }
        } catch (error) {
          console.error('Error loading items for invoice:', invoice.id, error);
        }
      }
      setInvoiceItems(allItems);
      console.log('🔧 Invoices: Invoice items loaded:', allItems.length);

      // Extract unique months from invoices
      const months = [...new Set(invoicesData?.map(inv => inv.month) || [])];
      setAvailableMonths(months.sort().reverse());
      console.log('🔧 Invoices: Available months:', months);

      // Set current month as default if available
      const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      if (months.includes(currentMonthName)) {
        setSelectedMonth(currentMonthName);
      } else if (months.length > 0) {
        setSelectedMonth(months[0]); // Set most recent month
      }
    } catch (error: any) {
      console.error('🔧 Invoices: Error loading data:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('🔧 Invoices: Auth error during data load, redirecting');
        navigate("/auth");
      } else {
        toast.error("Failed to load invoices data");
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    if (selectedEditor !== "all") {
      filtered = filtered.filter(inv => inv.editor_id === selectedEditor);
    }

    if (selectedMonth && selectedMonth !== "all") {
      filtered = filtered.filter(inv => inv.month === selectedMonth);
    }

    setFilteredInvoices(filtered);
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoiceId) return;

    try {
      console.log('🔧 Invoices: Deleting invoice:', selectedInvoiceId);

      // Delete invoice using apiClient
      await apiClient.deleteInvoice(selectedInvoiceId);

      toast.success("Invoice deleted successfully");
      setInvoices(invoices.filter((inv) => inv.id !== selectedInvoiceId));
      setDeleteDialogOpen(false);
      setSelectedInvoiceId(null);

      console.log('🔧 Invoices: Invoice deleted successfully');
    } catch (error: any) {
      console.error('🔧 Invoices: Error deleting invoice:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('🔧 Invoices: Auth error during delete, redirecting');
        navigate("/auth");
      } else {
        toast.error("Failed to delete invoice");
      }
    }
  };

  const handleEditInvoice = (invoice: any) => {
    toast.info("Edit functionality coming soon");
  };

  const handleProcessPayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      console.log('🔧 Invoices: Generating PDF for invoice:', invoice.id);

      // Fetch invoice items using apiClient
      const items = await apiClient.getInvoiceItems(invoice.id);

      const projectsList = items?.map(item => ({
        name: item.item_name,
        fee: item.amount
      })) || [];

      await generateInvoicePDF(
        invoice,
        projectsList,
        invoice.editor?.full_name || "Unknown"
      );
      toast.success("PDF downloaded successfully");

      console.log('🔧 Invoices: PDF generated successfully');
    } catch (error: any) {
      console.error('🔧 Invoices: Error generating PDF:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.log('🔧 Invoices: Auth error during PDF generation, redirecting');
        navigate("/auth");
      } else {
        toast.error("Failed to generate PDF");
      }
    }
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDetailsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const calculateAnalytics = () => {
    const displayInvoices = filteredInvoices.length > 0 ? filteredInvoices : invoices;

    const totalAmount = displayInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const totalDeductions = displayInvoices.reduce((sum, inv) => sum + Number(inv.total_deductions || 0), 0);
    const totalPaid = displayInvoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
    const totalPending = displayInvoices.reduce((sum, inv) => sum + Number(inv.remaining_amount || 0), 0);

    return {
      totalAmount,
      totalDeductions,
      totalPaid,
      totalPending
    };
  };

  // Role-based Financial Analytics
  const calculateRoleBasedFinancials = () => {
    const userCategory = userProfile?.user_category;
    const displayInvoices = filteredInvoices.length > 0 ? filteredInvoices : invoices;

    if (userCategory === 'editor') {
      const totalRevenue = displayInvoices
        .filter(inv => inv.editor_id === currentUserId)
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      const paidRevenue = displayInvoices
        .filter(inv => inv.editor_id === currentUserId && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
      const pendingRevenue = displayInvoices
        .filter(inv => inv.editor_id === currentUserId && inv.status === 'pending')
        .reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

      return {
        totalLabel: 'Total Revenue',
        totalAmount: totalRevenue,
        totalDescription: `${invoices.filter(inv => inv.editor_id === currentUserId).length} invoice${invoices.filter(inv => inv.editor_id === currentUserId).length !== 1 ? 's' : ''}`,
        paidLabel: 'Received',
        paidAmount: paidRevenue,
        paidDescription: `${invoices.filter(inv => inv.editor_id === currentUserId && inv.status === 'paid').length} completed`,
        pendingLabel: 'Pending Revenue',
        pendingAmount: pendingRevenue,
        pendingDescription: `${invoices.filter(inv => inv.editor_id === currentUserId && inv.status === 'pending').length} awaiting`,
        type: 'revenue'
      };
    }

    else if (userCategory === 'client') {
      // Client sees invoices as EXPENSE (money they pay)
      const totalExpense = invoices
        .filter(inv => inv.client_id === currentUserId)
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      const paidExpense = invoices
        .filter(inv => inv.client_id === currentUserId && inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
      const pendingExpense = invoices
        .filter(inv => inv.client_id === currentUserId && inv.status === 'pending')
        .reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

      return {
        totalLabel: 'Total Expense',
        totalAmount: totalExpense,
        totalDescription: `${invoices.filter(inv => inv.client_id === currentUserId).length} invoice${invoices.filter(inv => inv.client_id === currentUserId).length !== 1 ? 's' : ''}`,
        paidLabel: 'Paid',
        paidAmount: paidExpense,
        paidDescription: `${invoices.filter(inv => inv.client_id === currentUserId && inv.status === 'paid').length} completed`,
        pendingLabel: 'Pending Payment',
        pendingAmount: pendingExpense,
        pendingDescription: `${invoices.filter(inv => inv.client_id === currentUserId && inv.status === 'pending').length} awaiting`,
        type: 'expense'
      };
    }

    else if (userCategory === 'agency') {
      // Agency sees both CLIENT REVENUE and EDITOR EXPENSE with MARGIN
      const clientRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
      const paidFromClients = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
      const pendingFromClients = invoices
        .filter(inv => inv.status === 'pending')
        .reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

      // Calculate editor expenses (payments to editors)
      const editorExpense = invoices
        .filter(inv => inv.payment_type === 'editor_payment')
        .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

      const margin = clientRevenue - editorExpense;

      return {
        totalLabel: 'Total Revenue',
        totalAmount: clientRevenue,
        totalDescription: `Margin: ₹${margin.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        paidLabel: 'Received from Clients',
        paidAmount: paidFromClients,
        paidDescription: `${invoices.filter(inv => inv.status === 'paid').length} completed`,
        pendingLabel: 'Pending from Clients',
        pendingAmount: pendingFromClients,
        pendingDescription: `${invoices.filter(inv => inv.status === 'pending').length} awaiting`,
        editorExpense: editorExpense,
        margin: margin,
        type: 'agency'
      };
    }

    // Default fallback
    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount), 0);
    const totalPending = invoices
      .filter((inv) => inv.status === "pending")
      .reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

    return {
      totalLabel: 'Total Invoiced',
      totalAmount: totalInvoiced,
      totalDescription: `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`,
      paidLabel: 'Total Paid',
      paidAmount: totalPaid,
      paidDescription: `${invoices.filter(inv => inv.status === 'paid').length} completed`,
      pendingLabel: 'Pending',
      pendingAmount: totalPending,
      pendingDescription: `${invoices.filter(inv => inv.status === 'pending').length} awaiting`,
      type: 'default'
    };
  };

  const financials = calculateRoleBasedFinancials();

  // Partial payments calculation (same for all roles)
  const totalPartial = invoices
    .filter((inv) => inv.status === "partial")
    .reduce((sum, inv) => sum + Number(inv.remaining_amount), 0);

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-6 py-4 gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                  <FileText className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Invoices</h1>
                  <p className="text-sm text-muted-foreground">Manage your invoices and payments</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-8 py-8">
            {/* Filters - Moved to Top */}
            <Card className="mb-6 shadow-elegant">
              <CardContent className="pt-6">
                <InvoiceFilters
                  editors={editors}
                  selectedEditor={selectedEditor}
                  onEditorChange={setSelectedEditor}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  availableMonths={availableMonths}
                />
              </CardContent>
            </Card>

            {/* Role-Based Financial Analytics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* Total Revenue/Expense Card */}
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {financials.totalLabel}
                  </CardTitle>
                  <TrendingUp className={`h-4 w-4 ${financials.type === 'expense' ? 'text-warning' : 'text-primary'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${financials.type === 'expense' ? 'text-warning' : ''}`}>
                    ₹{financials.totalAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.totalDescription}
                  </p>
                  {financials.type === 'agency' && financials.editorExpense !== undefined && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Editor Cost: ₹{financials.editorExpense.toFixed(2)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Paid/Received Card */}
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {financials.paidLabel}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-success">
                    ₹{financials.paidAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.paidDescription}
                  </p>
                </CardContent>
              </Card>

              {/* Pending Card */}
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {financials.pendingLabel}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-warning">
                    ₹{financials.pendingAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.pendingDescription}
                  </p>
                </CardContent>
              </Card>

              {/* Partial Payments Card */}
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Partial Payments
                  </CardTitle>
                  <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">₹{totalPartial.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoices.filter((inv) => inv.status === "partial").length} in progress
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Projects Overview Section */}
            <Card className="mb-8 shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Projects Overview</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      All projects with their payment details
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectsOverview(!showProjectsOverview)}
                >
                  {showProjectsOverview ? "Hide" : "Show"} Projects
                </Button>
              </CardHeader>
              {showProjectsOverview && (
                <CardContent>
                  {/* Monthly Summary */}
                  <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-sm text-muted-foreground mb-1">Total Projects</p>
                      <p className="text-2xl font-bold">{invoiceItems.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                      <p className="text-sm text-muted-foreground mb-1">Total Project Revenue</p>
                      <p className="text-2xl font-bold text-success">
                        ₹{invoiceItems.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-info/5 border border-info/20">
                      <p className="text-sm text-muted-foreground mb-1">Average Project Fee</p>
                      <p className="text-2xl font-bold text-info">
                        ₹{invoiceItems.length > 0
                          ? (invoiceItems.reduce((sum, item) => sum + Number(item.amount || 0), 0) / invoiceItems.length).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                          : '0.00'}
                      </p>
                    </div>
                  </div>

                  {/* Projects Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Project Name</TableHead>
                          <TableHead className="font-semibold">Editor</TableHead>
                          <TableHead className="font-semibold">Month</TableHead>
                          <TableHead className="font-semibold text-right">Fee</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems
                          .filter(item => {
                            if (selectedEditor !== "all" && item.editor_id !== selectedEditor) return false;
                            if (selectedMonth && selectedMonth !== "all" && item.invoice_month !== selectedMonth) return false;
                            return true;
                          })
                          .sort((a, b) => {
                            // Sort by month (newest first)
                            return b.invoice_month.localeCompare(a.invoice_month);
                          })
                          .map((item, index) => (
                            <TableRow key={item.id || index} className="hover:bg-muted/30">
                              <TableCell className="font-medium">{item.item_name}</TableCell>
                              <TableCell>{item.editor_name}</TableCell>
                              <TableCell>{item.invoice_month}</TableCell>
                              <TableCell className="text-right font-semibold">
                                ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  item.invoice_status === "paid" ? "bg-success/10 text-success" :
                                    item.invoice_status === "in_progress" ? "bg-primary/10 text-primary" :
                                      item.invoice_status === "partial" ? "bg-info/10 text-info" :
                                        "bg-warning/10 text-warning"
                                }>
                                  {item.invoice_status?.replace("_", " ").toUpperCase() || "PENDING"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        {invoiceItems.filter(item => {
                          if (selectedEditor !== "all" && item.editor_id !== selectedEditor) return false;
                          if (selectedMonth && selectedMonth !== "all" && item.invoice_month !== selectedMonth) return false;
                          return true;
                        }).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                No projects found for selected filters
                              </TableCell>
                            </TableRow>
                          )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Monthly Breakdown */}
                  {availableMonths.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableMonths.map(month => {
                          const monthItems = invoiceItems.filter(item => item.invoice_month === month);
                          const monthTotal = monthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
                          const monthInvoices = invoices.filter(inv => inv.month === month);
                          const monthPaid = monthInvoices
                            .filter(inv => inv.status === 'paid')
                            .reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);

                          return (
                            <div key={month} className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">{month}</h4>
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Projects:</span>
                                  <span className="font-medium">{monthItems.length}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Total:</span>
                                  <span className="font-medium">₹{monthTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Paid:</span>
                                  <span className="font-medium text-success">₹{monthPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Pending:</span>
                                  <span className="font-medium text-warning">₹{(monthTotal - monthPaid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Create Invoice Button */}
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {selectedEditor !== "all" || selectedMonth !== "all"
                  ? `Filtered Invoices (${filteredInvoices.length})`
                  : `All Invoices (${invoices.length})`}
              </h2>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Generate Invoice
              </Button>
            </div>

            {/* Invoices Table */}
            <Card className="mb-8">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Editor</TableHead>
                      <TableHead>Month</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredInvoices.length > 0 ? filteredInvoices : invoices).map((invoice) => {
                      const projectCount = invoiceItems.filter(item =>
                        invoiceItems.some(i => i.invoice_id === invoice.id)
                      ).length;

                      return (
                        <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell
                            className="font-medium text-primary"
                            onClick={() => handleInvoiceClick(invoice.id)}
                          >
                            {invoice.invoice_number}
                          </TableCell>
                          <TableCell>{invoice.editor?.full_name || "Unknown"}</TableCell>
                          <TableCell>{invoice.month}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-primary/5">
                              {invoiceItems.filter(item => item.invoice_id === invoice.id).length} projects
                            </Badge>
                          </TableCell>
                          <TableCell>₹{Number(invoice.total_amount || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-success">
                            ₹{Number(invoice.paid_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-warning">
                            ₹{Number(invoice.remaining_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              invoice.status === "paid" ? "bg-success/10 text-success" :
                                invoice.status === "in_progress" ? "bg-primary/10 text-primary" :
                                  invoice.status === "partial" ? "bg-info/10 text-info" :
                                    "bg-warning/10 text-warning"
                            }>
                              {invoice.status.replace("_", " ").toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {invoice.status !== "paid" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleProcessPayment(invoice)}
                                  className="bg-success/10 hover:bg-success/20 text-success border-success/30"
                                >
                                  Mark Paid
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadPDF(invoice)}
                              >
                                PDF
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Transactions/Expenses Table */}
            <TransactionsTable />

            {/* Empty State */}
            {invoices.length === 0 && (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first invoice to start tracking your payments
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create First Invoice
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Invoice Generation Dialog */}
      <InvoiceGenerationDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          loadData();
        }}
      />

      {/* Invoice Details Dialog */}
      <InvoiceDetailsDialog
        invoiceId={selectedInvoiceId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      {/* Payment Dialog */}
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        onSuccess={() => {
          setPaymentDialogOpen(false);
          loadData();
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
