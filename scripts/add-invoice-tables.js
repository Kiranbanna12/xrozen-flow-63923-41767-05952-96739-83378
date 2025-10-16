/**
 * Invoice Tables Migration Script
 * Adds invoice-related tables to existing SQLite database
 */

import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

async function addInvoiceTables() {
  console.log('🚀 Adding Invoice Tables to SQLite database...\n');

  try {
    // Connect to existing database
    const dbPath = path.join(process.cwd(), 'data', 'xrozen-dev.db');
    console.log(`📁 Database file: ${dbPath}`);

    const db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log('✅ Database connection established');

    // Create invoices table
    console.log('\n📋 Creating invoices table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        invoice_number TEXT NOT NULL UNIQUE,
        editor_id TEXT REFERENCES profiles(id),
        client_id TEXT REFERENCES profiles(id),
        creator_id TEXT NOT NULL REFERENCES profiles(id),
        month TEXT NOT NULL,
        total_amount REAL NOT NULL DEFAULT 0,
        paid_amount REAL NOT NULL DEFAULT 0,
        remaining_amount REAL NOT NULL DEFAULT 0,
        total_deductions REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'partial', 'paid')),
        payment_method TEXT,
        proceed_date TEXT,
        paid_date TEXT,
        due_date TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create invoice_items table (for projects in an invoice)
    console.log('📋 Creating invoice_items table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id),
        item_name TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create transactions table if not exists
    console.log('📋 Creating transactions table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        editor_id TEXT REFERENCES profiles(id),
        invoice_id TEXT REFERENCES invoices(id),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        transaction_date TEXT NOT NULL DEFAULT (datetime('now')),
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'expense', 'deduction')),
        payment_method TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create payment_history table for tracking partial payments
    console.log('📋 Creating payment_history table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS payment_history (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        amount REAL NOT NULL,
        payment_method TEXT,
        payment_date TEXT NOT NULL DEFAULT (datetime('now')),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // Create indexes for better performance
    console.log('📋 Creating indexes...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_invoices_editor_id ON invoices(editor_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_creator_id ON invoices(creator_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_month ON invoices(month);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_project_id ON invoice_items(project_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_editor_id ON transactions(editor_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON transactions(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_payment_history_invoice_id ON payment_history(invoice_id);
    `);

    // Create trigger for updating invoice amounts
    console.log('📋 Creating triggers...');
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_invoice_amounts
      AFTER UPDATE ON invoices
      FOR EACH ROW
      BEGIN
        UPDATE invoices 
        SET 
          remaining_amount = NEW.total_amount - NEW.paid_amount - NEW.total_deductions,
          status = CASE 
            WHEN (NEW.total_amount - NEW.paid_amount - NEW.total_deductions) <= 0 THEN 'paid'
            WHEN NEW.paid_amount > 0 AND (NEW.total_amount - NEW.paid_amount - NEW.total_deductions) > 0 THEN 'partial'
            ELSE NEW.status
          END,
          updated_at = datetime('now')
        WHERE id = NEW.id;
      END;
    `);

    // Create trigger for updating timestamps
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_invoice_timestamp
      BEFORE UPDATE ON invoices
      FOR EACH ROW
      BEGIN
        UPDATE invoices SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);

    console.log('✅ All invoice tables, indexes, and triggers created successfully');

    // Create some sample invoice data
    console.log('\n📝 Creating sample invoice data...');
    
    // Get a sample user for testing
    const sampleUser = db.prepare('SELECT id FROM profiles LIMIT 1').get();
    
    if (sampleUser) {
      const invoiceId = randomUUID();
      const itemId = randomUUID();
      
      // Create sample invoice
      db.prepare(`
        INSERT INTO invoices (
          id, invoice_number, editor_id, client_id, creator_id, 
          month, total_amount, paid_amount, remaining_amount, 
          total_deductions, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        invoiceId, 
        'INV-2024-001', 
        sampleUser.id, 
        sampleUser.id, 
        sampleUser.id, 
        '2024-10', 
        50000, 
        0, 
        50000, 
        0, 
        'pending'
      );

      // Create sample invoice item
      db.prepare(`
        INSERT INTO invoice_items (
          id, invoice_id, item_name, amount, created_at
        ) VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        itemId,
        invoiceId,
        'Video Editing - Corporate Presentation',
        50000
      );

      console.log('✅ Sample invoice data created');
    } else {
      console.log('ℹ️ No users found, skipping sample data creation');
    }

    // Get updated database statistics
    const stats = {
      invoices: db.prepare('SELECT COUNT(*) as count FROM invoices').get().count,
      invoiceItems: db.prepare('SELECT COUNT(*) as count FROM invoice_items').get().count,
      transactions: db.prepare('SELECT COUNT(*) as count FROM transactions').get().count,
      paymentHistory: db.prepare('SELECT COUNT(*) as count FROM payment_history').get().count,
      totalTables: db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get().count
    };

    console.log('\n📊 Updated Database Statistics:');
    console.log(`  Invoices: ${stats.invoices}`);
    console.log(`  Invoice Items: ${stats.invoiceItems}`);
    console.log(`  Transactions: ${stats.transactions}`);
    console.log(`  Payment History: ${stats.paymentHistory}`);
    console.log(`  Total Tables: ${stats.totalTables}`);

    // Close database connection
    db.close();
    
    console.log('\n🎉 Invoice tables migration completed successfully!');
    console.log('\n📋 Added Tables:');
    console.log('  • invoices - Main invoice records');
    console.log('  • invoice_items - Line items for each invoice');
    console.log('  • transactions - Payment and expense tracking');
    console.log('  • payment_history - Partial payment tracking');
    console.log('\n📋 Next Steps:');
    console.log('1. Restart backend server to pick up new tables');
    console.log('2. Test invoice functionality in the app');

  } catch (error) {
    console.error('❌ Invoice tables migration failed:', error);
    process.exit(1);
  }
}

// Run migration
addInvoiceTables();