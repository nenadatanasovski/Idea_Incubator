import { beforeAll, afterAll, vi } from "vitest";
import { updateConfig } from "../config/index.js";
import { setSkipDiskWrites, getDb } from "../database/db.js";
import { runMigrations } from "../database/migrate.js";
import * as path from "path";

// Configure test database path - must match tests/globalSetup.ts
const testDbPath = path.resolve(process.cwd(), "database/test.db");
updateConfig({
  paths: {
    ideas: "./ideas",
    database: testDbPath,
    templates: "./templates",
    taxonomy: "./taxonomy",
  },
} as any);

// Skip all disk writes during tests. The in-memory singleton is shared across
// all test files (singleFork mode) so disk persistence is unnecessary. Repeated
// db.export() calls in sql.js intermittently corrupt the WASM heap.
setSkipDiskWrites(true);

// Run migrations once in-process. Use globalThis so the promise survives
// Vitest re-importing this setupFile for each test file.
declare global {
  var __testMigrationsReady: Promise<void> | undefined;
}
function ensureMigrations(): Promise<void> {
  if (!globalThis.__testMigrationsReady) {
    globalThis.__testMigrationsReady = runMigrations();
  }
  return globalThis.__testMigrationsReady;
}

// Global test setup (per test file)
beforeAll(async () => {
  // Set up test environment variables
  process.env.NODE_ENV = "test";

  // Re-apply test config in case a previous test file reset it (e.g. config.test.ts)
  updateConfig({
    paths: {
      ideas: "./ideas",
      database: testDbPath,
      templates: "./templates",
      taxonomy: "./taxonomy",
    },
  } as any);

  // Ensure migrations are applied (only runs once across all test files)
  await ensureMigrations();

  // DEBUG: verify DB has tables
  const db = await getDb();
  const tables = db.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
  const count = tables.length > 0 ? tables[0].values[0][0] : 0;
  console.error(`[SETUP] DB has ${count} tables. DB identity: ${(db as any).__debugId || 'unknown'}`);
  if (Number(count) < 10) {
    console.error(`[SETUP] WARNING: DB has only ${count} tables after migrations!`);
    // Try to check if migrations module has a different db reference
    const { getDb: getDb2 } = await import("../database/db.js");
    const db2 = await getDb2();
    const tables2 = db2.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
    const count2 = tables2.length > 0 ? tables2[0].values[0][0] : 0;
    console.error(`[SETUP] Dynamic import DB has ${count2} tables. Same ref: ${db === db2}`);
  }

  // Suppress console output during tests unless DEBUG is set
  if (!process.env.DEBUG) {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  }
});

afterAll(async () => {
  // DEBUG: check DB before restoring mocks
  const dbBefore = await getDb();
  const tablesBeforeRestore = dbBefore.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
  const countBefore = tablesBeforeRestore.length > 0 ? tablesBeforeRestore[0].values[0][0] : 0;

  // Clean up
  vi.restoreAllMocks();

  // DEBUG: check DB after restoring mocks
  const dbAfter = await getDb();
  const tablesAfterRestore = dbAfter.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table'");
  const countAfter = tablesAfterRestore.length > 0 ? tablesAfterRestore[0].values[0][0] : 0;

  if (countBefore !== countAfter) {
    console.error(`[SETUP afterAll] DB tables changed: ${countBefore} -> ${countAfter} after vi.restoreAllMocks()`);
  }
  console.error(`[SETUP afterAll] DB tables: ${countAfter}`);
});

// Global test utilities
declare global {
  var testUtils: {
    createTestIdea: (overrides?: Partial<TestIdea>) => TestIdea;
  };
}

interface TestIdea {
  id: string;
  slug: string;
  title: string;
  summary: string;
  type: string;
  stage: string;
}

globalThis.testUtils = {
  createTestIdea: (overrides = {}) => ({
    id: "test-idea-001",
    slug: "test-idea",
    title: "Test Idea",
    summary: "A test idea for unit testing",
    type: "technical",
    stage: "SPARK",
    ...overrides,
  }),
};
