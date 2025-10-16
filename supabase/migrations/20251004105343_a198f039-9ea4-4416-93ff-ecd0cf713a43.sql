-- Fix status constraint to include 'pending'
ALTER TABLE public.servers DROP CONSTRAINT IF EXISTS servers_status_check;

ALTER TABLE public.servers 
ADD CONSTRAINT servers_status_check 
CHECK (status IN ('online', 'offline', 'deploying', 'pending', 'error'));