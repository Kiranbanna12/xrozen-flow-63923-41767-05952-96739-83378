const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'video-editing.db');
console.log('Database path:', dbPath);

try {
    const db = new Database(dbPath);

    console.log('Creating transactions table...');

    // Create transactions table
    db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      editor_id TEXT,
      client_id TEXT,
      invoice_id TEXT,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      payment_method TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (editor_id) REFERENCES profiles(id) ON DELETE SET NULL,
      FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
    )
  `);

    console.log('✅ Transactions table created successfully!');

    // Verify table was created
    const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='transactions'
  `).all();

    console.log('Table exists:', tables.length > 0);

    // Get columns
    const columns = db.prepare('PRAGMA table_info(transactions)').all();
    console.log('\nColumns:');
    columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type})`);
    });

    db.close();
    console.log('\n✅ Database setup complete!');
} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
