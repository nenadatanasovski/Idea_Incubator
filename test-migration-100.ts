import { getDb, exec, closeDb } from "./database/db.js";
import * as fs from "fs";

async function test() {
  await getDb();

  // First run all migrations up to 099
  const migrations = fs.readdirSync("./database/migrations").sort();
  for (const m of migrations) {
    if (m >= "100_") break;
    try {
      const sql = fs.readFileSync(`./database/migrations/${m}`, "utf-8");
      await exec(sql);
      console.log(`Applied: ${m}`);
    } catch (error: any) {
      if (
        !error.message.includes("already exists") &&
        !error.message.includes("duplicate")
      ) {
        console.error(`Failed on ${m}:`, error.message);
      }
    }
  }

  // Now try migration 100
  const sql = fs.readFileSync(
    "./database/migrations/100_add_test_commands_appendix.sql",
    "utf-8",
  );
  try {
    await exec(sql);
    console.log("Migration 100 applied successfully");
  } catch (error: any) {
    console.error("Error in migration 100:", error.message);
  }
  await closeDb();
}
test();
