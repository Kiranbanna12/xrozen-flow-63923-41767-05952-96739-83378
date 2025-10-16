const Database = require('better-sqlite3');const Database = require('better-sqlite3');

const path = require('path');const path = require('path');



const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');const dbPath = path.join(__dirname, 'data', 'xrozen-dev.db');



console.log('📦 Opening database:', dbPath);console.log('📦 Opening database:', dbPath);



let db;let db;

try {try {

  db = new Database(dbPath);  db = new Database(dbPath);

  console.log('✅ Database opened successfully\n');  console.log('✅ Database opened successfully');

} catch (err) {} catch (err) {

  console.error('❌ Error opening database:', err);  console.error('❌ Error opening database:', err);

  process.exit(1);  process.exit(1);

}}



try {// Create tables

  // Create project_shares tabletry {

  console.log('🔨 Creating project_shares table...');  console.log('\n🔨 Creating project_shares table...');

  db.exec(`  db.exec(`

    CREATE TABLE IF NOT EXISTS project_shares (    CREATE TABLE IF NOT EXISTS project_shares (

      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

      project_id TEXT NOT NULL,      project_id TEXT NOT NULL,

      creator_id TEXT NOT NULL,      creator_id TEXT NOT NULL,

      share_token TEXT NOT NULL UNIQUE,      share_token TEXT NOT NULL UNIQUE,

      can_view INTEGER NOT NULL DEFAULT 1,      can_view INTEGER NOT NULL DEFAULT 1,

      can_edit INTEGER NOT NULL DEFAULT 0,      can_edit INTEGER NOT NULL DEFAULT 0,

      can_chat INTEGER NOT NULL DEFAULT 0,      can_chat INTEGER NOT NULL DEFAULT 0,

      is_active INTEGER NOT NULL DEFAULT 1,      is_active INTEGER NOT NULL DEFAULT 1,

      expires_at TEXT,      expires_at TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),      created_at TEXT NOT NULL DEFAULT (datetime('now')),

      updated_at TEXT NOT NULL DEFAULT (datetime('now')),      updated_at TEXT NOT NULL DEFAULT (datetime('now')),

      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

      FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE      FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE CASCADE

    )    )

  `);  `, (err) => {

  console.log('✅ project_shares table created');    if (err) {

      console.error('❌ Error creating project_shares:', err);

  console.log('🔨 Creating indexes for project_shares...');    } else {

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token)`);      console.log('✅ project_shares table created');

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id)`);    }

  console.log('✅ Indexes created');  });



  // Create project_share_access_log table  console.log('🔨 Creating indexes for project_shares...');

  console.log('\n🔨 Creating project_share_access_log table...');  db.run(`CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token)`, (err) => {

  db.exec(`    if (err) console.error('❌ Error creating token index:', err);

    CREATE TABLE IF NOT EXISTS project_share_access_log (    else console.log('✅ Token index created');

      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),  });

      share_id TEXT NOT NULL,

      user_id TEXT,  db.run(`CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id)`, (err) => {

      guest_identifier TEXT,    if (err) console.error('❌ Error creating project_id index:', err);

      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),    else console.log('✅ Project ID index created');

      user_agent TEXT,  });

      ip_address TEXT,

      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE CASCADE,  console.log('\n🔨 Creating project_share_access_log table...');

      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL  db.run(`

    )    CREATE TABLE IF NOT EXISTS project_share_access_log (

  `);      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  console.log('✅ project_share_access_log table created');      share_id TEXT NOT NULL,

      user_id TEXT,

  console.log('🔨 Creating index for project_share_access_log...');      guest_identifier TEXT,

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_share_access_log_share_id ON project_share_access_log(share_id)`);      accessed_at TEXT NOT NULL DEFAULT (datetime('now')),

  console.log('✅ Index created');      user_agent TEXT,

      ip_address TEXT,

  // Create project_chat_members table      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE CASCADE,

  console.log('\n🔨 Creating project_chat_members table...');      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL

  db.exec(`    )

    CREATE TABLE IF NOT EXISTS project_chat_members (  `, (err) => {

      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),    if (err) {

      project_id TEXT NOT NULL,      console.error('❌ Error creating project_share_access_log:', err);

      user_id TEXT,    } else {

      guest_name TEXT,      console.log('✅ project_share_access_log table created');

      share_id TEXT,    }

      joined_at TEXT NOT NULL DEFAULT (datetime('now')),  });

      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),

      is_active INTEGER NOT NULL DEFAULT 1,  console.log('🔨 Creating index for project_share_access_log...');

      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,  db.run(`CREATE INDEX IF NOT EXISTS idx_project_share_access_log_share_id ON project_share_access_log(share_id)`, (err) => {

      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,    if (err) console.error('❌ Error creating share_id index:', err);

      FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE SET NULL    else console.log('✅ Share ID index created');

    )  });

  `);

  console.log('✅ project_chat_members table created');  console.log('\n🔨 Creating project_chat_members table...');

  db.run(`

  console.log('🔨 Creating indexes for project_chat_members...');    CREATE TABLE IF NOT EXISTS project_chat_members (

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON project_chat_members(project_id)`);      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  db.exec(`CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON project_chat_members(user_id)`);      project_id TEXT NOT NULL,

  console.log('✅ Indexes created');      user_id TEXT,

      guest_name TEXT,

  // Verify tables were created      share_id TEXT,

  console.log('\n🔍 Verifying tables...');      joined_at TEXT NOT NULL DEFAULT (datetime('now')),

  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_%' ORDER BY name`).all();      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),

        is_active INTEGER NOT NULL DEFAULT 1,

  console.log('✅ Tables in database:');      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,

  tables.forEach(row => console.log('   -', row.name));      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,

        FOREIGN KEY (share_id) REFERENCES project_shares(id) ON DELETE SET NULL

  const hasAllTables =     )

    tables.some(r => r.name === 'project_shares') &&  `, (err) => {

    tables.some(r => r.name === 'project_share_access_log') &&    if (err) {

    tables.some(r => r.name === 'project_chat_members');      console.error('❌ Error creating project_chat_members:', err);

    } else {

  if (hasAllTables) {      console.log('✅ project_chat_members table created');

    console.log('\n✨ SUCCESS! All tables created successfully!');    }

    console.log('\n👉 Ab apna backend server restart karein:');  });

    console.log('   1. Terminal mein Ctrl+C dabayein');

    console.log('   2. npm run dev ya bun run dev chalayen');  console.log('🔨 Creating indexes for project_chat_members...');

    console.log('   3. Browser refresh karein');  db.run(`CREATE INDEX IF NOT EXISTS idx_project_chat_members_project_id ON project_chat_members(project_id)`, (err) => {

    console.log('   4. Share button try karein!\n');    if (err) console.error('❌ Error creating project_id index:', err);

  } else {    else console.log('✅ Project ID index created');

    console.log('\n⚠️  Warning: Some tables might be missing');  });

  }

  db.run(`CREATE INDEX IF NOT EXISTS idx_project_chat_members_user_id ON project_chat_members(user_id)`, (err) => {

} catch (err) {    if (err) console.error('❌ Error creating user_id index:', err);

  console.error('❌ Error creating tables:', err);    else console.log('✅ User ID index created');

  process.exit(1);  });

} finally {

  db.close();  // Verify tables were created

  console.log('🔒 Database connection closed');  setTimeout(() => {

}    console.log('\n🔍 Verifying tables...');

    db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'project_%' ORDER BY name`, (err, rows) => {
      if (err) {
        console.error('❌ Error verifying tables:', err);
      } else {
        console.log('✅ Tables in database:');
        rows.forEach(row => console.log('   -', row.name));
        
        if (rows.some(r => r.name === 'project_shares')) {
          console.log('\n✨ SUCCESS! All tables created successfully!');
          console.log('👉 Ab apna backend server restart karein:');
          console.log('   1. Terminal mein Ctrl+C dabayein');
          console.log('   2. npm run dev ya bun run dev chalayen');
          console.log('   3. Browser refresh karein aur share button try karein!');
        }
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
        } else {
          console.log('\n🔒 Database connection closed');
        }
        process.exit(0);
      });
    });
  }, 1000);
});
