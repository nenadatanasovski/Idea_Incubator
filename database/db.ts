import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig } from '../config/index.js';
import { DatabaseError } from '../utils/errors.js';

let db: SqlJsDatabase | null = null;

/**
 * Initialize and get database instance
 */
export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const SQL = await initSqlJs();

    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      // Create new database
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      db = new SQL.Database();
    }

    return db;
  } catch (error) {
    throw new DatabaseError('initialize', (error as Error).message);
  }
}

/**
 * Save database to disk
 */
export async function saveDb(): Promise<void> {
  if (!db) return;

  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    throw new DatabaseError('save', (error as Error).message);
  }
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await saveDb();
    db.close();
    db = null;
  }
}

/**
 * Reload database from disk (useful when another process has written to the file)
 */
export async function reloadDb(): Promise<void> {
  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const SQL = await initSqlJs();

    // Close existing connection if any
    if (db) {
      db.close();
      db = null;
    }

    // Reload from disk
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (error) {
    throw new DatabaseError('reload', (error as Error).message);
  }
}

/**
 * Execute SQL and return results
 */
export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: (string | number | null | boolean)[] = []
): Promise<T[]> {
  const database = await getDb();

  try {
    const result = database.exec(sql, params);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(row =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]])) as T
    );
  } catch (error) {
    throw new DatabaseError('query', (error as Error).message);
  }
}

/**
 * Execute SQL without returning results
 */
export async function run(
  sql: string,
  params: (string | number | null | boolean)[] = []
): Promise<void> {
  const database = await getDb();

  try {
    database.run(sql, params);
  } catch (error) {
    throw new DatabaseError('run', (error as Error).message);
  }
}

/**
 * Execute raw SQL (for migrations)
 */
export async function exec(sql: string): Promise<void> {
  const database = await getDb();

  try {
    database.exec(sql);
  } catch (error) {
    throw new DatabaseError('exec', (error as Error).message);
  }
}

/**
 * Get single row
 */
export async function getOne<T extends Record<string, unknown>>(
  sql: string,
  params: (string | number | null | boolean)[] = []
): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Insert row and return ID
 */
export async function insert(
  table: string,
  data: Record<string, unknown>
): Promise<void> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');

  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  await run(sql, values as (string | number | null | boolean)[]);
}

/**
 * Update rows
 */
export async function update(
  table: string,
  data: Record<string, unknown>,
  where: string,
  whereParams: (string | number | null | boolean)[] = []
): Promise<void> {
  const setClause = Object.keys(data)
    .map(col => `${col} = ?`)
    .join(', ');
  const values = Object.values(data);

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  await run(sql, [...values, ...whereParams] as (string | number | null | boolean)[]);
}

/**
 * Delete rows
 */
export async function remove(
  table: string,
  where: string,
  whereParams: (string | number | null | boolean)[] = []
): Promise<void> {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  await run(sql, whereParams);
}

// Export types
export type { SqlJsDatabase };
