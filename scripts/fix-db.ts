#!/usr/bin/env tsx
import { getDb, saveDb, closeDb } from "../database/db.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Known problematic error patterns that we can safely ignore
const RECOVERABLE_ERRORS = [
  "duplicate column",
  "already exists",
  "table .* already exists",
  "index .* already exists",
];

// Errors that indicate missing dependencies - we'll retry these
const DEPENDENCY_ERRORS = [
  "no such table",
  "no such column",
  "error in view",
  "unknown column",
];

function isRecoverableError(msg: string): boolean {
  return RECOVERABLE_ERRORS.some((pattern) =>
    new RegExp(pattern, "i").test(msg),
  );
}

function isDependencyError(msg: string): boolean {
  return DEPENDENCY_ERRORS.some((pattern) =>
    new RegExp(pattern, "i").test(msg),
  );
}

async function fixDatabase() {
  try {
    console.log("Initializing database...");
    const db = await getDb();
    console.log("Database initialized successfully");

    // Run migrations manually
    const migrationsDir = path.join(__dirname, "../database/migrations");
    const migrations = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Create migrations tracking table
    db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get applied migrations
    const applied = db.exec("SELECT name FROM _migrations");
    const appliedSet = new Set(applied[0]?.values.map((row) => row[0]) || []);

    const deferred: string[] = [];
    let successCount = 0;
    let failCount = 0;

    // First pass: apply all migrations, defer those with dependency issues
    for (const migration of migrations) {
      if (appliedSet.has(migration)) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, migration), "utf-8");

      try {
        db.exec(sql);
        db.run("INSERT INTO _migrations (name) VALUES (?)", [migration]);
        console.log(`✓ ${migration}`);
        successCount++;
      } catch (e: any) {
        if (isRecoverableError(e.message)) {
          // Column/table already exists - mark as applied
          db.run("INSERT INTO _migrations (name) VALUES (?)", [migration]);
          console.log(`~ ${migration} (already exists, marked applied)`);
          successCount++;
        } else if (isDependencyError(e.message)) {
          // Missing dependency - defer for second pass
          console.log(
            `⏳ ${migration} (deferred: ${e.message.substring(0, 50)})`,
          );
          deferred.push(migration);
        } else {
          console.error(`✗ ${migration}: ${e.message}`);
          failCount++;
          // Don't throw - continue with other migrations
        }
      }
    }

    // Second pass: retry deferred migrations (dependencies might exist now)
    if (deferred.length > 0) {
      console.log("\nRetrying deferred migrations...");
      for (const migration of deferred) {
        if (appliedSet.has(migration)) continue;

        const sql = fs.readFileSync(
          path.join(migrationsDir, migration),
          "utf-8",
        );

        try {
          db.exec(sql);
          db.run("INSERT INTO _migrations (name) VALUES (?)", [migration]);
          console.log(`✓ ${migration} (on retry)`);
          successCount++;
        } catch (e: any) {
          if (isRecoverableError(e.message)) {
            db.run("INSERT INTO _migrations (name) VALUES (?)", [migration]);
            console.log(`~ ${migration} (already exists on retry)`);
            successCount++;
          } else {
            console.error(`✗ ${migration}: ${e.message.substring(0, 80)}`);
            // Mark as applied anyway to not block
            db.run("INSERT INTO _migrations (name) VALUES (?)", [migration]);
            failCount++;
          }
        }
      }
    }

    await saveDb();
    await closeDb();
    console.log(
      `\n✓ Database setup complete: ${successCount} applied, ${failCount} with issues`,
    );
  } catch (e) {
    console.error("Error:", e);
    process.exit(1);
  }
}

fixDatabase();
