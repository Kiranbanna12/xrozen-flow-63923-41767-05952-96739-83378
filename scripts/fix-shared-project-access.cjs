/**
 * Fix Shared Project Access - Migration Script
 * 
 * This script ensures all users who have accessed shared projects
 * have proper database entries for seamless access.
 * 
 * Fixes:
 * 1. Ensures project_access entries exist for all chat members
 * 2. Ensures chat members have proper is_active status
 * 3. Creates missing entries for editors/clients in their projects
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('🔧 Starting shared project access fix...\n');

try {
  let fixedCount = 0;
  let skippedCount = 0;

  // 1. Sync chat members to project_access
  console.log('📋 Step 1: Syncing chat members to project_access...');
  const chatMembers = db.prepare(`
    SELECT DISTINCT pcm.project_id, pcm.user_id, pcm.joined_at
    FROM project_chat_members pcm
    WHERE pcm.user_id IS NOT NULL 
      AND pcm.is_active = 1
  `).all();

  console.log(`Found ${chatMembers.length} active chat members to check`);

  for (const member of chatMembers) {
    // Check if project_access entry exists
    const existingAccess = db.prepare(`
      SELECT * FROM project_access 
      WHERE project_id = ? AND user_id = ?
    `).get(member.project_id, member.user_id);

    if (!existingAccess) {
      // Create project_access entry
      const accessId = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        db.prepare(`
          INSERT INTO project_access (
            id, project_id, user_id, assigned_by, access_level, assigned_at
          ) VALUES (?, ?, ?, ?, 'view', ?)
        `).run(accessId, member.project_id, member.user_id, member.user_id, member.joined_at);
        
        console.log(`  ✅ Created access entry: ${member.project_id.substring(0, 8)}... for user ${member.user_id.substring(0, 8)}...`);
        fixedCount++;
      } catch (error) {
        console.error(`  ⚠️ Failed to create access entry:`, error.message);
      }
    } else {
      skippedCount++;
    }
  }

  console.log(`\n📊 Step 1 Summary:`);
  console.log(`   ✅ Created: ${fixedCount} access entries`);
  console.log(`   ⏭️  Skipped: ${skippedCount} (already exist)\n`);

  // 2. Ensure editors have chat access to their projects
  console.log('📋 Step 2: Adding editors to their project chats...');
  const editorProjects = db.prepare(`
    SELECT p.id as project_id, e.user_id
    FROM projects p
    JOIN editors e ON p.editor_id = e.id
    WHERE e.user_id IS NOT NULL
  `).all();

  let editorFixedCount = 0;
  let editorSkippedCount = 0;

  console.log(`Found ${editorProjects.length} editor-project relationships to check`);

  for (const ep of editorProjects) {
    const existingMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(ep.project_id, ep.user_id);

    if (!existingMember) {
      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO project_chat_members (
            id, project_id, user_id, joined_at, is_active
          ) VALUES (?, ?, ?, ?, 1)
        `).run(memberId, ep.project_id, ep.user_id, now);
        
        console.log(`  ✅ Added editor to chat: ${ep.project_id.substring(0, 8)}... for user ${ep.user_id.substring(0, 8)}...`);
        editorFixedCount++;
      } catch (error) {
        console.error(`  ⚠️ Failed to add editor:`, error.message);
      }
    } else {
      editorSkippedCount++;
    }
  }

  console.log(`\n📊 Step 2 Summary:`);
  console.log(`   ✅ Added: ${editorFixedCount} editors`);
  console.log(`   ⏭️  Skipped: ${editorSkippedCount} (already members)\n`);

  // 3. Ensure clients have chat access to their projects
  console.log('📋 Step 3: Adding clients to their project chats...');
  const clientProjects = db.prepare(`
    SELECT p.id as project_id, c.user_id
    FROM projects p
    JOIN clients c ON p.client_id = c.id
    WHERE c.user_id IS NOT NULL
  `).all();

  let clientFixedCount = 0;
  let clientSkippedCount = 0;

  console.log(`Found ${clientProjects.length} client-project relationships to check`);

  for (const cp of clientProjects) {
    const existingMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(cp.project_id, cp.user_id);

    if (!existingMember) {
      const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      try {
        db.prepare(`
          INSERT INTO project_chat_members (
            id, project_id, user_id, joined_at, is_active
          ) VALUES (?, ?, ?, ?, 1)
        `).run(memberId, cp.project_id, cp.user_id, now);
        
        console.log(`  ✅ Added client to chat: ${cp.project_id.substring(0, 8)}... for user ${cp.user_id.substring(0, 8)}...`);
        clientFixedCount++;
      } catch (error) {
        console.error(`  ⚠️ Failed to add client:`, error.message);
      }
    } else {
      clientSkippedCount++;
    }
  }

  console.log(`\n📊 Step 3 Summary:`);
  console.log(`   ✅ Added: ${clientFixedCount} clients`);
  console.log(`   ⏭️  Skipped: ${clientSkippedCount} (already members)\n`);

  // Final summary
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ Migration completed successfully!');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Total fixed entries: ${fixedCount + editorFixedCount + clientFixedCount}`);
  console.log(`  - Project access entries: ${fixedCount}`);
  console.log(`  - Editors added to chat: ${editorFixedCount}`);
  console.log(`  - Clients added to chat: ${clientFixedCount}`);
  console.log(`\nTotal skipped (already correct): ${skippedCount + editorSkippedCount + clientSkippedCount}`);
  console.log('═══════════════════════════════════════════════════\n');

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
