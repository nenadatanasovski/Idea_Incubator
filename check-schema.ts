import initSqlJs from "sql.js";
import * as fs from "fs";

async function main() {
  const dbPath = "./database/ideas.db";
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);

  // Check task_appendices schema
  const result = db.exec("PRAGMA table_info(task_appendices)");
  if (result.length > 0) {
    console.log("task_appendices columns:");
    result[0].values.forEach((row) => console.log(`  - ${row[1]} (${row[2]})`));
  } else {
    console.log("task_appendices table doesn't exist");
  }

  db.close();
}

main().catch(console.error);
