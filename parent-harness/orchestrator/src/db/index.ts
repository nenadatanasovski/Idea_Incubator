import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path - ../data/harness.db relative to orchestrator root
const DATA_DIR = join(__dirname, '../../..', 'data');
const DB_PATH = join(DATA_DIR, 'harness.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Create database connection
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

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
export function getOne<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
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
  // Run main schema
  const schemaPath = join(__dirname, '../../..', 'database', 'schema.sql');
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Base schema migrated successfully');

  // Run additional migrations from migrations folder
  const migrationsDir = join(__dirname, '../../..', 'database', 'migrations');
  if (existsSync(migrationsDir)) {
    const migrations = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const migration of migrations) {
      const migrationPath = join(migrationsDir, migration);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      // Execute each statement separately to handle errors gracefully
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT CASE'));
      
      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err: unknown) {
          // Ignore "already exists" errors for idempotency
          const errMsg = err instanceof Error ? err.message : String(err);
          if (!errMsg.includes('already exists') && !errMsg.includes('duplicate column')) {
            console.warn(`⚠️ Migration statement warning: ${errMsg}`);
          }
        }
      }
      console.log(`✅ Migration applied: ${migration}`);
    }
  }
  
  console.log('✅ All migrations complete');
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

export default {
  query,
  run,
  getOne,
  exec,
  migrate,
  close,
  getDb,
};
