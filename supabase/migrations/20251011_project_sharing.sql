-- =====================================================
-- PROJECT SHARING FEATURE
-- Adds support for sharing projects via links with granular permissions
-- =====================================================

-- Create enum for access levels
CREATE TYPE share_access_level AS ENUM (
  'read_only',      -- Can only view project details
  'can_edit',       -- Can add feedback and corrections
  'can_chat'        -- Can access project chat
);

-- Project shares table
CREATE TABLE public.project_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  access_level share_access_level NOT NULL DEFAULT 'read_only',
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_chat BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project share access log
CREATE TABLE public.project_share_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_identifier TEXT,  -- For non-authenticated users (IP, session ID, etc.)
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT
);

-- Project chat members table (for tracking who joined the chat)
CREATE TABLE public.project_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_name TEXT,  -- For shared access users
  share_id UUID REFERENCES public.project_shares(id) ON DELETE SET NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(project_id, user_id),
  UNIQUE(project_id, guest_name)
);

-- Create indexes for better query performance
CREATE INDEX idx_project_shares_token ON public.project_shares(share_token);
CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX idx_project_share_access_log_share_id ON public.project_share_access_log(share_id);
CREATE INDEX idx_project_chat_members_project_id ON public.project_chat_members(project_id);
CREATE INDEX idx_project_chat_members_user_id ON public.project_chat_members(user_id);

-- Add RLS policies
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_share_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_chat_members ENABLE ROW LEVEL SECURITY;

-- Project shares policies
CREATE POLICY "Users can view shares they created" ON public.project_shares
  FOR SELECT USING (auth.uid() = creator_id);

CREATE POLICY "Users can create shares for their projects" ON public.project_shares
  FOR INSERT WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own shares" ON public.project_shares
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Users can delete their own shares" ON public.project_shares
  FOR DELETE USING (auth.uid() = creator_id);

-- Access log policies
CREATE POLICY "Users can view access logs for their shares" ON public.project_share_access_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.project_shares 
      WHERE id = share_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert access logs" ON public.project_share_access_log
  FOR INSERT WITH CHECK (true);

-- Chat members policies
CREATE POLICY "Users can view chat members for their projects" ON public.project_chat_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND creator_id = auth.uid()
    ) OR
    user_id = auth.uid()
  );

CREATE POLICY "Users can join project chats" ON public.project_chat_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.project_shares 
      WHERE id = share_id AND can_chat = true AND is_active = true
    )
  );

CREATE POLICY "Users can update their own chat membership" ON public.project_chat_members
  FOR UPDATE USING (user_id = auth.uid());

-- Function to generate unique share token
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 32-character token
    token := encode(gen_random_bytes(24), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := replace(token, '=', '');
    
    -- Check if token already exists
    SELECT EXISTS(SELECT 1 FROM public.project_shares WHERE share_token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Function to log share access
CREATE OR REPLACE FUNCTION log_share_access(
  p_share_token TEXT,
  p_user_id UUID DEFAULT NULL,
  p_guest_identifier TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_share_id UUID;
  v_log_id UUID;
BEGIN
  -- Get share ID from token
  SELECT id INTO v_share_id 
  FROM public.project_shares 
  WHERE share_token = p_share_token AND is_active = true;
  
  IF v_share_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive share token';
  END IF;
  
  -- Insert access log
  INSERT INTO public.project_share_access_log (
    share_id,
    user_id,
    guest_identifier,
    user_agent,
    ip_address
  ) VALUES (
    v_share_id,
    p_user_id,
    p_guest_identifier,
    p_user_agent,
    p_ip_address
  ) RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables
COMMENT ON TABLE public.project_shares IS 'Stores shareable links for projects with granular permissions';
COMMENT ON TABLE public.project_share_access_log IS 'Logs all accesses to shared projects for tracking and analytics';
COMMENT ON TABLE public.project_chat_members IS 'Tracks members who have joined project chats including shared access users';
