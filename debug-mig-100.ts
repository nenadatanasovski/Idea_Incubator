import * as fs from "fs";
import initSqlJs from "sql.js";
import { getConfig } from "./config/index.js";

async function main() {
  const config = getConfig();
  const dbPath = config.paths.database;

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  console.log("Checking current table structure...");
  const columns = db.exec("PRAGMA table_info(task_appendices)");
  console.log("Columns in task_appendices:");
  if (columns[0]?.values) {
    columns[0].values.forEach((row) => console.log(`  - ${row[1]}`));
  }

  // Try to execute specific statements from migration
  console.log("\n1. Testing rename...");
  try {
    db.exec("ALTER TABLE task_appendices RENAME TO task_appendices_old");
    console.log("  ✓ Rename successful");
  } catch (e: any) {
    console.log("  ✗ Rename failed:", e.message);
    db.close();
    return;
  }

  console.log("\n2. Testing DROP INDEXes...");
  try {
    db.exec("DROP INDEX IF EXISTS idx_task_appendices_task_id");
    db.exec("DROP INDEX IF EXISTS idx_task_appendices_type");
    db.exec("DROP INDEX IF EXISTS idx_task_appendices_scope");
    console.log("  ✓ DROP INDEX successful");
  } catch (e: any) {
    console.log("  ✗ DROP INDEX failed:", e.message);
  }

  console.log("\n3. Checking old table columns...");
  const oldColumns = db.exec("PRAGMA table_info(task_appendices_old)");
  console.log("Columns in task_appendices_old:");
  if (oldColumns[0]?.values) {
    oldColumns[0].values.forEach((row) => console.log(`  - ${row[1]}`));
  }

  // Check if metadata column exists
  const hasMetadata = oldColumns[0]?.values?.some(
    (row) => row[1] === "metadata",
  );
  console.log("\nHas metadata column?", hasMetadata);

  db.close();
}

main().catch(console.error);
