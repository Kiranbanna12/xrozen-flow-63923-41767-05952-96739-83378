const db = require('better-sqlite3')('./data/xrozen-dev.db');

try {
  const table = db.prepare('SELECT sql FROM sqlite_master WHERE type=? AND name=?').get('table', 'notifications');
  
  if (table) {
    console.log('✅ Notifications table exists:');
    console.log(table.sql);
  } else {
    console.log('❌ Notifications table NOT FOUND');
  }

  // Check all tables
  console.log('\n📋 All tables in database:');
  const tables = db.prepare('SELECT name FROM sqlite_master WHERE type=? ORDER BY name').all('table');
  tables.forEach(t => console.log('  -', t.name));

} catch (error) {
  console.error('Error:', error);
} finally {
  db.close();
}
