const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'video-editing.db');
console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath);

    // Check if transactions table exists
    const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='transactions'
  `).all();

    console.log('Transactions table exists:', tables.length > 0);

    if (tables.length > 0) {
        // Get table schema
        const schema = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='transactions'
    `).get();
        console.log('\nTable Schema:\n', schema.sql);

        // Get columns
        const columns = db.prepare('PRAGMA table_info(transactions)').all();
        console.log('\nColumns:');
        columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
        });

        // Count rows
        const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
        console.log('\nTotal transactions:', count.count);
    } else {
        console.log('\nTransactions table does NOT exist!');
        console.log('Need to create it.');
    }

    db.close();
} catch (error) {
    console.error('Error:', error.message);
}
