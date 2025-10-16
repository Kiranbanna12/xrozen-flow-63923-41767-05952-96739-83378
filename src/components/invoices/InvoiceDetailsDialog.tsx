import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { format } from "date-fns";
import { FileText, Calendar, User, DollarSign } from "lucide-react";

interface InvoiceDetailsDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailsDialog({ invoiceId, open, onOpenChange }: InvoiceDetailsDialogProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [editor, setEditor] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (invoiceId && open) {
      loadInvoiceDetails();
    }
  }, [invoiceId, open]);

  const loadInvoiceDetails = async () => {
    if (!invoiceId) return;

    setLoading(true);
    try {
      // Load invoice using apiClient
      const invoiceData = await apiClient.getInvoice(invoiceId);
      if (!invoiceData) throw new Error("Invoice not found");
      setInvoice(invoiceData);

      // Load invoice items
      const itemsData = await apiClient.getInvoiceItems(invoiceId);
      setItems(itemsData || []);

      // Load editor details
      if (invoiceData.editor_id) {
        const editorData = await apiClient.getEditor(invoiceData.editor_id);
        setEditor(editorData);
      }

      // Load payment history - for now use empty array as backend support may be missing
      try {
        const historyData = await apiClient.getPaymentHistory(invoiceId);
        setPaymentHistory(historyData || []);
      } catch (error) {
        console.log('Payment history not available yet');
        setPaymentHistory([]);
      }
    } catch (error) {
      console.error("Error loading invoice details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-success/10 text-success";
      case "pending": return "bg-warning/10 text-warning";
      case "in_progress": return "bg-primary/10 text-primary";
      case "partial": return "bg-info/10 text-info";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Details - {invoice.invoice_number}
          </DialogTitle>
          <DialogDescription>
            View complete invoice information and payment history
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Invoice Information</span>
                  <Badge className={getStatusColor(invoice.status)}>
                    {invoice.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Month</p>
                    <p className="font-medium">{invoice.month}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created Date</p>
                    <p className="font-medium">{format(new Date(invoice.created_at), "MMM dd, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Editor</p>
                    <p className="font-medium">{editor?.full_name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium">
                      {invoice.due_date ? format(new Date(invoice.due_date), "MMM dd, yyyy") : "Not set"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Items */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex justify-between p-3 rounded-lg bg-muted/50">
                      <span>{item.item_name}</span>
                      <span className="font-medium">₹{Number(item.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Financial Summary */}
            <Card className="bg-primary/5">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">₹{Number(invoice.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Deductions:</span>
                    <span className="text-warning">-₹{Number(invoice.total_deductions).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid Amount:</span>
                    <span className="text-success">₹{Number(invoice.paid_amount).toFixed(2)}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex justify-between text-lg">
                    <span className="font-semibold">Remaining:</span>
                    <span className="font-bold text-primary">₹{Number(invoice.remaining_amount).toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paymentHistory.map(payment => (
                      <div key={payment.id} className="flex justify-between items-center p-3 rounded-lg border">
                        <div>
                          <p className="font-medium">₹{Number(payment.amount).toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                          </p>
                          {payment.payment_method && (
                            <p className="text-xs text-muted-foreground">{payment.payment_method}</p>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-sm text-muted-foreground max-w-xs">{payment.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {invoice.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{invoice.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
