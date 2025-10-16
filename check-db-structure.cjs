/**
 * Check database structure
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-flow.db');
const db = new Database(dbPath);

console.log('📊 Database Tables:\n');

const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' 
  ORDER BY name
`).all();

tables.forEach(table => {
  console.log(`- ${table.name}`);
  
  // Get column info
  const columns = db.prepare(`PRAGMA table_info(${table.name})`).all();
  columns.forEach(col => {
    console.log(`  → ${col.name} (${col.type})`);
  });
  console.log('');
});

db.close();
