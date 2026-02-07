import * as fs from "fs"; // used for file operations
void fs;
import * as path from "path"; // used for path operations
void path;
import initSqlJs from "sql.js";
import { getConfig } from "./config/index.js";

async function main() {
  const config = getConfig();
  const dbPath = config.paths.database;
  
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // Check if old table exists and its schema
  try {
    const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='task_appendices'");
    console.log("Current task_appendices schema:");
    console.log(schema[0]?.values[0]?.[0] || "Not found");
    
    // Get column info
    const columns = db.exec("PRAGMA table_info(task_appendices)");
    console.log("\nColumns:");
    if (columns[0]?.values) {
      columns[0].values.forEach(row => console.log(`  - ${row[1]} (${row[2]})`));
    }
  } catch (e) {
    console.log("Error getting schema:", e);
  }
  
  // Try the migration
  const migrationPath = "database/migrations/100_add_test_commands_appendix.sql";
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log("\nAttempting migration...");
  try {
    db.exec(sql);
    console.log("Migration executed successfully!");
  } catch (err: unknown) {
    const error = err as Error;
    console.log("Migration error:", error.message);
  }
  
  db.close();
}

main().catch(console.error);
