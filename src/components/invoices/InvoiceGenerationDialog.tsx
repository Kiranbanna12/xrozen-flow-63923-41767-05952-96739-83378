import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { toast } from "sonner";
import { FileText, Download, Send } from "lucide-react";

interface Project {
  id: string;
  name: string;
  fee?: number;
  client_fee?: number;
  editor_fee?: number;
  status: string;
  editor_id?: string;
  client_id?: string;
}

interface Editor {
  id: string;
  full_name: string;
  email: string;
}

interface InvoiceGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function InvoiceGenerationDialog({ open, onOpenChange, onSuccess }: InvoiceGenerationDialogProps) {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [selectedEditor, setSelectedEditor] = useState<string>("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState("");

  useEffect(() => {
    if (open) {
      loadEditors();
      loadAllProjects();
      const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      setMonth(currentMonth);
    }
  }, [open]);

  useEffect(() => {
    if (selectedEditor) {
      loadExpensesForEditor(selectedEditor);
      // Clear selected projects when editor changes
      setSelectedProjects([]);
    }
  }, [selectedEditor]);

  const loadEditors = async () => {
    try {
      console.log('🔧 InvoiceGenerationDialog: Loading editors');
      const editorsData = await apiClient.getEditors();
      setEditors(editorsData || []);
      console.log('🔧 InvoiceGenerationDialog: Editors loaded:', editorsData?.length || 0);
    } catch (error) {
      console.error('🔧 InvoiceGenerationDialog: Error loading editors:', error);
      toast.error("Failed to load editors");
    }
  };

  const loadAllProjects = async () => {
    try {
      console.log('🔧 InvoiceGenerationDialog: Loading all projects');
      const projectsData = await apiClient.getProjects();
      setProjects(projectsData || []);
      console.log('🔧 InvoiceGenerationDialog: All projects loaded:', projectsData?.length || 0);
    } catch (error) {
      console.error('🔧 InvoiceGenerationDialog: Error loading projects:', error);
      toast.error("Failed to load projects");
    }
  };

  // Filter projects based on selected editor
  const filteredProjects = selectedEditor 
    ? projects.filter(project => project.editor_id === selectedEditor)
    : projects;

  const loadExpensesForEditor = async (editorId: string) => {
    try {
      console.log('🔧 InvoiceGenerationDialog: Loading expenses for editor:', editorId);
      // For now, we'll skip expenses loading as the transactions table might not be fully implemented
      // const expensesData = await apiClient.getTransactions({ editor_id: editorId, transaction_type: 'expense' });
      // setExpenses(expensesData || []);
      setExpenses([]);
      console.log('🔧 InvoiceGenerationDialog: Expenses loaded (skipped for now)');
    } catch (error) {
      console.error('🔧 InvoiceGenerationDialog: Error loading expenses:', error);
      setExpenses([]);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const calculateTotals = () => {
    const projectTotal = filteredProjects
      .filter(p => selectedProjects.includes(p.id))
      .reduce((sum, p) => {
        // Use client_fee for clients/agencies, editor_fee for editors
        const fee = p.client_fee || p.editor_fee || p.fee || 0;
        return sum + Number(fee);
      }, 0);

    const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return {
      projectTotal,
      expenseTotal,
      finalTotal: projectTotal - expenseTotal
    };
  };

  const handleProceedToPayment = async () => {
    if (selectedProjects.length === 0) {
      toast.error("Please select at least one project");
      return;
    }

    setLoading(true);
    try {
      console.log('🔧 InvoiceGenerationDialog: Creating invoice');

      const user = await apiClient.getCurrentUser();
      if (!user) throw new Error("Not authenticated");

      const totals = calculateTotals();
      const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();

      // Create invoice using apiClient with correct data structure
      const invoiceData = {
        invoice_number: invoiceNumber,
        editor_id: selectedEditor || null, // Optional now
        client_id: null, // Not needed for editor invoices
        month,
        total_amount: totals.finalTotal,
        paid_amount: 0,
        total_deductions: totals.expenseTotal,
        status: "in_progress",
        payment_method: null,
        proceed_date: new Date().toISOString(),
        paid_date: null,
        due_date: null,
        notes
      };

      const invoice = await apiClient.createInvoice(invoiceData);
      console.log('🔧 InvoiceGenerationDialog: Invoice created:', invoice.id);

      // Add invoice items using apiClient
      const selectedProjectsData = projects.filter(p => selectedProjects.includes(p.id));
      for (const project of selectedProjectsData) {
        const fee = project.client_fee || project.editor_fee || project.fee || 0;
        await apiClient.addInvoiceItem(invoice.id, {
          project_id: project.id,
          item_name: project.name,
          amount: fee
        });
      }

      // Note: Expenses linking is skipped for now as transactions table might not be fully implemented

      toast.success("Invoice created and proceeded to payment");
      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error('🔧 InvoiceGenerationDialog: Error creating invoice:', error);
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        toast.error("Authentication failed. Please login again.");
      } else {
        toast.error("Failed to create invoice");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedEditor || selectedProjects.length === 0) {
      toast.error("Please select an editor and at least one project");
      return;
    }

    // PDF generation logic would go here
    toast.info("PDF generation coming soon");
  };

  const resetForm = () => {
    setSelectedEditor("");
    setSelectedProjects([]);
    setNotes("");
    setEditMode(false);
    onOpenChange(false);
  };

  const totals = calculateTotals();
  const selectedProjectsList = filteredProjects.filter(p => selectedProjects.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Invoice
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Editor Selection */}
          <div className="space-y-2">
            <Label>Select Editor</Label>
            <Select value={selectedEditor} onValueChange={setSelectedEditor}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an editor..." />
              </SelectTrigger>
              <SelectContent>
                {editors.map(editor => (
                  <SelectItem key={editor.id} value={editor.id}>
                    {editor.full_name} ({editor.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project Selection */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label>Select Projects ({filteredProjects.length} available)</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                {editMode ? "Done Editing" : "Select Projects"}
              </Button>
            </div>

            {editMode && (
              <div className="border rounded-lg p-4 space-y-2 max-h-80 overflow-y-auto">
                {filteredProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {selectedEditor ? "No projects available for this editor" : "Please select an editor first"}
                  </p>
                ) : (
                  filteredProjects.map(project => {
                    const editor = editors.find(e => e.id === project.editor_id);
                    const fee = project.client_fee || project.editor_fee || project.fee || 0;

                    return (
                      <div key={project.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-accent border">
                        <Checkbox
                          checked={selectedProjects.includes(project.id)}
                          onCheckedChange={() => toggleProject(project.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium">{project.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Editor: {editor?.full_name || 'Unknown'} • Fee: ₹{Number(fee).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Selected Projects Preview */}
            {selectedProjectsList.length > 0 && (
              <Card className="p-4">
                <h4 className="font-semibold mb-3">Selected Projects ({selectedProjectsList.length})</h4>
                <div className="space-y-2">
                  {selectedProjectsList.map(project => {
                    const editor = editors.find(e => e.id === project.editor_id);
                    const fee = project.client_fee || project.editor_fee || project.fee || 0;

                    return (
                      <div key={project.id} className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium">{project.name}</span>
                          <br />
                          <span className="text-muted-foreground text-xs">
                            {editor?.full_name || 'Unknown'}
                          </span>
                        </div>
                        <span className="font-medium">₹{Number(fee).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Expenses Summary */}
          {expenses.length > 0 && (
            <Card className="p-4 bg-warning/5 border-warning/20">
              <h4 className="font-semibold mb-2">Expenses/Deductions ({expenses.length})</h4>
              <div className="space-y-1">
                {expenses.map(expense => (
                  <div key={expense.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{expense.description}</span>
                    <span className="text-warning">-₹{Number(expense.amount || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Totals Summary */}
          {selectedProjects.length > 0 && (
            <Card className="p-4 bg-primary/5">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">₹{totals.projectTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deductions:</span>
                  <span className="text-warning">-₹{totals.expenseTotal.toFixed(2)}</span>
                </div>
                <div className="h-px bg-border my-2" />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total Amount:</span>
                  <span className="font-bold text-primary">₹{totals.finalTotal.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any additional notes for this invoice..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={handleProceedToPayment} disabled={loading} className="gap-2">
              <Send className="h-4 w-4" />
              {loading ? "Creating..." : "Proceed to Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
