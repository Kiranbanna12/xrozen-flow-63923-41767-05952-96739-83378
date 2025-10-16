/**
 * Migration: Add delivered_to and read_by columns to messages table
 * For proper message status tracking in group chats
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/xrozen-dev.db');
const db = new Database(dbPath);

console.log('🔧 Starting migration: Add message status tracking columns...');
console.log('🔧 Database path:', dbPath);

try {
  // Check if columns already exist
  const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
  const hasDeliveredTo = tableInfo.some(col => col.name === 'delivered_to');
  const hasReadBy = tableInfo.some(col => col.name === 'read_by');

  if (!hasDeliveredTo) {
    console.log('Adding delivered_to column...');
    db.exec(`
      ALTER TABLE messages 
      ADD COLUMN delivered_to TEXT DEFAULT '[]'
    `);
    console.log('✅ Added delivered_to column');
  } else {
    console.log('✓ delivered_to column already exists');
  }

  if (!hasReadBy) {
    console.log('Adding read_by column...');
    db.exec(`
      ALTER TABLE messages 
      ADD COLUMN read_by TEXT DEFAULT '[]'
    `);
    console.log('✅ Added read_by column');
  } else {
    console.log('✓ read_by column already exists');
  }

  console.log('✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
