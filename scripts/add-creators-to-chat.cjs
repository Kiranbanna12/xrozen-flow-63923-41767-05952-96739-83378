const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('📊 Adding project creators to chat members...');

try {
  // Get all projects
  const projects = db.prepare('SELECT id, creator_id FROM projects').all();
  console.log(`Found ${projects.length} projects`);

  let addedCount = 0;
  let skippedCount = 0;

  for (const project of projects) {
    // Check if creator is already a member
    const existingMember = db.prepare(`
      SELECT * FROM project_chat_members 
      WHERE project_id = ? AND user_id = ? AND is_active = 1
    `).get(project.id, project.creator_id);

    if (existingMember) {
      skippedCount++;
      continue;
    }

    // Add creator as member
    const memberId = `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO project_chat_members (
        id, project_id, user_id, joined_at, is_active
      ) VALUES (?, ?, ?, ?, 1)
    `).run(memberId, project.id, project.creator_id, now);

    addedCount++;
    console.log(`✅ Added creator to project ${project.id.substring(0, 8)}...`);
  }

  console.log(`\n✅ Migration completed!`);
  console.log(`   Added: ${addedCount} creators`);
  console.log(`   Skipped: ${skippedCount} (already members)`);

} catch (error) {
  console.error('❌ Migration failed:', error.message);
  process.exit(1);
} finally {
  db.close();
}
