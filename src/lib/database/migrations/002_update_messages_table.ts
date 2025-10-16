/**
 * Migration 002: Update Messages Table
 * Add reply_to_message_id field for message threading
 */

import { Migration } from '../core/migration.manager';

export const migration_002_update_messages_table: Migration = {
  version: 2,
  name: 'update_messages_table',
  up: (db) => {
    // Check if reply_to_message_id column exists
    const tableInfo = db.prepare("PRAGMA table_info(messages)").all();
    const hasReplyColumn = tableInfo.some((col: any) => col.name === 'reply_to_message_id');
    
    if (!hasReplyColumn) {
      db.exec(`
        ALTER TABLE messages 
        ADD COLUMN reply_to_message_id TEXT REFERENCES messages(id)
      `);
    }
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN easily, so we skip rollback
    console.log('Rollback for reply_to_message_id column not supported in SQLite');
  }
};

export default migration_002_update_messages_table;
