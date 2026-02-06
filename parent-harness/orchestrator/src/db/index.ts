import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, readFileSync } from 'fs';

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
 * Run migrations from schema.sql
 */
export function migrate(): void {
  const schemaPath = join(__dirname, '../../..', 'database', 'schema.sql');
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Database migrated successfully');
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
