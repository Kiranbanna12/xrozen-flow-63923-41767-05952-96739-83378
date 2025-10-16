-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  editor_id uuid REFERENCES public.profiles(id),
  client_id uuid REFERENCES public.profiles(id),
  creator_id uuid NOT NULL REFERENCES public.profiles(id),
  month text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  remaining_amount numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'partial', 'paid')),
  payment_method text,
  proceed_date timestamp with time zone,
  paid_date timestamp with time zone,
  due_date timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create invoice_items table (for projects in an invoice)
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  item_name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create transactions table if not exists
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  editor_id uuid REFERENCES public.profiles(id),
  invoice_id uuid REFERENCES public.invoices(id),
  amount numeric NOT NULL,
  description text NOT NULL,
  transaction_date timestamp with time zone NOT NULL DEFAULT now(),
  transaction_type text NOT NULL CHECK (transaction_type IN ('payment', 'expense', 'deduction')),
  payment_method text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create payment_history table for tracking partial payments
CREATE TABLE IF NOT EXISTS public.payment_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Users can view their invoices"
  ON public.invoices FOR SELECT
  USING (creator_id = auth.uid() OR editor_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Users can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Users can update their invoices"
  ON public.invoices FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "Users can delete their invoices"
  ON public.invoices FOR DELETE
  USING (creator_id = auth.uid());

-- RLS Policies for invoice_items
CREATE POLICY "Users can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND (invoices.creator_id = auth.uid() OR invoices.editor_id = auth.uid() OR invoices.client_id = auth.uid())
  ));

CREATE POLICY "Users can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = invoice_items.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

-- RLS Policies for transactions
CREATE POLICY "Users can view their transactions"
  ON public.transactions FOR SELECT
  USING (editor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = transactions.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

CREATE POLICY "Users can create transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (editor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = transactions.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

CREATE POLICY "Users can update their transactions"
  ON public.transactions FOR UPDATE
  USING (editor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = transactions.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

CREATE POLICY "Users can delete their transactions"
  ON public.transactions FOR DELETE
  USING (editor_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = transactions.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

-- RLS Policies for payment_history
CREATE POLICY "Users can view payment history"
  ON public.payment_history FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = payment_history.invoice_id
    AND (invoices.creator_id = auth.uid() OR invoices.editor_id = auth.uid() OR invoices.client_id = auth.uid())
  ));

CREATE POLICY "Users can add payment history"
  ON public.payment_history FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices
    WHERE invoices.id = payment_history.invoice_id
    AND invoices.creator_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_editor_id ON public.invoices(editor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_creator_id ON public.invoices(creator_id);
CREATE INDEX IF NOT EXISTS idx_invoices_month ON public.invoices(month);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_editor_id ON public.transactions(editor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON public.payment_history(invoice_id);

-- Create function to update invoice amounts
CREATE OR REPLACE FUNCTION update_invoice_amounts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount - NEW.total_deductions;
  
  IF NEW.remaining_amount <= 0 THEN
    NEW.status := 'paid';
  ELSIF NEW.paid_amount > 0 AND NEW.remaining_amount > 0 THEN
    NEW.status := 'partial';
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice amount updates
DROP TRIGGER IF EXISTS trigger_update_invoice_amounts ON public.invoices;
CREATE TRIGGER trigger_update_invoice_amounts
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_invoice_amounts();