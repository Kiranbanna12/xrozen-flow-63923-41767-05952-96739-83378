/**
 * Migration: Add Message Read Tracking
 * Adds last_read_at to track when users last viewed a conversation
 */

import Database from 'better-sqlite3';
import { Migration } from '../core/migration.manager';

export const migration_004_add_message_read_tracking: Migration = {
  version: 4,
  name: 'add_message_read_tracking',
  
  up: (db: Database.Database) => {
    console.log('Adding message read tracking...');

    // Add last_read_at column to track when user last viewed messages in a project
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_last_read (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        last_read_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(project_id, user_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_last_read_project_id ON project_last_read(project_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_last_read_user_id ON project_last_read(user_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_project_last_read_updated_at ON project_last_read(updated_at)');

    console.log('✅ Message read tracking added successfully');
  },
  
  down: (db: Database.Database) => {
    console.log('Removing message read tracking...');
    db.exec('DROP TABLE IF EXISTS project_last_read');
    console.log('✅ Message read tracking removed successfully');
  },
};
