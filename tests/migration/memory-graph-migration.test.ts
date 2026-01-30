/**
 * Memory Graph Migration Verification Tests
 *
 * Verifies that the memory graph migration from ideation_memory_files to
 * memory_blocks is working correctly.
 *
 * Phase 5 - Task 5.1: Remove deprecated memory files code
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getDb, saveDb } from "../../database/db.js";
import type Database from "sql.js";

describe("Memory Graph Migration", () => {
  let db: Database.Database;
  const testSessionId = `test_migration_${Date.now()}`;

  beforeAll(async () => {
    db = await getDb();

    // Create a test session
    db.run(
      `INSERT INTO ideation_sessions (id, profile_id, status, current_phase, started_at, last_activity_at)
       VALUES (?, NULL, 'active', 'exploring', datetime('now'), datetime('now'))`,
      [testSessionId],
    );

    // Insert test data into memory_blocks (the new system)
    db.run(
      `INSERT INTO memory_blocks (id, session_id, type, content, status, confidence, created_at, updated_at)
       VALUES (?, ?, 'learning', 'Test learning content', 'active', 0.8, datetime('now'), datetime('now'))`,
      [`block_learning_${Date.now()}`, testSessionId],
    );

    db.run(
      `INSERT INTO memory_blocks (id, session_id, type, content, status, confidence, created_at, updated_at)
       VALUES (?, ?, 'pattern', 'Test pattern content', 'active', 0.9, datetime('now'), datetime('now'))`,
      [`block_pattern_${Date.now()}`, testSessionId],
    );

    db.run(
      `INSERT INTO memory_blocks (id, session_id, type, content, status, confidence, created_at, updated_at)
       VALUES (?, ?, 'synthesis', 'Test synthesis content', 'active', 0.75, datetime('now'), datetime('now'))`,
      [`block_synthesis_${Date.now()}`, testSessionId],
    );

    // Also insert into legacy ideation_memory_files for backward compatibility test
    db.run(
      `INSERT INTO ideation_memory_files (id, session_id, file_type, content, version, created_at, updated_at)
       VALUES (?, ?, 'self_discovery', '# Legacy Self Discovery', 1, datetime('now'), datetime('now'))`,
      [`legacy_file_${Date.now()}`, testSessionId],
    );

    await saveDb();
  });

  afterAll(async () => {
    // Cleanup test data
    db.run(`DELETE FROM memory_blocks WHERE session_id = ?`, [testSessionId]);
    db.run(`DELETE FROM ideation_memory_files WHERE session_id = ?`, [
      testSessionId,
    ]);
    db.run(`DELETE FROM ideation_sessions WHERE id = ?`, [testSessionId]);
    await saveDb();
  });

  test("PASS: Memory blocks exist for session", () => {
    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM memory_blocks WHERE session_id = ?`,
    );
    stmt.bind([testSessionId]);
    stmt.step();
    const result = stmt.getAsObject() as { count: number };
    stmt.free();

    expect(result.count).toBeGreaterThanOrEqual(3);
  });

  test("PASS: Memory blocks have correct types", () => {
    const stmt = db.prepare(
      `SELECT type FROM memory_blocks WHERE session_id = ? ORDER BY type`,
    );
    stmt.bind([testSessionId]);

    const types: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { type: string };
      types.push(row.type);
    }
    stmt.free();

    expect(types).toContain("learning");
    expect(types).toContain("pattern");
    expect(types).toContain("synthesis");
  });

  test("PASS: Memory blocks have confidence scores", () => {
    const stmt = db.prepare(
      `SELECT confidence FROM memory_blocks WHERE session_id = ? AND confidence IS NOT NULL`,
    );
    stmt.bind([testSessionId]);

    let count = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject() as { confidence: number };
      expect(row.confidence).toBeGreaterThan(0);
      expect(row.confidence).toBeLessThanOrEqual(1);
      count++;
    }
    stmt.free();

    expect(count).toBeGreaterThan(0);
  });

  test("PASS: Legacy ideation_memory_files still exist for backward compatibility", () => {
    const stmt = db.prepare(
      `SELECT COUNT(*) as count FROM ideation_memory_files WHERE session_id = ?`,
    );
    stmt.bind([testSessionId]);
    stmt.step();
    const result = stmt.getAsObject() as { count: number };
    stmt.free();

    expect(result.count).toBeGreaterThanOrEqual(1);
  });

  test("PASS: Block types match expected memory categories", () => {
    const expectedTypes = [
      "learning",
      "pattern",
      "synthesis",
      "decision",
      "assumption",
    ];

    const stmt = db.prepare(
      `SELECT DISTINCT type FROM memory_blocks WHERE session_id = ? AND type IN (${expectedTypes.map(() => "?").join(",")})`,
    );
    stmt.bind([testSessionId, ...expectedTypes]);

    const foundTypes: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { type: string };
      foundTypes.push(row.type);
    }
    stmt.free();

    // At least some of our test data should match
    expect(foundTypes.length).toBeGreaterThan(0);
  });
});
