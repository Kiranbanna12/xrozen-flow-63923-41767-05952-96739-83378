-- Quick check and create project sharing tables if they don't exist
-- Run this in your database to set up the sharing feature

-- Check if tables exist
DO $$
BEGIN
    -- Create project_shares table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_shares') THEN
        CREATE TABLE public.project_shares (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
            creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
            share_token TEXT NOT NULL UNIQUE,
            can_view BOOLEAN NOT NULL DEFAULT true,
            can_edit BOOLEAN NOT NULL DEFAULT false,
            can_chat BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        
        CREATE INDEX idx_project_shares_token ON public.project_shares(share_token);
        CREATE INDEX idx_project_shares_project_id ON public.project_shares(project_id);
        
        RAISE NOTICE 'Created project_shares table';
    END IF;

    -- Create project_share_access_log table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_share_access_log') THEN
        CREATE TABLE public.project_share_access_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
            guest_identifier TEXT,
            accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            user_agent TEXT,
            ip_address TEXT
        );
        
        CREATE INDEX idx_project_share_access_log_share_id ON public.project_share_access_log(share_id);
        
        RAISE NOTICE 'Created project_share_access_log table';
    END IF;

    -- Create project_chat_members table if it doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'project_chat_members') THEN
        CREATE TABLE public.project_chat_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
            user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
            guest_name TEXT,
            share_id UUID REFERENCES public.project_shares(id) ON DELETE SET NULL,
            joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            is_active BOOLEAN NOT NULL DEFAULT true,
            UNIQUE(project_id, user_id),
            UNIQUE(project_id, guest_name)
        );
        
        CREATE INDEX idx_project_chat_members_project_id ON public.project_chat_members(project_id);
        CREATE INDEX idx_project_chat_members_user_id ON public.project_chat_members(user_id);
        
        RAISE NOTICE 'Created project_chat_members table';
    END IF;
    
    RAISE NOTICE 'Project sharing tables setup complete!';
END $$;
