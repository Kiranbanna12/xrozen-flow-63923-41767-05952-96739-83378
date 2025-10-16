/**
 * Add Multi-Role Pricing Columns to Projects Table
 * 
 * This migration adds separate pricing columns for different roles:
 * - client_fee: Amount client pays (Client's Expense)
 * - editor_fee: Amount editor receives (Editor's Revenue)
 * - agency_margin: Agency's profit (client_fee - editor_fee)
 * - fee: Kept for backward compatibility
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
console.log('📁 Opening database:', dbPath);

const db = new Database(dbPath);

try {
  console.log('🔧 Starting migration: Add pricing columns...\n');

  // Start transaction
  db.exec('BEGIN TRANSACTION');

  // Check if columns already exist
  const tableInfo = db.prepare('PRAGMA table_info(projects)').all();
  const columnNames = tableInfo.map(col => col.name);

  console.log('📋 Current columns:', columnNames.join(', '));

  // Add client_fee column if not exists
  if (!columnNames.includes('client_fee')) {
    console.log('➕ Adding client_fee column...');
    db.exec('ALTER TABLE projects ADD COLUMN client_fee REAL DEFAULT 0');
    console.log('✅ client_fee column added');
  } else {
    console.log('⏭️  client_fee column already exists');
  }

  // Add editor_fee column if not exists
  if (!columnNames.includes('editor_fee')) {
    console.log('➕ Adding editor_fee column...');
    db.exec('ALTER TABLE projects ADD COLUMN editor_fee REAL DEFAULT 0');
    console.log('✅ editor_fee column added');
  } else {
    console.log('⏭️  editor_fee column already exists');
  }

  // Add agency_margin column if not exists
  if (!columnNames.includes('agency_margin')) {
    console.log('➕ Adding agency_margin column...');
    db.exec('ALTER TABLE projects ADD COLUMN agency_margin REAL DEFAULT 0');
    console.log('✅ agency_margin column added');
  } else {
    console.log('⏭️  agency_margin column already exists');
  }

  // Migrate existing fee data
  console.log('\n🔄 Migrating existing data...');
  const projectsWithFee = db.prepare('SELECT id, fee, creator_id FROM projects WHERE fee > 0').all();
  
  if (projectsWithFee.length > 0) {
    console.log(`📊 Found ${projectsWithFee.length} projects with fees to migrate`);
    
    const updateStmt = db.prepare(`
      UPDATE projects 
      SET client_fee = ?, 
          editor_fee = ?, 
          agency_margin = 0 
      WHERE id = ?
    `);

    let migratedCount = 0;
    for (const project of projectsWithFee) {
      // For existing projects, assume fee is both client and editor fee
      // Agency can adjust later
      updateStmt.run(project.fee, project.fee, project.id);
      migratedCount++;
    }

    console.log(`✅ Migrated ${migratedCount} projects`);
  } else {
    console.log('ℹ️  No projects with fees to migrate');
  }

  // Commit transaction
  db.exec('COMMIT');

  // Verify changes
  console.log('\n🔍 Verifying changes...');
  const updatedTableInfo = db.prepare('PRAGMA table_info(projects)').all();
  const updatedColumnNames = updatedTableInfo.map(col => col.name);
  
  const requiredColumns = ['client_fee', 'editor_fee', 'agency_margin'];
  const allPresent = requiredColumns.every(col => updatedColumnNames.includes(col));

  if (allPresent) {
    console.log('✅ All pricing columns present:', requiredColumns.join(', '));
    
    // Show sample data
    const sampleProjects = db.prepare(`
      SELECT id, name, fee, client_fee, editor_fee, agency_margin 
      FROM projects 
      LIMIT 5
    `).all();

    if (sampleProjects.length > 0) {
      console.log('\n📊 Sample projects with pricing:');
      console.table(sampleProjects);
    }
  } else {
    throw new Error('Migration verification failed');
  }

  console.log('\n✨ SUCCESS! Pricing columns migration completed!');
  console.log('\n📝 Next Steps:');
  console.log('1. Update Dashboard to show role-based revenue/expense');
  console.log('2. Update Projects page to allow setting separate prices');
  console.log('3. Update Invoice system for role-based billing');
  console.log('4. Test with different user roles (editor, client, agency)');

} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  db.exec('ROLLBACK');
  process.exit(1);
} finally {
  db.close();
  console.log('\n🔒 Database connection closed');
}
