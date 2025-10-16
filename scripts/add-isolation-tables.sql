-- Add data isolation and relationship management tables to SQLite database

-- 1. Add 'added_by' column to clients table for ownership tracking
ALTER TABLE clients ADD COLUMN added_by TEXT;

-- 2. Add 'added_by' column to editors table for ownership tracking
ALTER TABLE editors ADD COLUMN added_by TEXT;

-- 3. Create user_relationships table for reciprocal relationships
CREATE TABLE IF NOT EXISTS user_relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  related_user_id TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK(role_type IN ('editor', 'client', 'manager')),
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'revoked')),
  created_at TEXT NOT NULL,
  UNIQUE(user_id, related_user_id, role_type)
);

-- 4. Create pending_invitations table for email-based invitations
CREATE TABLE IF NOT EXISTS pending_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK(role_type IN ('editor', 'client')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired')),
  created_at TEXT NOT NULL,
  accepted_at TEXT
);

-- 5. Create notifications table (if not exists)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  sender_user_id TEXT,
  notification_type TEXT NOT NULL CHECK(notification_type IN ('role_assigned', 'project_assigned', 'invitation', 'project_update', 'payment')),
  message TEXT NOT NULL,
  read_status INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  metadata TEXT -- JSON string for additional data
);

-- 6. Create project_access table for proper project permissions
CREATE TABLE IF NOT EXISTS project_access (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'view' CHECK(access_level IN ('view', 'edit', 'admin')),
  assigned_at TEXT NOT NULL,
  UNIQUE(project_id, user_id)
);

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_added_by ON clients(added_by);
CREATE INDEX IF NOT EXISTS idx_editors_added_by ON editors(added_by);
CREATE INDEX IF NOT EXISTS idx_user_relationships_user_id ON user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_related_user_id ON user_relationships(related_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_user_id ON project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_project_id ON project_access(project_id);
