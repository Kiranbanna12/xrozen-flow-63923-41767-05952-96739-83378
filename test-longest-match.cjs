/**
 * Test longest-match-first logic for project names
 */

const projects = [
  { name: 'Kiran Singh', id: '1' },
  { name: 'Kiran Singh Rathore', id: '2' },
  { name: 'Test', id: '3' },
  { name: 'Test Project', id: '4' }
];

const testMessages = [
  'Kiran Singh Rathore project ke version ki details batao',
  'Kiran Singh project ke version batao',
  'Test Project ke details do',
  'Test ke details do'
];

console.log('🧪 Testing Longest-Match-First Logic\n');

testMessages.forEach(msg => {
  console.log(`Message: "${msg}"`);
  
  // Sort by length (longest first)
  const sortedProjects = [...projects].sort((a, b) => b.name.length - a.name.length);
  
  let matched = null;
  for (const p of sortedProjects) {
    if (msg.toLowerCase().includes(p.name.toLowerCase())) {
      matched = p.name;
      break;
    }
  }
  
  console.log(`  ✅ Matched: "${matched}"`);
  console.log('');
});

console.log('📊 Sorted Projects (by length):');
const sorted = [...projects].sort((a, b) => b.name.length - a.name.length);
sorted.forEach((p, i) => {
  console.log(`  ${i + 1}. "${p.name}" (length: ${p.name.length})`);
});

console.log('\n✅ Test complete!');
console.log('Expected: Longest matching name should be selected first');
