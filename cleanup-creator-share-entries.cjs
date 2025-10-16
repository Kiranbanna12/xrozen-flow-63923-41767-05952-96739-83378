/**
 * Cleanup Script: Remove Creator from Share Access Logs and Chat Members
 * 
 * This script fixes the bug where project creators appear in their own "shared" projects list.
 * It removes:
 * 1. project_share_access_log entries where user_id = project creator_id
 * 2. project_chat_members entries where user_id = project creator_id AND share_id is NOT NULL
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-flow.db');
const db = new Database(dbPath);

console.log('🧹 Starting cleanup of creator entries in share tables...\n');

try {
  // Start transaction for safety
  db.prepare('BEGIN TRANSACTION').run();

  // 1. Find and remove project_share_access_log entries where user is the creator
  console.log('📊 Checking project_share_access_log...');
  
  try {
    const creatorAccessLogs = db.prepare(`
      SELECT psal.id, psal.user_id, p.name as project_name, p.creator_id
      FROM project_share_access_log psal
      JOIN project_shares ps ON psal.share_id = ps.id
      JOIN projects p ON ps.project_id = p.id
      WHERE psal.user_id = p.creator_id
    `).all();

    if (creatorAccessLogs.length > 0) {
      console.log(`⚠️  Found ${creatorAccessLogs.length} access log entries where user is the creator:`);
      
      creatorAccessLogs.forEach(log => {
        console.log(`   - User ${log.user_id.substring(0, 8)}... accessing their own project "${log.project_name}"`);
      });

      // Delete these entries
      const deleteCount = db.prepare(`
        DELETE FROM project_share_access_log 
        WHERE id IN (
          SELECT psal.id
          FROM project_share_access_log psal
          JOIN project_shares ps ON psal.share_id = ps.id
          JOIN projects p ON ps.project_id = p.id
          WHERE psal.user_id = p.creator_id
        )
      `).run();

      console.log(`✅ Removed ${deleteCount.changes} incorrect access log entries\n`);
    } else {
      console.log('✅ No incorrect access log entries found\n');
    }
  } catch (e) {
    console.log('⚠️  project_share_access_log table not found or error:', e.message);
  }

  // 2. Find and remove project_chat_members entries where user is the creator (via share link)
  console.log('📊 Checking project_chat_members...');
  
  try {
    const creatorChatMembers = db.prepare(`
      SELECT pcm.id, pcm.user_id, p.name as project_name, p.creator_id
      FROM project_chat_members pcm
      JOIN projects p ON pcm.project_id = p.id
      WHERE pcm.user_id = p.creator_id 
        AND pcm.share_id IS NOT NULL
    `).all();

    if (creatorChatMembers.length > 0) {
      console.log(`⚠️  Found ${creatorChatMembers.length} chat member entries where user is the creator (via share):`);
      
      creatorChatMembers.forEach(member => {
        console.log(`   - User ${member.user_id.substring(0, 8)}... in their own project "${member.project_name}"`);
      });

      // Delete these entries
      const deleteCount = db.prepare(`
        DELETE FROM project_chat_members 
        WHERE id IN (
          SELECT pcm.id
          FROM project_chat_members pcm
          JOIN projects p ON pcm.project_id = p.id
          WHERE pcm.user_id = p.creator_id 
            AND pcm.share_id IS NOT NULL
        )
      `).run();

      console.log(`✅ Removed ${deleteCount.changes} incorrect chat member entries\n`);
    } else {
      console.log('✅ No incorrect chat member entries found\n');
    }
  } catch (e) {
    console.log('⚠️  project_chat_members table not found or error:', e.message);
  }

  // Commit transaction
  db.prepare('COMMIT').run();
  
  console.log('✅ Cleanup completed successfully!');
  console.log('\n📝 Note: From now on, the API will prevent creators from being added to these tables.\n');

} catch (error) {
  console.error('❌ Error during cleanup:', error);
  
  try {
    db.prepare('ROLLBACK').run();
    console.log('🔄 Transaction rolled back');
  } catch (rollbackError) {
    console.error('❌ Rollback failed:', rollbackError);
  }
  
  process.exit(1);
}

db.close();
