import * as fs from "fs";
import initSqlJs from "sql.js";
import { getConfig } from "./config/index.js";

async function main() {
  const config = getConfig();
  const dbPath = config.paths.database;
  
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  // Try to execute the migration line by line
  const migrationPath = "database/migrations/130_spec_outputs.sql";
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Split by semicolons and try each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt) continue;
    
    console.log(`\nStatement ${i + 1}:`);
    console.log(stmt.substring(0, 80) + '...');
    
    try {
      db.exec(stmt);
      console.log('  ✓ Success');
    } catch (e: any) {
      console.log('  ✗ Error:', e.message);
    }
  }
  
  db.close();
}

main().catch(console.error);
