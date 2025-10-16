/**
 * Migration 003: Add approval_status field to video_versions table
 * Adds approval_status and feedback columns to support status management
 */

import Database from 'better-sqlite3';

export default {
  version: 3,
  name: 'add_approval_status',
  
  up: (db: Database.Database) => {
    console.log('🔄 Adding approval_status and feedback columns to video_versions table...');
    
    // Add approval_status column
    try {
      db.exec(`
        ALTER TABLE video_versions 
        ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending' 
        CHECK(approval_status IN ('pending', 'approved', 'rejected', 'corrections_needed'))
      `);
      console.log('  ✓ Added approval_status column');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
      console.log('  ⚠️ approval_status column already exists');
    }
    
    // Add feedback column for general feedback
    try {
      db.exec(`
        ALTER TABLE video_versions 
        ADD COLUMN feedback TEXT
      `);
      console.log('  ✓ Added feedback column');
    } catch (error: any) {
      if (!error.message.includes('duplicate column name')) {
        throw error;
      }
      console.log('  ⚠️ feedback column already exists');
    }
    
    // Update existing records to have approval_status based on is_approved
    try {
      db.exec(`
        UPDATE video_versions 
        SET approval_status = CASE 
          WHEN is_approved = 1 THEN 'approved'
          ELSE 'pending'
        END
        WHERE approval_status IS NULL OR approval_status = 'pending'
      `);
      console.log('  ✓ Updated existing records with approval_status');
    } catch (error: any) {
      console.log('  ⚠️ Error updating existing records:', error.message);
    }
    
    // Create index for better query performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_video_versions_approval_status ON video_versions(approval_status)');
    console.log('  ✓ Created index on approval_status');
    
    console.log('✅ Video versions table updated successfully');
  },
  
  down: (db: Database.Database) => {
    console.log('🔄 Reverting video_versions table changes...');
    
    // Drop index
    db.exec('DROP INDEX IF EXISTS idx_video_versions_approval_status');
    console.log('  ✓ Dropped index');
    
    // Note: SQLite doesn't support dropping columns easily
    // We'll just log a warning
    console.log('  ⚠️ Note: SQLite doesn\'t support dropping columns easily');
    console.log('  ⚠️ approval_status and feedback columns will remain in the table');
    
    console.log('✅ Video versions table reverted');
  }
};
