import { getDb, exec, closeDb } from "./database/db.js";
import * as fs from "fs";

async function test() {
  await getDb();
  const sql = fs.readFileSync(
    "./database/migrations/105_phase4_test_appendices.sql",
    "utf-8",
  );
  try {
    await exec(sql);
    console.log("Migration applied successfully");
  } catch (error: any) {
    console.error("Error:", error.message);
  }
  await closeDb();
}
test();
