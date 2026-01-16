import initSqlJs from "sql.js";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/index.js";
import { DatabaseError } from "../utils/errors.js";
let db = null;
/**
 * Initialize and get database instance
 */
export async function getDb() {
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
    throw new DatabaseError("initialize", error.message);
  }
}
/**
 * Save database to disk
 */
export async function saveDb() {
  if (!db) return;
  const config = getConfig();
  const dbPath = config.paths.database;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    throw new DatabaseError("save", error.message);
  }
}
/**
 * Close database connection
 */
export async function closeDb() {
  if (db) {
    await saveDb();
    db.close();
    db = null;
  }
}
/**
 * Reload database from disk (useful when another process has written to the file)
 */
export async function reloadDb() {
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
    throw new DatabaseError("reload", error.message);
  }
}
/**
 * Execute SQL and return results
 */
export async function query(sql, params = []) {
  const database = await getDb();
  try {
    const result = database.exec(sql, params);
    if (result.length === 0) return [];
    const columns = result[0].columns;
    return result[0].values.map((row) =>
      Object.fromEntries(columns.map((col, i) => [col, row[i]])),
    );
  } catch (error) {
    throw new DatabaseError("query", error.message);
  }
}
/**
 * Execute SQL without returning results
 */
export async function run(sql, params = []) {
  const database = await getDb();
  try {
    database.run(sql, params);
  } catch (error) {
    throw new DatabaseError("run", error.message);
  }
}
/**
 * Execute raw SQL (for migrations)
 */
export async function exec(sql) {
  const database = await getDb();
  try {
    database.exec(sql);
  } catch (error) {
    throw new DatabaseError("exec", error.message);
  }
}
/**
 * Get single row
 */
export async function getOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}
/**
 * Insert row and return ID
 */
export async function insert(table, data) {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  await run(sql, values);
}
/**
 * Update rows
 */
export async function update(table, data, where, whereParams = []) {
  const setClause = Object.keys(data)
    .map((col) => `${col} = ?`)
    .join(", ");
  const values = Object.values(data);
  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  await run(sql, [...values, ...whereParams]);
}
/**
 * Delete rows
 */
export async function remove(table, where, whereParams = []) {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  await run(sql, whereParams);
}
