/**
 * Test script to check if "Kiran Singh Rathore" project exists and has versions
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('🔍 Testing "Kiran Singh Rathore" project...\n');

// Test 1: Find the project
console.log('1️⃣ Searching for project...');
const project = db.prepare(`
  SELECT id, name, creator_id, status 
  FROM projects 
  WHERE LOWER(name) = LOWER(?)
`).get('Kiran Singh Rathore');

if (!project) {
  console.log('❌ Project not found!');
  process.exit(1);
}

console.log('✅ Project found:');
console.log(`   ID: ${project.id}`);
console.log(`   Name: ${project.name}`);
console.log(`   Creator: ${project.creator_id}`);
console.log(`   Status: ${project.status}\n`);

// Test 2: Check for versions
console.log('2️⃣ Checking for versions...');
const versions = db.prepare(`
  SELECT * FROM video_versions 
  WHERE project_id = ?
  ORDER BY version_number DESC
`).all(project.id);

console.log(`✅ Found ${versions.length} version(s)\n`);

if (versions.length > 0) {
  versions.forEach(v => {
    console.log(`   Version ${v.version_number}:`);
    console.log(`     ID: ${v.id}`);
    console.log(`     Status: ${v.approval_status}`);
    console.log(`     Uploaded: ${v.created_at}`);
    console.log('');
  });
  
  // Test 3: Check for feedback
  console.log('3️⃣ Checking for feedback...');
  versions.forEach(v => {
    const feedback = db.prepare(`
      SELECT * FROM video_feedback 
      WHERE version_id = ?
    `).all(v.id);
    
    console.log(`   Version ${v.version_number}: ${feedback.length} feedback(s)`);
  });
} else {
  console.log('⚠️  No versions found for this project');
}

// Test 4: Check table existence
console.log('\n4️⃣ Checking table existence...');
const tables = db.prepare(`
  SELECT name FROM sqlite_master 
  WHERE type='table' AND name IN ('projects', 'video_versions', 'video_feedback')
`).all();

console.log('   Tables found:', tables.map(t => t.name).join(', '));

db.close();
console.log('\n✅ Test complete!');
