import { getDb, query, closeDb } from "./database/db.js";

async function main() {
  await getDb();
  
  // Check migrations
  const migrations = await query<any>("SELECT name FROM _migrations ORDER BY id DESC LIMIT 5");
  console.log("Recent migrations:", migrations.map(m => m.name));
  
  // Check table list
  const tables = await query<any>("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%appendix%' OR name LIKE '%task_app%'");
  console.log("Appendix tables:", tables);
  
  // Check current task_appendices schema
  try {
    const schema = await query<any>("SELECT sql FROM sqlite_master WHERE name='task_appendices'");
    console.log("task_appendices schema:", schema);
  } catch (e) {
    console.log("No task_appendices table");
  }
  
  // Check if _old table exists
  try {
    const oldTable = await query<any>("SELECT sql FROM sqlite_master WHERE name='task_appendices_old'");
    console.log("task_appendices_old schema:", oldTable);
  } catch (e) {
    console.log("No task_appendices_old table");
  }
  
  await closeDb();
}
main().catch(console.error);
