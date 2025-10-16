/**
 * Test script to debug project update issue
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('📊 Connected to database');

// Test project ID from the error
const projectId = '258d2986-1d37-4c46-94ca-8ea7222de163';

// Check if project exists
const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
console.log('\n🔍 Project found:', project ? 'YES' : 'NO');
if (project) {
  console.log('Project details:', project);
}

// Try to simulate an update
if (project) {
  try {
    const testData = {
      name: 'Test Update',
      description: 'Test description'
    };
    
    const updateFields = Object.keys(testData);
    const setClause = updateFields.map(field => `${field} = ?`).join(', ');
    const values = updateFields.map(field => testData[field]);
    const now = new Date().toISOString();
    
    console.log('\n📝 Test Update:');
    console.log('SQL:', `UPDATE projects SET ${setClause}, updated_at = ? WHERE id = ?`);
    console.log('Values:', [...values, now, projectId]);
    
    const result = db.prepare(`
      UPDATE projects 
      SET ${setClause}, updated_at = ?
      WHERE id = ?
    `).run(...values, now, projectId);
    
    console.log('✅ Update successful:', result);
    
    // Revert the change
    db.prepare(`
      UPDATE projects 
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `).run(project.name, project.description, project.updated_at, projectId);
    
    console.log('✅ Reverted changes');
  } catch (error) {
    console.error('❌ Update failed:', error.message);
    console.error('Full error:', error);
  }
}

// Check for foreign key constraints
console.log('\n🔧 Foreign Key Status:');
const fkStatus = db.pragma('foreign_keys');
console.log('Foreign keys enabled:', fkStatus);

db.close();
console.log('\n✅ Test complete');
