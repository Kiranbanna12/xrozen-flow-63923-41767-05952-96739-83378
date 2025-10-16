/**
 * Create Project Sharing Tables in SQLite
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'data', 'xrozen-dev.db');
console.log('📁 Opening database:', dbPath);

const db = new Database(dbPath);

try {
  console.log('🔧 Creating project_shares table...');
  
  // Create project_shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_shares (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      share_token TEXT NOT NULL UNIQUE,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_edit INTEGER NOT NULL DEFAULT 0,
      can_chat INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `);
  
  console.log('✅ project_shares table created');

  console.log('🔧 Creating indexes for project_shares...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token);
    CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
  `);
  console.log('✅ Indexes created');

  console.log('🔧 Creating project_share_access_log table...');
  
  // Create project_share_access_log table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_share_access_log (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      share_id TEXT NOT NULL,
      user_id TEXT,
      guest_identifier TEXT,
      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL
    );
  `);
  
  console.log('✅ project_share_access_log table created');

  console.log('🔧 Creating index for project_share_access_log...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_share_access_log_share_id ON project_share_access_log(share_id);
  `);
  console.log('✅ Index created');

  console.log('🔧 Creating project_chat_members table...');
  
  // Create project_chat_members table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_chat_members (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      project_id TEXT NOT NULL,
      user_id TEXT,
      guest_name TEXT,
      share_id TEXT,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE SET NULL
    );
  `);
  
  console.log('✅ project_chat_members table created');

  console.log('🔧 Creating indexes for project_chat_members...');
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON project_chat_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON project_chat_members(user_id);
  `);
  console.log('✅ Indexes created');

  // Verify tables exist
  console.log('\n🔍 Verifying tables...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND name IN ('project_shares', 'project_share_access_log', 'project_chat_members')
  `).all();
  
  console.log('✅ Tables found:', tables.map(t => t.name).join(', '));
  
  if (tables.length === 3) {
    console.log('\n🎉 SUCCESS! All 3 tables created successfully!');
    console.log('📊 Tables:');
    console.log('   1. project_shares');
    console.log('   2. project_share_access_log');
    console.log('   3. project_chat_members');
    console.log('\n✅ Ab aap server restart karke test kar sakte hain!');
  } else {
    console.log('\n⚠️ Warning: Only', tables.length, 'tables found');
  }

} catch (error) {
  console.error('❌ Error creating tables:', error.message);
  process.exit(1);
} finally {
  db.close();
  console.log('\n📁 Database connection closed');
}
