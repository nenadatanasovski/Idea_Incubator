import { getDb, closeDb } from "./database/db.js";

async function main() {
  const db = await getDb();
  
  // Get all table names
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  if (result.length > 0) {
    console.log("Tables in database:");
    result[0].values.forEach(row => console.log(`  - ${row[0]}`));
  } else {
    console.log("No tables found");
  }
  
  await closeDb();
}

main().catch(console.error);
