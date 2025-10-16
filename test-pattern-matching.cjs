/**
 * Test pattern matching for version queries
 */

const testMessages = [
  'give me version details of Kiran Singh Rathore Project',
  'Kiran Singh Rathore project ke version ki details batao',
  'thggf is project ki details do',
  'give me feedbacks of both versions',
  'kiran ke versions batao'
];

console.log('🧪 Testing Pattern Matching\n');

testMessages.forEach((msg, i) => {
  console.log(`Test ${i + 1}: "${msg}"`);
  
  // Pattern 1: "PROJECT ke version" (Hindi) - most specific, try first
  let match = msg.match(/^([a-zA-Z]+(?: [a-zA-Z]+)*?)\s+(?:ke|ka|ki)\s+(?:version|feedback|details)/i);
  
  // Pattern 2: "PROJECT project ke version"
  if (!match) match = msg.match(/^([a-zA-Z]+(?: [a-zA-Z]+)*?)\s+project/i);
  
  // Pattern 3: "version details of PROJECT Project" or "feedback of PROJECT"
  if (!match) match = msg.match(/(?:version|feedback|details|feedbacks)\s+(?:of|for)\s+([a-zA-Z]+(?: [a-zA-Z]+)*?)(?:\s+project)?$/i);
  
  // Pattern 4: Just look for known project names
  if (!match) {
    for (const p of projects) {
      if (msg.toLowerCase().includes(p.name.toLowerCase())) {
        match = [null, p.name];
        break;
      }
    }
  }
  
  if (match && match[1]) {
    console.log(`  ✅ Extracted: "${match[1].trim()}"`);
  } else {
    console.log(`  ❌ No match`);
  }
  console.log('');
});

// Test project names
const projects = [
  { name: 'Kiran Singh Rathore', id: '1' },
  { name: 'thggf', id: '2' },
  { name: 'Test Project', id: '3' }
];

console.log('🎯 Testing Project Matching\n');

const searchTests = [
  'Kiran Singh Rathore',
  'kiran',
  'rathore',
  'thggf',
  'test'
];

searchTests.forEach(search => {
  const found = projects.find(p => {
    const pNameLower = p.name.toLowerCase();
    const searchLower = search.toLowerCase();
    return pNameLower.includes(searchLower) || 
           searchLower.includes(pNameLower) ||
           pNameLower === searchLower;
  });
  
  console.log(`Search: "${search}" → ${found ? `✅ Found: "${found.name}"` : '❌ Not found'}`);
});

console.log('\n✅ Pattern matching test complete!');
