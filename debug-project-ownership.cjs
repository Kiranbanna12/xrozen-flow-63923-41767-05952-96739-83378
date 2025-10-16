/**
 * Debug script to check project ownership and sharing issues
 * This will help identify why "Kiran Singh Rathore" is showing as shared
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-flow.db');
const db = new Database(dbPath);

console.log('🔍 Investigating Project Ownership Issues...\n');

// Get all users - try different table names
let users = [];
try {
  users = db.prepare('SELECT id, email, full_name FROM profiles').all();
} catch (e) {
  try {
    users = db.prepare('SELECT id, email, name as full_name FROM users').all();
  } catch (e2) {
    try {
      users = db.prepare('SELECT DISTINCT creator_id as id FROM projects').all();
      users = users.map(u => ({ id: u.id, email: u.id, full_name: `User ${u.id.substring(0, 8)}` }));
    } catch (e3) {
      console.error('Could not find users table');
      process.exit(1);
    }
  }
}

console.log('👥 Users in database:');
users.forEach((user, idx) => {
  console.log(`${idx + 1}. ${user.full_name || user.email} (ID: ${user.id})`);
});

console.log('\n' + '='.repeat(80) + '\n');

// For each user, check their projects
users.forEach(user => {
  console.log(`\n📊 USER: ${user.full_name || user.email} (${user.id})`);
  console.log('-'.repeat(80));
  
  // Get owned projects
  const ownedProjects = db.prepare(`
    SELECT id, name, creator_id, status 
    FROM projects 
    WHERE creator_id = ?
    ORDER BY created_at DESC
  `).all(user.id);
  
  console.log(`\n✅ OWNED PROJECTS (${ownedProjects.length}):`);
  ownedProjects.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id.substring(0, 8)}...)`);
  });
  
  // Get shared project IDs from access logs
  let sharedProjectIds = new Set();
  
  try {
    const accessLogs = db.prepare(`
      SELECT DISTINCT ps.project_id, p.name, p.creator_id
      FROM project_share_access_log psal
      JOIN project_shares ps ON psal.share_id = ps.id
      JOIN projects p ON ps.project_id = p.id
      WHERE psal.user_id = ? AND ps.is_active = 1
    `).all(user.id);
    
    console.log(`\n🔗 SHARED VIA ACCESS LOG (${accessLogs.length}):`);
    accessLogs.forEach(log => {
      sharedProjectIds.add(log.project_id);
      const isOwnProject = log.creator_id === user.id;
      console.log(`  - ${log.name} (ID: ${log.project_id.substring(0, 8)}...) ${isOwnProject ? '⚠️ OWNED BY THIS USER!' : ''}`);
      if (isOwnProject) {
        console.log(`    ⚠️  WARNING: This project is created by ${user.full_name} but appears in their share log!`);
      }
    });
  } catch (e) {
    console.log('  ⚠️  project_share_access_log table not found');
  }
  
  // Get shared project IDs from chat members
  try {
    const chatMemberships = db.prepare(`
      SELECT DISTINCT pcm.project_id, p.name, p.creator_id
      FROM project_chat_members pcm
      JOIN projects p ON pcm.project_id = p.id
      WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
    `).all(user.id);
    
    console.log(`\n💬 SHARED VIA CHAT MEMBERS (${chatMemberships.length}):`);
    chatMemberships.forEach(membership => {
      sharedProjectIds.add(membership.project_id);
      const isOwnProject = membership.creator_id === user.id;
      console.log(`  - ${membership.name} (ID: ${membership.project_id.substring(0, 8)}...) ${isOwnProject ? '⚠️ OWNED BY THIS USER!' : ''}`);
      if (isOwnProject) {
        console.log(`    ⚠️  WARNING: This project is created by ${user.full_name} but appears in their chat members!`);
      }
    });
  } catch (e) {
    console.log('  ⚠️  project_chat_members table not found');
  }
  
  // Get actual shared projects (not created by this user)
  if (sharedProjectIds.size > 0) {
    const projectIdsArray = Array.from(sharedProjectIds);
    const placeholders = projectIdsArray.map(() => '?').join(',');
    const actualSharedProjects = db.prepare(`
      SELECT id, name, creator_id, status
      FROM projects 
      WHERE id IN (${placeholders}) AND creator_id != ?
    `).all(...projectIdsArray, user.id);
    
    console.log(`\n✅ ACTUAL SHARED PROJECTS (after filtering) (${actualSharedProjects.length}):`);
    actualSharedProjects.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id.substring(0, 8)}...)`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
});

console.log('\n\n🔍 CHECKING FOR DUPLICATE/CONFLICTING ENTRIES...\n');

// Find projects that appear in both owned and shared for the same user
users.forEach(user => {
  const ownedProjects = db.prepare(`
    SELECT id, name FROM projects WHERE creator_id = ?
  `).all(user.id);
  
  const ownedIds = new Set(ownedProjects.map(p => p.id));
  
  let duplicates = [];
  
  try {
    const accessLogs = db.prepare(`
      SELECT DISTINCT ps.project_id, p.name
      FROM project_share_access_log psal
      JOIN project_shares ps ON psal.share_id = ps.id
      JOIN projects p ON ps.project_id = p.id
      WHERE psal.user_id = ? AND ps.is_active = 1
    `).all(user.id);
    
    accessLogs.forEach(log => {
      if (ownedIds.has(log.project_id)) {
        duplicates.push({ source: 'access_log', project: log.name, id: log.project_id });
      }
    });
  } catch (e) {}
  
  try {
    const chatMemberships = db.prepare(`
      SELECT DISTINCT pcm.project_id, p.name
      FROM project_chat_members pcm
      JOIN projects p ON pcm.project_id = p.id
      WHERE pcm.user_id = ? AND pcm.share_id IS NOT NULL
    `).all(user.id);
    
    chatMemberships.forEach(membership => {
      if (ownedIds.has(membership.project_id)) {
        duplicates.push({ source: 'chat_members', project: membership.name, id: membership.project_id });
      }
    });
  } catch (e) {}
  
  if (duplicates.length > 0) {
    console.log(`⚠️  USER: ${user.full_name || user.email}`);
    duplicates.forEach(dup => {
      console.log(`   - Project "${dup.project}" appears in both owned and ${dup.source}`);
      console.log(`     ID: ${dup.id.substring(0, 8)}...`);
    });
    console.log('');
  }
});

console.log('\n✅ Investigation complete!\n');

db.close();
