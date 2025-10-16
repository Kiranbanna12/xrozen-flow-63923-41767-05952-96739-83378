const Database = require('better-sqlite3');
const db = new Database('./data/xrozen-dev.db');

console.log('\n📊 Checking Sub-Projects Structure:\n');

const allProjects = db.prepare(`
  SELECT id, name, parent_project_id, is_subproject, creator_id 
  FROM projects 
  ORDER BY created_at DESC 
  LIMIT 20
`).all();

console.log('All Recent Projects:');
allProjects.forEach(p => {
  const isSubProject = p.is_subproject === 1;
  const marker = isSubProject ? '  └─' : '📁';
  console.log(`${marker} ${p.name}`);
  console.log(`     ID: ${p.id}`);
  console.log(`     Parent: ${p.parent_project_id || 'None'}`);
  console.log(`     Is Sub-Project: ${isSubProject}`);
  console.log(`     Creator: ${p.creator_id}`);
  console.log('');
});

// Check if there are any sub-projects
const subProjects = db.prepare('SELECT COUNT(*) as count FROM projects WHERE is_subproject = 1').get();
console.log(`\n✅ Total Sub-Projects: ${subProjects.count}`);

// Check parent-child relationships
const parents = db.prepare(`
  SELECT DISTINCT parent_project_id, 
         (SELECT name FROM projects WHERE id = p.parent_project_id) as parent_name
  FROM projects p 
  WHERE parent_project_id IS NOT NULL
`).all();

if (parents.length > 0) {
  console.log('\n📋 Parent-Child Relationships:');
  parents.forEach(parent => {
    console.log(`\nParent: ${parent.parent_name} (${parent.parent_project_id})`);
    const children = db.prepare(`
      SELECT name, id, creator_id 
      FROM projects 
      WHERE parent_project_id = ?
    `).all(parent.parent_project_id);
    
    children.forEach(child => {
      console.log(`  └─ ${child.name} (${child.id})`);
      console.log(`     Creator: ${child.creator_id}`);
    });
  });
}

db.close();
console.log('\n✅ Check complete\n');
