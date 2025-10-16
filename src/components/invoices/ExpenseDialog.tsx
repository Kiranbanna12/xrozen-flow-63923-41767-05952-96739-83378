// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
}

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  onSuccess: () => void;
}

export default function ExpenseDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess
}: ExpenseDialogProps) {
  const [loading, setLoading] = useState(false);
  const [editors, setEditors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    amount: transaction?.amount.toString() || "",
    description: transaction?.description || "",
    transactionDate: transaction?.transaction_date || new Date().toISOString().slice(0, 10),
    transactionType: transaction?.transaction_type || "expense",
    paymentMethod: transaction?.payment_method || "",
    relatedTo: "none", // none, editor, client
    relatedId: "",
    invoiceId: "",
  });

  useEffect(() => {
    if (open) {
      loadRelatedData();
    }
  }, [open]);

  const loadRelatedData = async () => {
    try {
      const [editorsData, clientsData, invoicesData] = await Promise.all([
        apiClient.getEditors(),
        apiClient.getClients(),
        apiClient.getInvoices()
      ]);

      setEditors(editorsData || []);
      setClients(clientsData || []);
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error("Error loading related data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Number(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const transactionData = {
        amount: Number(formData.amount),
        description: formData.description,
        transaction_date: formData.transactionDate,
        transaction_type: formData.transactionType,
        payment_method: formData.paymentMethod || null,
        invoice_id: formData.invoiceId || null,
      };

      // Add related person based on selection
      if (formData.relatedTo === "editor") {
        transactionData.editor_id = formData.relatedId;
      } else if (formData.relatedTo === "client") {
        transactionData.client_id = formData.relatedId;
      } else {
        transactionData.editor_id = user.id; // Default to current user
      }

      if (transaction) {
        // Update existing transaction
        await apiClient.updateTransaction(transaction.id, transactionData);
        toast.success("Transaction updated successfully");
      } else {
        // Create new transaction
        await apiClient.createTransaction(transactionData);
        toast.success("Transaction added successfully");
      }

      setFormData({
        amount: "",
        description: "",
        transactionDate: new Date().toISOString().slice(0, 10),
        transactionType: "expense",
        paymentMethod: "",
        relatedTo: "none",
        relatedId: "",
        invoiceId: "",
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error saving transaction:", error);
      toast.error("Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit" : "Add"} Transaction / Expense</DialogTitle>
          <DialogDescription>
            Record expenses, payments, advances, or deductions
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="transactionType">Transaction Type</Label>
            <Select
              value={formData.transactionType}
              onValueChange={(value) => setFormData({ ...formData, transactionType: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="advance">Advance Payment</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
                <SelectItem value="refund">Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relatedTo">Related To</Label>
            <Select
              value={formData.relatedTo}
              onValueChange={(value) => setFormData({ ...formData, relatedTo: value, relatedId: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select relation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">General (No specific person)</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="client">Client</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.relatedTo === "editor" && (
            <div className="space-y-2">
              <Label htmlFor="editorId">Select Editor</Label>
              <Select
                value={formData.relatedId}
                onValueChange={(value) => setFormData({ ...formData, relatedId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select editor" />
                </SelectTrigger>
                <SelectContent>
                  {editors.map((editor) => (
                    <SelectItem key={editor.id} value={editor.id}>
                      {editor.full_name || editor.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.relatedTo === "client" && (
            <div className="space-y-2">
              <Label htmlFor="clientId">Select Client</Label>
              <Select
                value={formData.relatedId}
                onValueChange={(value) => setFormData({ ...formData, relatedId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="invoiceId">Link to Invoice (Optional)</Label>
            <Select
              value={formData.invoiceId}
              onValueChange={(value) => setFormData({ ...formData, invoiceId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select invoice" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {invoices.map((invoice) => (
                  <SelectItem key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - {invoice.month} (₹{Number(invoice.total_amount).toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter transaction description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transactionDate">Date</Label>
            <Input
              id="transactionDate"
              type="date"
              value={formData.transactionDate}
              onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method (Optional)</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : transaction ? "Update" : "Add"} Transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
