/**
 * Test Script to Generate Sample AI Usage Data
 * Run this ONCE to populate initial data for testing
 * 
 * Usage: node test-ai-usage.cjs
 */

const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

// Open database
const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

console.log('🧪 Generating sample AI usage data...\n');

// Get existing models and users
const models = db.prepare('SELECT * FROM ai_models WHERE enabled = 1').all();
const users = db.prepare('SELECT id FROM profiles LIMIT 5').all();

if (models.length === 0) {
  console.log('❌ No AI models found. Please add models first from Admin Panel.');
  process.exit(1);
}

if (users.length === 0) {
  console.log('❌ No users found. Please register a user first.');
  process.exit(1);
}

console.log(`✅ Found ${models.length} models and ${users.length} users\n`);

// Pricing table (per 1M tokens)
const pricing = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'gpt-3.5-turbo-16k': { input: 3, output: 4 },
  'gemini-2.5-pro': { input: 1.25, output: 5 },
  'gemini-2.5-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-pro': { input: 0.5, output: 1.5 }
};

// Generate random requests for each model
const totalRequests = 50; // Total number of sample requests
let generatedCount = 0;
let totalCost = 0;

const insert = db.prepare(`
  INSERT INTO ai_request_logs (
    id, model_id, user_id, request_tokens, response_tokens, 
    total_tokens, response_time_ms, success, error_message, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  for (let i = 0; i < totalRequests; i++) {
    const model = models[Math.floor(Math.random() * models.length)];
    const user = users[Math.floor(Math.random() * users.length)];
    
    // Generate realistic token counts
    const requestTokens = Math.floor(Math.random() * 2000) + 100; // 100-2100
    const responseTokens = Math.floor(Math.random() * 1500) + 50; // 50-1550
    const totalTokens = requestTokens + responseTokens;
    
    // Generate realistic response time (500-3000ms)
    const responseTime = Math.floor(Math.random() * 2500) + 500;
    
    // 95% success rate
    const success = Math.random() > 0.05 ? 1 : 0;
    const errorMessage = success ? null : 'Rate limit exceeded';
    
    // Random timestamp in last 7 days
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 24);
    const createdAt = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000)).toISOString();
    
    // Calculate cost for this request
    if (!model.is_free && pricing[model.model_id]) {
      const modelPricing = pricing[model.model_id];
      const inputCost = (requestTokens / 1000000) * modelPricing.input;
      const outputCost = (responseTokens / 1000000) * modelPricing.output;
      totalCost += inputCost + outputCost;
    }
    
    insert.run(
      randomUUID(),
      model.id,
      user.id,
      requestTokens,
      responseTokens,
      totalTokens,
      responseTime,
      success,
      errorMessage,
      createdAt
    );
    
    generatedCount++;
  }
});

try {
  transaction();
  
  console.log('✅ Sample data generated successfully!\n');
  console.log('📊 Summary:');
  console.log(`   - Total Requests: ${generatedCount}`);
  console.log(`   - Estimated Cost: $${totalCost.toFixed(4)}`);
  console.log(`   - Models Used: ${models.length}`);
  console.log(`   - Date Range: Last 7 days\n`);
  
  // Get statistics
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
      SUM(total_tokens) as tokens
    FROM ai_request_logs
  `).get();
  
  console.log('📈 Current Database Stats:');
  console.log(`   - Total Logged Requests: ${stats.total}`);
  console.log(`   - Successful Requests: ${stats.successful}`);
  console.log(`   - Total Tokens Used: ${stats.tokens.toLocaleString()}\n`);
  
  console.log('🎯 Next Step: Go to Admin Panel → AI Models → Usage & Cost tab');
  
} catch (error) {
  console.error('❌ Error generating sample data:', error.message);
}

db.close();
