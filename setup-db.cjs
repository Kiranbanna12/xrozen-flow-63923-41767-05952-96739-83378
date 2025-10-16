const db = require("better-sqlite3")("./data/xrozen-dev.db");
db.exec("CREATE TABLE IF NOT EXISTS project_shares (id TEXT PRIMARY KEY, project_id TEXT, creator_id TEXT, share_token TEXT UNIQUE, can_view INTEGER DEFAULT 1, can_edit INTEGER DEFAULT 0, can_chat INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT)");
db.exec("CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token)");
db.exec("CREATE TABLE IF NOT EXISTS project_share_access_log (id TEXT PRIMARY KEY, share_id TEXT, user_id TEXT, accessed_at TEXT)");
db.exec("CREATE TABLE IF NOT EXISTS project_chat_members (id TEXT PRIMARY KEY, project_id TEXT, user_id TEXT, guest_name TEXT, joined_at TEXT, is_active INTEGER DEFAULT 1)");
console.log(" All tables created!");
db.close();
