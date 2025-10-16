/**
 * Add Project Sharing Tables to SQLite Database
 * Run: node add-sharing-tables.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database file not found:', dbPath);
  process.exit(1);
}

console.log('📦 Opening database:', dbPath);
const db = new Database(dbPath);

try {
  console.log('\n🔧 Creating project sharing tables...\n');

  // 1. Project Shares Table
  console.log('Creating project_shares table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_shares (
      id TEXT PRIMARY KEY,
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
      FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ project_shares table created');

  // 2. Create indexes for project_shares
  console.log('Creating indexes for project_shares...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_shares_creator_id ON project_shares(creator_id)');
  console.log('✅ Indexes created for project_shares');

  // 3. Project Share Access Log Table
  console.log('Creating project_share_access_log table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_share_access_log (
      id TEXT PRIMARY KEY,
      share_id TEXT NOT NULL,
      user_id TEXT,
      guest_identifier TEXT,
      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ project_share_access_log table created');

  // 4. Create indexes for access log
  console.log('Creating indexes for project_share_access_log...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_share_access_log_share_id ON project_share_access_log(share_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_share_access_log_user_id ON project_share_access_log(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_share_access_log_accessed_at ON project_share_access_log(accessed_at)');
  console.log('✅ Indexes created for project_share_access_log');

  // 5. Project Chat Members Table
  console.log('Creating project_chat_members table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_chat_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT,
      guest_name TEXT,
      share_id TEXT,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ project_chat_members table created');

  // 6. Create indexes for chat members
  console.log('Creating indexes for project_chat_members...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON project_chat_members(project_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON project_chat_members(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_project_chat_members_share_id ON project_chat_members(share_id)');
  console.log('✅ Indexes created for project_chat_members');

  // Verify tables were created
  console.log('\n📊 Verifying tables...');
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    AND (name LIKE '%share%' OR name LIKE '%chat%')
    ORDER BY name
  `).all();

  console.log('\n✅ Found tables:');
  tables.forEach(table => {
    console.log('  -', table.name);
  });

  console.log('\n🎉 Project sharing tables added successfully!');
  console.log('\n📝 Summary:');
  console.log('  ✓ project_shares - Store share links');
  console.log('  ✓ project_share_access_log - Track who accessed shares');
  console.log('  ✓ project_chat_members - Manage chat participants');
  console.log('\n💡 Restart your server to use the new tables!');

} catch (error) {
  console.error('\n❌ Error creating tables:', error.message);
  process.exit(1);
} finally {
  db.close();
  console.log('\n📦 Database connection closed');
}
