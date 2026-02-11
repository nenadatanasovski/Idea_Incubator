import Database from "better-sqlite3";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
} from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Canonical DB path - parent-harness/data/harness.db unless HARNESS_DB_PATH is explicitly set.
const DEFAULT_DATA_DIR = join(__dirname, "../../..", "data");
const configuredDbPath = process.env.HARNESS_DB_PATH?.trim();
const DB_PATH = configuredDbPath
  ? resolve(configuredDbPath)
  : join(DEFAULT_DATA_DIR, "harness.db");
const DATA_DIR = dirname(DB_PATH);
const BACKUP_DIR = join(DATA_DIR, "backups");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}
if (!existsSync(BACKUP_DIR)) {
  mkdirSync(BACKUP_DIR, { recursive: true });
}

const walPath = `${DB_PATH}-wal`;
const shmPath = `${DB_PATH}-shm`;
if (!existsSync(DB_PATH) && (existsSync(walPath) || existsSync(shmPath))) {
  throw new Error(
    `Detected WAL/SHM without base DB at ${DB_PATH}. Refusing blind startup; restore DB or recover explicitly.`,
  );
}

// Create database connection
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

function pauseSpawningForIntegrity(reason: string): void {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    run(
      `INSERT OR REPLACE INTO system_state (key, value, updated_at)
       VALUES ('spawning_paused', 'true', datetime('now'))`,
    );
    run(
      `INSERT OR REPLACE INTO system_state (key, value, updated_at)
       VALUES ('db_integrity_error', ?, datetime('now'))`,
      [reason.slice(0, 1000)],
    );
  } catch {
    // Best-effort only.
  }
}

export function verifyDatabaseIntegrity(): void {
  const quickCheck = db.pragma("quick_check", { simple: true }) as string;
  if (quickCheck !== "ok") {
    const reason = `PRAGMA quick_check failed: ${quickCheck}`;
    pauseSpawningForIntegrity(reason);
    throw new Error(reason);
  }
}

/**
 * Run a query that returns rows
 */
export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Run a query that modifies data
 */
export function run(sql: string, params: unknown[] = []): Database.RunResult {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Get a single row
 */
export function getOne<T = unknown>(
  sql: string,
  params: unknown[] = [],
): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

/**
 * Execute raw SQL (for migrations)
 */
export function exec(sql: string): void {
  db.exec(sql);
}

/**
 * Run migrations from schema.sql and migrations folder
 */
export function migrate(): void {
  verifyDatabaseIntegrity();

  // Run main schema
  const schemaPath = join(__dirname, "../../..", "database", "schema.sql");
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);
  console.log("✅ Base schema migrated successfully");

  // Run additional migrations from migrations folder (idempotent-by-design scripts only)
  const migrationsDir = join(__dirname, "../../..", "database", "migrations");
  if (existsSync(migrationsDir)) {
    const migrations = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const migration of migrations) {
      const migrationPath = join(migrationsDir, migration);
      const sql = readFileSync(migrationPath, "utf-8");

      try {
        db.exec(sql);
      } catch (err: unknown) {
        // Ignore common idempotent migration errors.
        const errMsg = err instanceof Error ? err.message : String(err);
        if (
          !errMsg.includes("already exists") &&
          !errMsg.includes("duplicate column")
        ) {
          throw err;
        }
        console.warn(`⚠️ Migration warning (${migration}): ${errMsg}`);
      }
      console.log(`✅ Migration applied: ${migration}`);
    }
  }

  verifySchemaAlignment();

  console.log("✅ All migrations complete");
}

function tableExists(tableName: string): boolean {
  const row = getOne<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return !!row;
}

function columnExists(tableName: string, columnName: string): boolean {
  const rows = query<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

export function verifySchemaAlignment(): void {
  const requiredTables = [
    "tasks",
    "agents",
    "agent_sessions",
    "iteration_logs",
    "observability_events",
    "cron_ticks",
    "system_state",
    "task_retry_attempts",
  ];

  for (const table of requiredTables) {
    if (!tableExists(table)) {
      throw new Error(
        `Schema verification failed: missing required table "${table}"`,
      );
    }
  }

  const requiredColumns: Array<[string, string]> = [
    ["tasks", "retry_count"],
    ["tasks", "wave_number"],
    ["agents", "type"],
    ["agents", "current_task_id"],
    ["agent_sessions", "metadata"],
  ];
  for (const [table, column] of requiredColumns) {
    if (!columnExists(table, column)) {
      throw new Error(
        `Schema verification failed: missing column ${table}.${column}`,
      );
    }
  }
}

export function checkpointDatabase(): void {
  db.pragma("wal_checkpoint(TRUNCATE)");
}

export function backupDatabase(reason: string = "periodic"): string {
  checkpointDatabase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(BACKUP_DIR, `harness-${reason}-${stamp}.db`);
  copyFileSync(DB_PATH, backupPath);
  return backupPath;
}

export function runMaintenanceCheckpointAndBackup(
  reason: string = "periodic",
): string {
  verifyDatabaseIntegrity();
  return backupDatabase(reason);
}

/**
 * Close the database connection
 */
export function close(): void {
  db.close();
}

/**
 * Get the database instance (for advanced operations)
 */
export function getDb(): Database.Database {
  return db;
}

export function getDatabasePath(): string {
  return DB_PATH;
}

export default {
  query,
  run,
  getOne,
  exec,
  migrate,
  verifyDatabaseIntegrity,
  verifySchemaAlignment,
  checkpointDatabase,
  backupDatabase,
  runMaintenanceCheckpointAndBackup,
  close,
  getDb,
  getDatabasePath,
};
