const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('📊 Creating chat_join_requests table...');

try {
  // Create chat_join_requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_join_requests (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT,
      guest_name TEXT,
      status TEXT DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      responded_at TEXT,
      responded_by TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ chat_join_requests table created');

  // Create index for faster lookups
  db.exec('CREATE INDEX IF NOT EXISTS idx_join_requests_project ON chat_join_requests(project_id, status)');
  console.log('✅ Index created on project_id and status');

  // Add rejection_reason column to project_chat_members if not exists
  const memberTableInfo = db.prepare("PRAGMA table_info(project_chat_members)").all();
  const hasRemovedBy = memberTableInfo.some(col => col.name === 'removed_by');
  const hasRemovedAt = memberTableInfo.some(col => col.name === 'removed_at');

  if (!hasRemovedBy) {
    console.log('Adding removed_by column to project_chat_members...');
    db.exec('ALTER TABLE project_chat_members ADD COLUMN removed_by TEXT');
  }

  if (!hasRemovedAt) {
    console.log('Adding removed_at column to project_chat_members...');
    db.exec('ALTER TABLE project_chat_members ADD COLUMN removed_at TEXT');
  }

  console.log('✅ Migration completed successfully!');
  
  // Verify
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_join_requests'").all();
  console.log('chat_join_requests table exists:', tables.length > 0);

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
