-- Add system message support to messages table
-- Migration: Add system message fields

-- Check and add columns if they don't exist
PRAGMA table_info(messages);

-- Add is_system_message column
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- These will fail if column exists, which is fine for re-running

-- Create index for system messages
CREATE INDEX IF NOT EXISTS idx_messages_system ON messages(project_id, created_at);
