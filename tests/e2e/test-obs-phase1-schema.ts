/**
 * Observability Phase 1 Schema Validation Tests
 *
 * Verifies that all observability tables, indexes, views, and triggers
 * are correctly set up in the database.
 */

import { query, run } from "../../database/db.js";

interface TableInfo {
  name: string;
}

interface IndexInfo {
  name: string;
  tbl_name: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, details?: string) {
  results.push({ name, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status}: ${name}${details ? ` - ${details}` : ""}`);
}

async function test1_TablesExist() {
  const requiredTables = [
    "transcript_entries",
    "tool_uses",
    "skill_traces",
    "assertion_results",
    "assertion_chains",
    "wave_statistics",
    "message_bus_log",
    "concurrent_execution_sessions",
    "events",
  ];

  const tables = await query<TableInfo>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredTables.map(() => "?").join(",")})`,
    requiredTables,
  );

  const foundTables = tables.map((t) => t.name);
  const missingTables = requiredTables.filter((t) => !foundTables.includes(t));

  recordTest(
    "Test 1: All 9 observability tables exist",
    missingTables.length === 0,
    missingTables.length > 0
      ? `Missing: ${missingTables.join(", ")}`
      : undefined,
  );
}

async function test2_TranscriptEntriesSchema() {
  const columns = await query<{ name: string }>(
    "PRAGMA table_info(transcript_entries)",
    [],
  );
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "timestamp",
    "sequence",
    "source",
    "execution_id",
    "task_id",
    "instance_id",
    "wave_id",
    "wave_number",
    "entry_type",
    "category",
    "summary",
    "details",
    "duration_ms",
  ];

  const missingColumns = requiredColumns.filter(
    (c) => !columnNames.includes(c),
  );

  recordTest(
    "Test 2: transcript_entries has all required columns",
    missingColumns.length === 0,
    missingColumns.length > 0
      ? `Missing: ${missingColumns.join(", ")}`
      : undefined,
  );
}

async function test3_ToolUsesSchema() {
  const columns = await query<{ name: string }>(
    "PRAGMA table_info(tool_uses)",
    [],
  );
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "execution_id",
    "task_id",
    "tool",
    "tool_category",
    "input",
    "result_status",
    "is_error",
    "is_blocked",
    "duration_ms",
  ];

  const missingColumns = requiredColumns.filter(
    (c) => !columnNames.includes(c),
  );

  recordTest(
    "Test 3: tool_uses has all required columns",
    missingColumns.length === 0,
    missingColumns.length > 0
      ? `Missing: ${missingColumns.join(", ")}`
      : undefined,
  );
}

async function test4_AssertionTablesSchema() {
  const resultsColumns = await query<{ name: string }>(
    "PRAGMA table_info(assertion_results)",
    [],
  );
  const chainsColumns = await query<{ name: string }>(
    "PRAGMA table_info(assertion_chains)",
    [],
  );

  const resultsColumnNames = resultsColumns.map((c) => c.name);
  const chainsColumnNames = chainsColumns.map((c) => c.name);

  const resultsRequired = [
    "id",
    "task_id",
    "execution_id",
    "category",
    "result",
    "evidence",
    "chain_id",
  ];
  const chainsRequired = [
    "id",
    "task_id",
    "execution_id",
    "overall_result",
    "pass_count",
    "fail_count",
  ];

  const missingResults = resultsRequired.filter(
    (c) => !resultsColumnNames.includes(c),
  );
  const missingChains = chainsRequired.filter(
    (c) => !chainsColumnNames.includes(c),
  );

  recordTest(
    "Test 4: assertion_results and assertion_chains have required columns",
    missingResults.length === 0 && missingChains.length === 0,
    missingResults.length > 0 || missingChains.length > 0
      ? `Missing results: ${missingResults.join(", ")}; Missing chains: ${missingChains.join(", ")}`
      : undefined,
  );
}

async function test5_IndexesExist() {
  const indexes = await query<IndexInfo>(
    `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`,
    [],
  );

  const requiredIndexPatterns = [
    "idx_transcript_",
    "idx_tool_use_",
    "idx_assertion_",
    "idx_chain_",
    "idx_wave_stats_",
    "idx_skill_trace_",
  ];

  const foundPatterns = requiredIndexPatterns.filter((pattern) =>
    indexes.some((idx) => idx.name.startsWith(pattern)),
  );

  recordTest(
    "Test 5: Key indexes exist",
    foundPatterns.length >= 5,
    `Found ${indexes.length} indexes, ${foundPatterns.length}/${requiredIndexPatterns.length} patterns matched`,
  );
}

async function test6_ViewsExist() {
  const views = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='view' AND name IN ('v_wave_progress', 'v_active_agents')`,
    [],
  );

  recordTest(
    "Test 6: v_wave_progress and v_active_agents views exist",
    views.length >= 2,
    `Found ${views.length}/2 required views`,
  );
}

async function test7_TriggerExists() {
  const triggers = await query<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type='trigger' AND name = 'tr_event_to_log'`,
    [],
  );

  recordTest(
    "Test 7: tr_event_to_log trigger exists",
    triggers.length === 1,
    triggers.length === 0 ? "Trigger not found" : undefined,
  );
}

async function test8_DataInsertion() {
  // Test inserting into transcript_entries
  const testId = `test-${Date.now()}`;
  try {
    await run(
      `INSERT INTO transcript_entries (id, timestamp, sequence, source, execution_id, instance_id, entry_type, category, summary)
       VALUES (?, datetime('now'), 1, 'agent', 'test-exec-1', 'test-instance-1', 'phase_start', 'lifecycle', 'Test entry')`,
      [testId],
    );

    const inserted = await query<{ id: string }>(
      `SELECT id FROM transcript_entries WHERE id = ?`,
      [testId],
    );

    // Clean up
    await run(`DELETE FROM transcript_entries WHERE id = ?`, [testId]);

    recordTest(
      "Test 8: Can insert into transcript_entries",
      inserted.length === 1,
    );
  } catch (error) {
    recordTest(
      "Test 8: Can insert into transcript_entries",
      false,
      String(error),
    );
  }
}

async function test9_WaveStatisticsSchema() {
  const columns = await query<{ name: string }>(
    "PRAGMA table_info(wave_statistics)",
    [],
  );
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "wave_id",
    "execution_id",
    "task_count",
    "completed_count",
    "failed_count",
    "pass_rate",
    "max_parallel_agents",
  ];

  const missingColumns = requiredColumns.filter(
    (c) => !columnNames.includes(c),
  );

  recordTest(
    "Test 9: wave_statistics has all required columns",
    missingColumns.length === 0,
    missingColumns.length > 0
      ? `Missing: ${missingColumns.join(", ")}`
      : undefined,
  );
}

async function test10_SkillTracesSchema() {
  const columns = await query<{ name: string }>(
    "PRAGMA table_info(skill_traces)",
    [],
  );
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "execution_id",
    "task_id",
    "skill_name",
    "skill_file",
    "status",
    "tool_calls",
  ];

  const missingColumns = requiredColumns.filter(
    (c) => !columnNames.includes(c),
  );

  recordTest(
    "Test 10: skill_traces has all required columns",
    missingColumns.length === 0,
    missingColumns.length > 0
      ? `Missing: ${missingColumns.join(", ")}`
      : undefined,
  );
}

async function runAllTests() {
  console.log("=== OBSERVABILITY PHASE 1 SCHEMA VALIDATION TESTS ===\n");

  await test1_TablesExist();
  await test2_TranscriptEntriesSchema();
  await test3_ToolUsesSchema();
  await test4_AssertionTablesSchema();
  await test5_IndexesExist();
  await test6_ViewsExist();
  await test7_TriggerExists();
  await test8_DataInsertion();
  await test9_WaveStatisticsSchema();
  await test10_SkillTracesSchema();

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n=== SUMMARY ===");
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);

  if (failed === 0) {
    console.log("\n✓ ALL PHASE 1 TESTS PASSED");
    process.exit(0);
  } else {
    console.log("\n✗ SOME TESTS FAILED");
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
