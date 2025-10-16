/**
 * Test script to verify AI version query fix
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('🧪 Testing AI Version Query Fix\n');

// Test patterns
const testMessages = [
  'Kiran Singh Rathore project ke version ki details batao',
  'thggf is project ki details do',
  'kiran singh rathore ke versions batao',
  'thggf project versions'
];

console.log('📝 Test Messages:');
testMessages.forEach((msg, i) => console.log(`  ${i + 1}. "${msg}"`));
console.log('');

// Test pattern extraction
console.log('🔍 Pattern Extraction Test:\n');

testMessages.forEach(msg => {
  let projectNameMatch = msg.match(/(?:^|\s)([a-zA-Z\s]+?)(?:\s+project|\s+ke|\s+ka|\s+ki)/i);
  if (!projectNameMatch) projectNameMatch = msg.match(/^([a-zA-Z\s]+?)(?:\s+is\s+project|\s+project)/i);
  if (!projectNameMatch) projectNameMatch = msg.match(/^([a-zA-Z\s]+?)(?:\s+version|\s+details|\s+ke)/i);
  
  const extracted = projectNameMatch ? projectNameMatch[1].trim() : 'NOT FOUND';
  console.log(`  Input: "${msg}"`);
  console.log(`  Extracted: "${extracted}"`);
  console.log('');
});

// Test database queries
console.log('💾 Database Query Test:\n');

const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC LIMIT 5').all();
console.log(`Found ${projects.length} projects in database:\n`);

projects.forEach((p, i) => {
  console.log(`${i + 1}. "${p.name}" (ID: ${p.id.substring(0, 8)}...)`);
  
  // Query versions for this project
  const versions = db.prepare(`
    SELECT 
      v.*,
      COUNT(f.id) as feedback_count
    FROM video_versions v
    LEFT JOIN video_feedback f ON v.id = f.version_id
    WHERE v.project_id = ?
    GROUP BY v.id
    ORDER BY v.version_number DESC
  `).all(p.id);
  
  if (versions.length > 0) {
    console.log(`   ✅ ${versions.length} version(s):`);
    versions.forEach(v => {
      console.log(`      - Version ${v.version_number}: ${v.approval_status} (${v.feedback_count} feedback)`);
    });
  } else {
    console.log(`   ⚠️  No versions`);
  }
  console.log('');
});

// Test matching logic
console.log('🎯 Matching Logic Test:\n');

const testSearches = [
  { search: 'kiran', expected: 'Kiran Singh Rathore' },
  { search: 'thggf', expected: 'thggf' },
  { search: 'rathore', expected: 'Kiran Singh Rathore' }
];

testSearches.forEach(test => {
  const found = projects.find(p => 
    p.name.toLowerCase().includes(test.search.toLowerCase()) ||
    test.search.toLowerCase().includes(p.name.toLowerCase())
  );
  
  const result = found ? `✅ Found: "${found.name}"` : `❌ Not found`;
  console.log(`  Search: "${test.search}" → ${result}`);
});

console.log('\n✅ Test complete!\n');
console.log('📌 Expected Behavior:');
console.log('   1. Pattern should extract project name correctly');
console.log('   2. Matching logic should find projects by partial name');
console.log('   3. Database query should return versions with feedback count');
console.log('   4. Direct intercept should handle queries before AI models\n');

db.close();
