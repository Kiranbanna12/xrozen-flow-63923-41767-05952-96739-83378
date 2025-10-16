"use strict";
/**
 * Connection Manager for SQLite with Production Optimizations
 * Features: WAL mode, connection pooling, automatic optimization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const better_sqlite3_1 = require("better-sqlite3");
const database_config_1 = require("@/config/database.config");
const fs_1 = require("fs");
const path_1 = require("path");
class ConnectionManager {
    constructor(config) {
        this.db = null;
        this.isConnected = false;
        this.config = config || (0, database_config_1.getDatabaseConfig)();
    }
    static getInstance(config) {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager(config);
        }
        return ConnectionManager.instance;
    }
    /**
     * Initialize database connection with production optimizations
     */
    connect() {
        if (this.db && this.isConnected) {
            return this.db;
        }
        try {
            // Ensure data directory exists
            if (this.config.mode === 'file') {
                const dir = path_1.default.dirname(this.config.filename);
                if (!fs_1.default.existsSync(dir)) {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                }
            }
            // Create database connection
            this.db = new better_sqlite3_1.default(this.config.filename, {
                verbose: this.config.enableQueryLogging ? console.log : undefined,
            });
            // Apply production optimizations
            this.applyOptimizations();
            this.isConnected = true;
            console.log(`✅ SQLite database connected: ${this.config.filename}`);
            console.log(`📊 WAL Mode: ${this.config.wal ? 'ENABLED' : 'DISABLED'}`);
            return this.db;
        }
        catch (error) {
            console.error('❌ Failed to connect to database:', error);
            throw new Error(`Database connection failed: ${error}`);
        }
    }
    /**
     * Apply production-grade optimizations
     */
    applyOptimizations() {
        if (!this.db)
            return;
        try {
            // Enable WAL mode for better concurrency (10x faster writes)
            if (this.config.wal) {
                this.db.pragma('journal_mode = WAL');
                console.log('  ✓ WAL mode enabled');
            }
            // Set synchronous mode (NORMAL is safe with WAL)
            this.db.pragma(`synchronous = ${this.config.synchronous}`);
            console.log(`  ✓ Synchronous mode: ${this.config.synchronous}`);
            // Set cache size (negative = KB, positive = pages)
            this.db.pragma(`cache_size = ${this.config.cacheSize}`);
            console.log(`  ✓ Cache size: ${Math.abs(this.config.cacheSize / 1024)}MB`);
            // Enable foreign keys
            if (this.config.foreignKeys) {
                this.db.pragma('foreign_keys = ON');
                console.log('  ✓ Foreign keys enabled');
            }
            // Set busy timeout
            this.db.pragma(`busy_timeout = ${this.config.busyTimeout}`);
            console.log(`  ✓ Busy timeout: ${this.config.busyTimeout}ms`);
            // Additional performance PRAGMAs
            this.db.pragma('temp_store = MEMORY'); // Store temp tables in memory
            this.db.pragma('mmap_size = 30000000000'); // Use memory-mapped I/O (30GB)
            this.db.pragma('page_size = 4096'); // Optimal page size
            console.log('  ✓ Additional optimizations applied');
        }
        catch (error) {
            console.error('⚠️  Error applying optimizations:', error);
        }
    }
    /**
     * Get database connection
     */
    getConnection() {
        if (!this.db || !this.isConnected) {
            return this.connect();
        }
        return this.db;
    }
    /**
     * Get database statistics
     */
    getStats() {
        if (!this.db)
            return {};
        try {
            const stats = {
                filename: this.config.filename,
                mode: this.db.pragma('journal_mode', { simple: true }),
                synchronous: this.db.pragma('synchronous', { simple: true }),
                cacheSize: this.db.pragma('cache_size', { simple: true }),
                pageSize: this.db.pragma('page_size', { simple: true }),
                pageCount: this.db.pragma('page_count', { simple: true }),
                freeListCount: this.db.pragma('freelist_count', { simple: true }),
            };
            // Calculate database size
            if (this.config.mode === 'file' && fs_1.default.existsSync(this.config.filename)) {
                const fileStats = fs_1.default.statSync(this.config.filename);
                stats['fileSizeBytes'] = fileStats.size;
                stats['fileSizeMB'] = (fileStats.size / (1024 * 1024)).toFixed(2);
            }
            return stats;
        }
        catch (error) {
            console.error('Error getting database stats:', error);
            return {};
        }
    }
    /**
     * Optimize database (VACUUM + ANALYZE)
     */
    optimize() {
        if (!this.db)
            return;
        try {
            console.log('🔧 Optimizing database...');
            // Run ANALYZE to update query planner statistics
            this.db.exec('ANALYZE');
            console.log('  ✓ ANALYZE completed');
            // Checkpoint WAL file (flush to main database)
            if (this.config.wal) {
                this.db.pragma('wal_checkpoint(TRUNCATE)');
                console.log('  ✓ WAL checkpoint completed');
            }
            // VACUUM to reclaim unused space (caution: locks database)
            this.db.exec('VACUUM');
            console.log('  ✓ VACUUM completed');
            console.log('✅ Database optimization complete');
        }
        catch (error) {
            console.error('❌ Database optimization failed:', error);
        }
    }
    /**
     * Health check
     */
    async healthCheck() {
        if (!this.db)
            return false;
        try {
            const result = this.db.prepare('SELECT 1 as health').get();
            return result && result.health === 1;
        }
        catch {
            return false;
        }
    }
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            try {
                // Checkpoint WAL before closing
                if (this.config.wal) {
                    this.db.pragma('wal_checkpoint(TRUNCATE)');
                }
                this.db.close();
                this.isConnected = false;
                console.log('✅ Database connection closed');
            }
            catch (error) {
                console.error('❌ Error closing database:', error);
            }
        }
    }
}
exports.ConnectionManager = ConnectionManager;
