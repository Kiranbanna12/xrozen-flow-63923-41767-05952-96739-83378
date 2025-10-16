-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage database config" ON public.database_config;

-- Create more permissive policies for database config management
CREATE POLICY "Authenticated users can insert database config"
ON public.database_config
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update database config"
ON public.database_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete database config"
ON public.database_config
FOR DELETE
TO authenticated
USING (true);