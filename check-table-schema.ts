import * as fs from "fs";
import initSqlJs from "sql.js";
import { getConfig } from "./config/index.js";

async function main() {
  const config = getConfig();
  const dbPath = config.paths.database;

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Get task_appendices table schema
  const schema = db.exec(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='task_appendices'",
  );
  console.log("task_appendices table schema:");
  console.log(schema[0]?.values[0]?.[0] || "Not found");

  // Get column info
  const columns = db.exec("PRAGMA table_info(task_appendices)");
  console.log("\nColumns:");
  if (columns[0]?.values) {
    columns[0].values.forEach((row) =>
      console.log(`  - ${row[1]} (${row[2]})`),
    );
  }

  db.close();
}

main().catch(console.error);
