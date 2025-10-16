const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('📊 Checking SQLite Database Tables...\n');

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all();

console.log('✅ Found', tables.length, 'tables:');
tables.forEach(t => console.log('  -', t.name));

// Check critical tables
const criticalTables = ['profiles', 'projects', 'video_versions', 'video_feedback', 'editors', 'clients'];

console.log('\n🔍 Checking critical tables:');
criticalTables.forEach(table => {
  const exists = tables.some(t => t.name === table);
  console.log(`  ${exists ? '✅' : '❌'} ${table}`);
});

db.close();
