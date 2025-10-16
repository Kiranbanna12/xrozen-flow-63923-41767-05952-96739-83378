-- Add data isolation and relationship management tables to SQLite database
-- Fixed version that handles existing notifications table schema

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

-- 5. Update existing notifications table to support new notification types
-- Add new columns if they don't exist
ALTER TABLE notifications ADD COLUMN sender_user_id TEXT;
ALTER TABLE notifications ADD COLUMN notification_type TEXT;
ALTER TABLE notifications ADD COLUMN metadata TEXT;

-- Update the type column constraint to include new notification types
-- Note: SQLite doesn't support ALTER COLUMN, so we'll create a new table and migrate data
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL,
  sender_user_id TEXT,
  notification_type TEXT NOT NULL CHECK(notification_type IN ('role_assigned', 'project_assigned', 'invitation', 'project_update', 'payment', 'info', 'warning', 'error', 'success')),
  title TEXT,
  message TEXT NOT NULL,
  read_status INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Migrate existing data to new table
INSERT INTO notifications_new (id, recipient_user_id, title, message, notification_type, read_status, created_at)
SELECT 
  id, 
  user_id as recipient_user_id, 
  title, 
  message, 
  CASE 
    WHEN type = 'info' THEN 'info'
    WHEN type = 'warning' THEN 'warning'
    WHEN type = 'error' THEN 'error'
    WHEN type = 'success' THEN 'success'
    ELSE 'info'
  END as notification_type,
  is_read as read_status,
  created_at
FROM notifications;

-- Drop old table and rename new one
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

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
