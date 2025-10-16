const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('📊 Checking messages table structure...');

// Check current table structure
const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
console.log('Current columns:', tableInfo.map(col => col.name).join(', '));

const hasSystemMessage = tableInfo.some(col => col.name === 'is_system_message');
const hasSystemType = tableInfo.some(col => col.name === 'system_message_type');
const hasSystemData = tableInfo.some(col => col.name === 'system_message_data');

try {
  if (!hasSystemMessage) {
    console.log('Adding is_system_message column...');
    db.exec('ALTER TABLE messages ADD COLUMN is_system_message INTEGER DEFAULT 0');
  }

  if (!hasSystemType) {
    console.log('Adding system_message_type column...');
    db.exec('ALTER TABLE messages ADD COLUMN system_message_type TEXT');
  }

  if (!hasSystemData) {
    console.log('Adding system_message_data column...');
    db.exec('ALTER TABLE messages ADD COLUMN system_message_data TEXT');
  }

  // Create index
  console.log('Creating index...');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_project_time ON messages(project_id, created_at)');

  console.log('✅ Migration completed successfully!');
  
  // Verify
  const updatedInfo = db.prepare("PRAGMA table_info(messages)").all();
  console.log('Updated columns:', updatedInfo.map(col => col.name).join(', '));

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
