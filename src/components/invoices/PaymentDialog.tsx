// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { type Invoice } from "./InvoiceCard";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onSuccess: () => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<"full" | "partial">("full");
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "",
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Update amount when payment type or invoice changes
  useEffect(() => {
    if (invoice && paymentType === "full") {
      setFormData(prev => ({
        ...prev,
        amount: invoice.remaining_amount.toString()
      }));
    } else if (paymentType === "partial") {
      setFormData(prev => ({
        ...prev,
        amount: ""
      }));
    }
  }, [paymentType, invoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoice) return;

    const paymentAmount = Number(formData.amount);
    if (paymentAmount <= 0 || paymentAmount > invoice.remaining_amount) {
      toast.error(`Payment amount must be between ₹0 and ₹${invoice.remaining_amount}`);
      return;
    }

    setLoading(true);
    try {
      const user = await apiClient.getCurrentUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const newPaidAmount = Number(invoice.paid_amount) + paymentAmount;
      const newRemainingAmount = Number(invoice.total_amount) - newPaidAmount;
      const newStatus = newRemainingAmount === 0 ? 'paid' : 'partial';

      // Update invoice using apiClient
      await apiClient.updateInvoice(invoice.id, {
        paid_amount: newPaidAmount,
        remaining_amount: newRemainingAmount,
        status: newStatus,
        payment_method: formData.paymentMethod,
        paid_date: newStatus === 'paid' ? formData.paymentDate : null,
      });

      // Create transaction record using apiClient
      await apiClient.createTransaction({
        editor_id: invoice.editor_id,
        invoice_id: invoice.id,
        amount: paymentAmount,
        description: `Payment for invoice ${invoice.invoice_number || invoice.id}`,
        transaction_date: formData.paymentDate,
        transaction_type: 'payment',
        payment_method: formData.paymentMethod,
        notes: formData.notes,
      });

      toast.success("Payment recorded successfully");
      setFormData({
        amount: "",
        paymentMethod: "",
        paymentDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      setPaymentType("full");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Payment as Paid</DialogTitle>
          <DialogDescription>
            Record payment details for this invoice
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Total Amount:</span>
              <span className="font-semibold">₹{Number(invoice.total_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Paid Amount:</span>
              <span className="font-semibold text-success">₹{Number(invoice.paid_amount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Remaining:</span>
              <span className="font-semibold text-warning">₹{Number(invoice.remaining_amount).toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Payment Type</Label>
            <RadioGroup value={paymentType} onValueChange={(value: "full" | "partial") => setPaymentType(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" />
                <Label htmlFor="full" className="font-normal cursor-pointer">
                  Full Payment (₹{Number(invoice.remaining_amount).toFixed(2)})
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="font-normal cursor-pointer">
                  Partial Payment
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Payment Amount (₹)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              max={invoice.remaining_amount}
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              disabled={paymentType === "full"}
              required
            />
            <p className="text-xs text-muted-foreground">
              {paymentType === "full"
                ? "Full payment amount will be recorded"
                : `Maximum: ₹${Number(invoice.remaining_amount).toFixed(2)}`
              }
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Payment Method</Label>
            <Select
              value={formData.paymentMethod}
              onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input
              id="paymentDate"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Recording..." : "Mark as Paid"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
