-- Fix function search path security warning
DROP TRIGGER IF EXISTS update_servers_updated_at ON public.servers;
DROP FUNCTION IF EXISTS public.update_servers_updated_at();

CREATE OR REPLACE FUNCTION public.update_servers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Recreate the trigger
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_servers_updated_at();