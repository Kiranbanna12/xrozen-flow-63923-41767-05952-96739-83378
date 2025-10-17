-- Ensure Supabase is set as the active database provider
-- First, deactivate any existing configs
UPDATE public.database_config SET is_active = false WHERE is_active = true;

-- Insert Supabase as the active provider if not exists
INSERT INTO public.database_config (provider, is_active, config)
VALUES ('supabase', true, '{}'::jsonb)
ON CONFLICT DO NOTHING;

-- If the insert didn't happen due to conflict, ensure at least one Supabase config is active
UPDATE public.database_config 
SET is_active = true 
WHERE provider = 'supabase' 
AND id = (SELECT id FROM public.database_config WHERE provider = 'supabase' LIMIT 1);