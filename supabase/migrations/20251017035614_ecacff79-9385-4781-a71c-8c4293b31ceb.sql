-- Security Fix: Add admin role and update RLS policies

-- ==================== FIX 0: ADD ADMIN TO ENUM ====================
-- Add 'admin' to the existing app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- ==================== FIX 1: PROFILES TABLE ====================
-- Remove overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ==================== FIX 2: CLIENTS TABLE ====================
-- Remove overly permissive policies
DROP POLICY IF EXISTS "Users can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients" ON public.clients;

-- Users can only view their own client records
CREATE POLICY "Users can view own clients"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can only insert their own client records
CREATE POLICY "Users can insert own clients"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can only update their own client records
CREATE POLICY "Users can update own clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==================== FIX 3: EDITORS TABLE ====================
-- Remove overly permissive policies that expose salary data
DROP POLICY IF EXISTS "Users can view all editors" ON public.editors;
DROP POLICY IF EXISTS "Users can insert editors" ON public.editors;
DROP POLICY IF EXISTS "Users can update editors" ON public.editors;

-- Users can only view their own editor profile
CREATE POLICY "Users can view own editor profile"
ON public.editors
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can only insert their own editor profile
CREATE POLICY "Users can insert own editor profile"
ON public.editors
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can only update their own editor profile
CREATE POLICY "Users can update own editor profile"
ON public.editors
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ==================== FIX 4: PROJECT_TYPES TABLE ====================
-- Remove overly permissive insert policy
DROP POLICY IF EXISTS "Anyone can insert project types" ON public.project_types;

-- Only admins can insert project types
CREATE POLICY "Admins can insert project types"
ON public.project_types
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update project types
CREATE POLICY "Admins can update project types"
ON public.project_types
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete project types
CREATE POLICY "Admins can delete project types"
ON public.project_types
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ==================== FIX 5: DATABASE_CONFIG TABLE ====================
-- Remove overly permissive policy that exposes configuration
DROP POLICY IF EXISTS "Anyone can view database config" ON public.database_config;

-- Only admins can view database config
CREATE POLICY "Admins can view database config"
ON public.database_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ==================== FIX 6: ENSURE ADMIN USER ROLE ====================
-- Insert admin role for the configured admin email (if exists)
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the user ID for kiranbanna12@gmail.com
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'kiranbanna12@gmail.com'
  LIMIT 1;
  
  -- If user exists, ensure they have admin role
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;