import initSqlJs from "sql.js";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  // Create migrations table
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Read and apply migrations one by one
  const migrationsDir = "./database/migrations";
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  
  let applied = 0;
  let failed = 0;
  
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    try {
      db.exec(sql);
      db.run("INSERT INTO _migrations (name) VALUES (?)", [file]);
      applied++;
    } catch (error: any) {
      console.log(`✗ ${file}: ${error.message}`);
      failed++;
    }
  }
  
  // Export and save to file
  const data = db.export();
  const buffer = Buffer.from(data);
  console.log(`Database buffer size: ${buffer.length} bytes`);
  
  fs.writeFileSync("./database/ideas.db", buffer);
  
  // Verify file was written
  const stats = fs.statSync("./database/ideas.db");
  console.log(`File written: ${stats.size} bytes`);
  console.log(`Migrations: ${applied} applied, ${failed} failed`);
  
  db.close();
}

main().catch(console.error);
