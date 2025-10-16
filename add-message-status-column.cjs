/**
 * Add status column to messages table
 */
const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
  console.log('📁 Opening database:', dbPath);
  
  const db = new Database(dbPath);
  
  // Check if column already exists
  const tableInfo = db.pragma('table_info(messages)');
  const hasStatusColumn = tableInfo.some(col => col.name === 'status');
  
  if (hasStatusColumn) {
    console.log('ℹ️  Status column already exists in messages table');
  } else {
    console.log('🔧 Adding status column to messages table...');
    db.exec(`ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'read'))`);
    console.log('✅ Status column added successfully!');
  }
  
  // Verify the column was added
  const updatedTableInfo = db.pragma('table_info(messages)');
  console.log('\n📋 Messages table columns:');
  updatedTableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  db.close();
  console.log('\n🎉 Migration completed successfully!');
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
