-- Create servers table for VPS management
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  ssh_username TEXT NOT NULL DEFAULT 'root',
  ssh_password TEXT, -- encrypted
  ssh_key TEXT, -- for key-based auth
  ssh_port INTEGER NOT NULL DEFAULT 22,
  supabase_port INTEGER DEFAULT 3000,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'deploying', 'error')),
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS for servers table (public access for this MVP)
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Allow all operations for MVP (can be restricted later with auth)
CREATE POLICY "Allow all access to servers" ON public.servers
  FOR ALL USING (true) WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_servers_status ON public.servers(status);
CREATE INDEX idx_servers_ip ON public.servers(ip_address);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_servers_updated_at();