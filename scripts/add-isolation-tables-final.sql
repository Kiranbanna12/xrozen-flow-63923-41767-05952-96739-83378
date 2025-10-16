-- Add data isolation and relationship management tables to SQLite database
-- Safe version that only adds missing tables and updates notifications

-- 1. Create user_relationships table for reciprocal relationships
CREATE TABLE IF NOT EXISTS user_relationships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  related_user_id TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK(role_type IN ('editor', 'client', 'manager')),
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'revoked')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, related_user_id, role_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (related_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (initiated_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Create pending_invitations table for email-based invitations
CREATE TABLE IF NOT EXISTS pending_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK(role_type IN ('editor', 'client')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'expired')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  accepted_at TEXT,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Update existing notifications table to support new notification types
-- Create new notifications table with enhanced schema
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

-- 4. Create project_access table for proper project permissions
CREATE TABLE IF NOT EXISTS project_access (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'view' CHECK(access_level IN ('view', 'edit', 'admin')),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_added_by ON clients(added_by);
CREATE INDEX IF NOT EXISTS idx_editors_added_by ON editors(added_by);
CREATE INDEX IF NOT EXISTS idx_user_relationships_user_id ON user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_related_user_id ON user_relationships(related_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_user_id ON project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_project_access_project_id ON project_access(project_id);
