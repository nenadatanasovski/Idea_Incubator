/**
 * Global setup for unit tests.
 * Creates a fresh test database with all migrations applied.
 * Runs once before all test files.
 */
import * as fs from "fs";
import * as path from "path";

const TEST_DB_PATH = path.resolve(process.cwd(), "database/test.db");

export async function setup() {
  // Remove old test database to start fresh
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }

  // Configure to use test database
  const { updateConfig } = await import("../config/index.js");
  updateConfig({
    paths: {
      ideas: "./ideas",
      database: TEST_DB_PATH,
      templates: "./templates",
      taxonomy: "./taxonomy",
    },
  } as any);

  // Run all migrations to create the schema
  const { runMigrations } = await import("../database/migrate.js");
  await runMigrations();

  // Save and close - each test file will re-open
  const { closeDb } = await import("../database/db.js");
  await closeDb();
}

export async function teardown() {
  // Clean up test database after all tests
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}
