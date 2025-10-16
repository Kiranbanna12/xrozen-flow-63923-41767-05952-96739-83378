/**
 * Make User Admin Script
 * Creates user account and assigns admin role for kiranbanna12@gmail.com
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const path = require('path');

// Configuration
const TARGET_EMAIL = 'kiranbanna12@gmail.com';
const DEFAULT_PASSWORD = 'admin123'; // Change this after first login
const DEFAULT_NAME = 'Kiran Banna Admin';

// Database connection
const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');
const db = new Database(dbPath);

async function makeUserAdmin() {
  console.log('🔧 Making user admin:', TARGET_EMAIL);

  try {
    // Check if user already exists
    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(TARGET_EMAIL);
    
    let userId;
    
    if (!existingUser) {
      console.log('👤 Creating new user...');
      
      // Create new user
      userId = randomUUID();
      const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
      
      // Insert into users table
      db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, user_category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(userId, TARGET_EMAIL, hashedPassword, DEFAULT_NAME, 'agency');
      
      // Insert into profiles table
      db.prepare(`
        INSERT INTO profiles (id, email, full_name, user_category, subscription_tier, subscription_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(userId, TARGET_EMAIL, DEFAULT_NAME, 'agency', 'premium', 1);
      
      console.log('✅ User created successfully');
      console.log(`📧 Email: ${TARGET_EMAIL}`);
      console.log(`🔑 Default Password: ${DEFAULT_PASSWORD}`);
      console.log('⚠️  Please change the password after first login');
      
    } else {
      userId = existingUser.id;
      console.log('ℹ️  User already exists:', TARGET_EMAIL);
      
      // Update user category to agency if not already
      if (existingUser.user_category !== 'agency') {
        db.prepare('UPDATE users SET user_category = ? WHERE id = ?').run('agency', userId);
        db.prepare('UPDATE profiles SET user_category = ? WHERE id = ?').run('agency', userId);
        console.log('✅ Updated user category to agency');
      }
    }
    
    // Check if user already has admin role
    const existingRole = db.prepare('SELECT * FROM user_roles WHERE user_id = ? AND role = ?').get(userId, 'agency');
    
    if (!existingRole) {
      console.log('🔐 Assigning admin role...');
      
      // Insert admin role
      db.prepare(`
        INSERT INTO user_roles (id, user_id, role, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(randomUUID(), userId, 'agency');
      
      console.log('✅ Admin role assigned successfully');
    } else {
      console.log('ℹ️  User already has admin role');
    }
    
    // Verify admin status
    const adminRole = db.prepare('SELECT * FROM user_roles WHERE user_id = ? AND role = ?').get(userId, 'agency');
    const userProfile = db.prepare('SELECT * FROM profiles WHERE id = ?').get(userId);
    
    console.log('\n📋 Final Status:');
    console.log('- User ID:', userId);
    console.log('- Email:', TARGET_EMAIL);
    console.log('- User Category:', userProfile.user_category);
    console.log('- Has Admin Role:', adminRole ? '✅ YES' : '❌ NO');
    console.log('- Subscription Tier:', userProfile.subscription_tier);
    console.log('- Account Active:', userProfile.subscription_active ? '✅ YES' : '❌ NO');
    
    console.log('\n🎉 Operation completed successfully!');
    console.log('The user can now access admin features in the application.');
    
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Run the script
if (require.main === module) {
  makeUserAdmin()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = { makeUserAdmin };