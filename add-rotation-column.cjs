const Database = require("better-sqlite3");
const db = new Database("./data/xrozen-dev.db");

try {
  // Add last_used_at column to ai_api_keys table
  db.exec(`
    ALTER TABLE ai_api_keys 
    ADD COLUMN last_used_at TEXT DEFAULT NULL
  `);
  
  console.log("✅ Added last_used_at column to ai_api_keys table");
  
  // Add request_count column for tracking
  db.exec(`
    ALTER TABLE ai_api_keys 
    ADD COLUMN request_count INTEGER DEFAULT 0
  `);
  
  console.log("✅ Added request_count column to ai_api_keys table");
  
  // Add temporary_inactive column for failed keys
  db.exec(`
    ALTER TABLE ai_api_keys 
    ADD COLUMN temporary_inactive INTEGER DEFAULT 0
  `);
  
  console.log("✅ Added temporary_inactive column to ai_api_keys table");
  
  // Add inactive_until column for auto-recovery
  db.exec(`
    ALTER TABLE ai_api_keys 
    ADD COLUMN inactive_until TEXT DEFAULT NULL
  `);
  
  console.log("✅ Added inactive_until column to ai_api_keys table");
  
  console.log("🎉 All rotation columns added successfully!");
  
} catch (error) {
  if (error.message.includes("duplicate column name")) {
    console.log("ℹ️ Columns already exist, skipping migration");
  } else {
    console.error("❌ Error:", error.message);
  }
} finally {
  db.close();
}
