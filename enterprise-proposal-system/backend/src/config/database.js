/**
 * Enterprise Proposal System - Database Configuration
 * Multi-Database Architecture for High Availability & Performance
 *
 * Layer Teknologi:
 * - Backend: FastAPI/Node.js (Microservice)
 * - Data Layer: SQLite3 (Multi-Database Setup)
 * - Frontend: Next.js (React), TypeScript, Tailwind CSS
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import winston from 'winston';

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] [DATABASE]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/database.log',
      level: 'info'
    }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Database paths - Multiple isolated databases
const DATABASES = {
  // Primary writer database - High Availability
  PRIMARY: {
    path: path.join(process.cwd(), 'databases', 'core_proposal_workflow.sqlite'),
    description: 'Primary Writer Database - Core Proposal Workflow',
    mode: 'write',
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: 10000,
    tempStore: 'MEMORY',
    maxWriteWPS: 95
  },

  // Read replica for analytics & reporting (Bab 7 Reporting)
  ANALYTICS_REPLICA: {
    path: path.join(process.cwd(), 'databases', 'analytics_replica.sqlite'),
    description: 'Analytics Replica Node - Read-Heavy Operations',
    mode: 'read',
    journalMode: 'WAL',
    synchronous: 'OFF',
    cacheSize: 20000,
    tempStore: 'MEMORY',
    readOnly: true
  },

  // Read replica for dashboard & kanban (Bab 10 & 12)
  DASHBOARD_REPLICA: {
    path: path.join(process.cwd(), 'databases', 'dashboard_replica.sqlite'),
    description: 'Dashboard Replica Node - Kanban & Interactive Dashboard',
    mode: 'read',
    journalMode: 'WAL',
    synchronous: 'OFF',
    cacheSize: 15000,
    tempStore: 'MEMORY',
    readOnly: true,
    websocketUpdates: true
  },

  // DMS metadata database (Bab 8)
  DMS_METADATA: {
    path: path.join(process.cwd(), 'databases', 'dms_meta.sqlite'),
    description: 'DMS Metadata Database - File Management',
    mode: 'read-write',
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    cacheSize: 5000,
    tempStore: 'MEMORY'
  },

  // Audit trail database (Bab 16)
  AUDIT_LOG: {
    path: path.join(process.cwd(), 'databases', 'audit_log.sqlite'),
    description: 'Audit Trail Database - Immutable Security Logs',
    mode: 'append',
    journalMode: 'WAL',
    synchronous: 'FULL',
    cacheSize: 2000,
    tempStore: 'MEMORY'
  }
};

// Database connection pool
class DatabasePool {
  constructor(config) {
    this.config = config;
    this.connections = new Map();
    this.poolSize = 10;
    this.maxConnections = 20;
  }

  getConnection(dbName) {
    const dbConfig = DATABASES[dbName];
    if (!dbConfig) {
      throw new Error(`Database ${dbName} not found`);
    }

    const key = `${dbName}_${Math.random().toString(36).substr(2, 9)}`;

    if (!this.connections.has(key)) {
      const conn = new Database(dbConfig.path, {
        fileMustExist: false,
        readonly: dbConfig.readOnly || false,
        verbose: process.env.NODE_ENV === 'development'
      });

      // Apply database configuration
      this.configureConnection(conn, dbConfig);

      this.connections.set(key, conn);

      // Limit pool size
      if (this.connections.size > this.maxConnections) {
        const oldestKey = this.connections.keys().next().value;
        const oldConn = this.connections.get(oldestKey);
        oldConn.close();
        this.connections.delete(oldestKey);
      }
    }

    return this.connections.get(key);
  }

  configureConnection(conn, config) {
    // Enable WAL mode for concurrency
    conn.pragma('journal_mode', config.journalMode);

    // Set synchronous mode
    conn.pragma('synchronous', config.synchronous);

    // Configure cache
    conn.pragma('cache_size', config.cacheSize);

    // Set temp store
    conn.pragma('temp_store', config.tempStore);

    // Enable foreign keys
    conn.pragma('foreign_keys', 'ON');

    // Optimize for performance
    conn.pragma('mmap_size', 268435456); // 256MB

    // Set busy timeout
    conn.pragma('busy_timeout', 30000);

    // Set locking mode
    conn.pragma('locking_mode', 'NORMAL');

    logger.info(`Database configured: ${config.description}`);
  }

  closeConnection(dbName) {
    const keysToDelete = [];
    for (const [key, conn] of this.connections.entries()) {
      if (key.startsWith(dbName + '_')) {
        conn.close();
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.connections.delete(key));
  }

  closeAll() {
    for (const [key, conn] of this.connections.entries()) {
      conn.close();
    }
    this.connections.clear();
  }
}

// Single database instance manager
class DatabaseManager {
  constructor() {
    this.connections = new Map();
    this.pool = new DatabasePool();
    this.writeWPSCounter = 0;
    this.writeWPSResetTime = Date.now();
  }

  async initialize() {
    logger.info('Initializing Enterprise Proposal System Databases...');

    // Ensure database directory exists
    const dbDir = path.dirname(DATABASES.PRIMARY.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize all databases
    for (const [dbName, config] of Object.entries(DATABASES)) {
      await this.createDatabase(dbName, config);
      logger.info(`✅ Database initialized: ${config.description}`);
    }

    // Start replication daemon
    this.startReplicationDaemon();

    // Start WPS monitoring
    this.startWPSMonitoring();
  }

  async createDatabase(dbName, config) {
    const conn = new Database(config.path, {
      fileMustExist: false,
      verbose: process.env.NODE_ENV === 'development'
    });

    try {
      // Apply configuration
      this.pool.configureConnection(conn, config);

      // Create tables based on database type
      await this.createTables(dbName, conn);

      conn.close();

      logger.info(`✅ Database created: ${dbName} - ${config.description}`);
    } catch (error) {
      logger.error(`❌ Failed to create database ${dbName}: ${error.message}`);
      throw error;
    }
  }

  async createTables(dbName, conn) {
    switch (dbName) {
      case DATABASES.PRIMARY:
        await this.createPrimaryTables(conn);
        break;
      case DATABASES.ANALYTICS_REPLICA:
        await this.createAnalyticsTables(conn);
        break;
      case DATABASES.DASHBOARD_REPLICA:
        await this.createDashboardTables(conn);
        break;
      case DATABASES.DMS_METADATA:
        await this.createDMSTables(conn);
        break;
      case DATABASES.AUDIT_LOG:
        await this.createAuditTables(conn);
        break;
    }
  }

  async createPrimaryTables(conn) {
    const tables = [
      // Users table with RBAC
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        department TEXT,
        is_active SMALLINT DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT,
        session_token TEXT,
        preferences TEXT
      )`,

      // Opportunities table
      `CREATE TABLE IF NOT EXISTS opportunities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        client_name TEXT NOT NULL,
        rfp_file_path TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'prospecting',
        estimated_value REAL,
        currency TEXT DEFAULT 'USD',
        probability REAL DEFAULT 0.0,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Proposals table
      `CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        opportunity_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        client_name TEXT,
        estimated_value REAL,
        currency TEXT DEFAULT 'USD',
        compliance_score REAL DEFAULT 0.0,
        win_probability REAL DEFAULT 0.0,
        ai_generated SMALLINT DEFAULT 0,
        template_used TEXT,
        created_by TEXT,
        assigned_po TEXT,
        assigned_bs TEXT,
        submitted_at TEXT,
        approved_at TEXT,
        version INTEGER DEFAULT 1,
        file_path TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      // Proposal versions for version control
      `CREATE TABLE IF NOT EXISTS proposal_versions (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        changes_summary TEXT,
        status TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id)
      )`,

      // Tasks table
      `CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        proposal_id TEXT,
        type TEXT NOT NULL, -- 'technical_input', 'drafting', 'review', 'approval'
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        assigned_by TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        due_date TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id)
      )`,

      // Approvals table
      `CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        approver_id TEXT NOT NULL,
        level INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        comments TEXT,
        approved_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id),
        FOREIGN KEY (approver_id) REFERENCES users(id)
      )`,

      // AI compliance checks
      `CREATE TABLE IF NOT EXISTS compliance_checks (
        id TEXT PRIMARY KEY,
        proposal_id TEXT NOT NULL,
        check_type TEXT NOT NULL,
        score REAL,
        issues TEXT,
        recommendations TEXT,
        checked_by TEXT,
        checked_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proposal_id) REFERENCES proposals(id)
      )`
    ];

    for (const table of tables) {
      conn.exec(table);
    }
    conn.close();
  }

  async createAnalyticsTables(conn) {
    // Tables for analytics and reporting (Bab 7)
    const tables = [
      `CREATE TABLE IF NOT EXISTS analytics_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_name TEXT NOT NULL,
        metric_value REAL,
        metric_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        time_period TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS proposal_performance (
        id TEXT PRIMARY KEY,
        proposal_id TEXT,
        cycle_time_seconds REAL,
        approval_cycle_time REAL,
        revision_count INTEGER,
        compliance_score_final REAL,
        submitted_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS team_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team TEXT NOT NULL,
        member_id TEXT,
        metric TEXT,
        value REAL,
        date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      conn.exec(table);
    }
    conn.close();
  }

  async createDashboardTables(conn) {
    // Tables for dashboard and kanban (Bab 10 & 12)
    const tables = [
      `CREATE TABLE IF NOT EXISTS dashboard_widgets (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        widget_type TEXT NOT NULL,
        title TEXT,
        config TEXT,
        position INTEGER,
        is_visible SMALLINT DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS kanban_lanes (
        id TEXT PRIMARY KEY,
        team TEXT DEFAULT 'bs',
        name TEXT NOT NULL,
        position INTEGER,
        color TEXT DEFAULT '#6B7280',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS kanban_cards (
        id TEXT PRIMARY KEY,
        lane_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        proposal_id TEXT,
        assigned_to TEXT,
        due_date TEXT,
        status TEXT DEFAULT 'todo',
        priority TEXT DEFAULT 'medium',
        metadata TEXT,
        position INTEGER DEFAULT 999,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS real_time_updates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        update_type TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        data TEXT,
        room_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      conn.exec(table);
    }
    conn.close();
  }

  async createDMSTables(conn) {
    // DMS metadata tables (Bab 8)
    const tables = [
      `CREATE TABLE IF NOT EXISTS dms_folders (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_id TEXT,
        name TEXT NOT NULL,
        path TEXT UNIQUE NOT NULL,
        folder_type TEXT DEFAULT 'custom',
        permissions TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS dms_files (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        filename TEXT NOT NULL,
        file_path TEXT UNIQUE NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        mime_type TEXT,
        checksum TEXT,
        metadata TEXT,
        version INTEGER DEFAULT 1,
        signed_url TEXT,
        expires_at TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS dms_access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id TEXT,
        user_id TEXT,
        action TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      conn.exec(table);
    }
    conn.close();
  }

  async createAuditTables(conn) {
    // Audit trail tables (Bab 16)
    const tables = [
      `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user_id TEXT,
        user_role TEXT,
        ip_address TEXT,
        user_agent TEXT,
        old_values TEXT,
        new_values TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        session_id TEXT
      )`,

      `CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        description TEXT,
        user_id TEXT,
        ip_address TEXT,
        response_status TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS compliance_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        compliance_type TEXT NOT NULL,
        requirement_id TEXT,
        status TEXT NOT NULL,
        details TEXT,
        evidence TEXT,
        verified_by TEXT,
        verified_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      conn.exec(table);
    }
    conn.close();
  }

  // Connection management
  getPrimaryConnection() {
    return this.pool.getConnection('PRIMARY');
  }

  getAnalyticsConnection() {
    return this.pool.getConnection('ANALYTICS_REPLICA');
  }

  getDashboardConnection() {
    return this.pool.getConnection('DASHBOARD_REPLICA');
  }

  getDMSConnection() {
    return this.pool.getConnection('DMS_METADATA');
  }

  getAuditConnection() {
    return this.pool.getConnection('AUDIT_LOG');
  }

  // Write WPS monitoring (Bab 7)
  incrementWriteWPS() {
    this.writeWPSCounter++;

    const now = Date.now();
    if (now - this.writeWPSResetTime >= 1000) { // Reset every second
      if (this.writeWPSCounter > DATABASES.PRIMARY.maxWriteWPS) {
        logger.warn(`⚠️ Write WPS exceeded: ${this.writeWPSCounter}/${DATABASES.PRIMARY.maxWriteWPS}`);

        // Throttle writes
        return new Promise(resolve => {
          setTimeout(resolve, 10); // 10ms delay
        });
      }

      this.writeWPSCounter = 0;
      this.writeWPSResetTime = now;
    }
  }

  getCurrentWPS() {
    const now = Date.now();
    if (now - this.writeWPSResetTime >= 1000) {
      return this.writeWPSCounter;
    }
    return this.writeWPSCounter;
  }

  // Replication daemon
  startReplicationDaemon() {
    setInterval(async () => {
      try {
        await this.replicateChanges();
      } catch (error) {
        logger.error('Replication daemon error:', error);
      }
    }, 5000); // Every 5 seconds
  }

  async replicateChanges() {
    // Replicate from PRIMARY to READ_REPLICAS
    const replicaConnections = [
      { name: 'ANALYTICS_REPLICA', conn: this.getAnalyticsConnection() },
      { name: 'DASHBOARD_REPLICA', conn: this.getDashboardConnection() }
    ];

    for (const replica of replicaConnections) {
      try {
        // Get recent changes from primary
        const primaryConn = this.getPrimaryConnection();
        const changes = primaryConn.prepare(`
          SELECT * FROM proposals
          WHERE updated_at > datetime('now', '-30 seconds')
          ORDER BY updated_at DESC
        `);

        const recentChanges = changes.all();

        // Apply changes to replica
        for (const change of recentChanges) {
          const updateStmt = replica.conn.prepare(`
            INSERT OR REPLACE INTO proposals
            (id, opportunity_id, title, description, category, status,
             client_name, estimated_value, currency, compliance_score,
             win_probability, ai_generated, template_used, created_by,
             assigned_po, assigned_bs, submitted_at, approved_at, version,
             file_path, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          updateStmt.run(
            change.id, change.opportunity_id, change.title, change.description,
            change.category, change.status, change.client_name,
            change.estimated_value, change.currency, change.compliance_score,
            change.win_probability, change.ai_generated, change.template_used,
            change.created_by, change.assigned_po, change.assigned_bs,
            change.submitted_at, change.approved_at, change.version,
            change.file_path, change.updated_at
          );
        }

        replica.conn.commit();
        logger.debug(`Replicated ${recentChanges.length} changes to ${replica.name}`);

      } catch (error) {
        logger.error(`Failed to replicate to ${replica.name}:`, error);
      }
    }
  }

  // WPS monitoring
  startWPSMonitoring() {
    setInterval(() => {
      const currentWPS = this.getCurrentWPS();
      logger.info(`📊 Current Write WPS: ${currentWPS}/${DATABASES.PRIMARY.maxWriteWPS}`);
    }, 1000); // Every second
  }

  // Utility methods
  getDatabaseConfig(dbName) {
    return DATABASES[dbName];
  }

  getAllDatabaseConfigs() {
    return DATABASES;
  }

  async close() {
    logger.info('Closing all database connections...');
    this.pool.closeAll();
    logger.info('All database connections closed');
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

export default databaseManager;
export { DATABASES, DatabasePool, DatabaseManager };
