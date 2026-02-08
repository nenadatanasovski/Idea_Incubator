/**
 * Global setup for unit tests.
 * Ensures the test database path is clean so each worker creates a fresh DB.
 * Runs once before all test files.
 */
import * as fs from "fs";
import * as path from "path";

const TEST_DB_PATH = path.resolve(process.cwd(), "database/test.db");

export async function setup() {
  // Remove old test database so the test worker starts fresh
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}

export async function teardown() {
  // Clean up test database after all tests
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
}
