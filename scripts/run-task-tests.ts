#!/usr/bin/env npx tsx
/**
 * Task-Aware Test Runner
 *
 * Runs tests for a specific task and captures results in the database.
 * Usage: npx tsx scripts/run-task-tests.ts TU-OBS-INF-001
 */

import { spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { query, run, saveDb } from "../database/db.js";

// Types
interface TaskTestMapping {
  title: string;
  testFiles: string[];
  testCommand: string;
  testLevel: 1 | 2 | 3;
  testScope: "codebase" | "database" | "api" | "ui" | "integration";
  acceptanceCriteria: string[];
}

interface MappingConfig {
  mappings: Record<string, TaskTestMapping>;
}

interface TaskRow {
  id: string;
  display_id: string;
  title: string;
}

// Load mapping configuration
function loadMapping(): MappingConfig {
  const mappingPath = "./config/task-test-mapping.json";
  if (!existsSync(mappingPath)) {
    throw new Error(`Mapping file not found: ${mappingPath}`);
  }
  return JSON.parse(readFileSync(mappingPath, "utf-8"));
}

// Get task from database by display_id
async function getTask(displayId: string): Promise<TaskRow | null> {
  const rows = await query<TaskRow>(
    "SELECT id, display_id, title FROM tasks WHERE display_id = ?",
    [displayId],
  );
  return rows.length > 0 ? rows[0] : null;
}

// Ensure acceptance criteria appendix exists
async function ensureAcceptanceCriteria(
  taskId: string,
  criteria: string[],
  scope: string,
): Promise<string> {
  // Check if appendix already exists
  const existing = await query<{ id: string }>(
    `SELECT id FROM task_appendices
     WHERE task_id = ? AND appendix_type = 'acceptance_criteria'`,
    [taskId],
  );

  if (existing.length > 0) {
    console.log(`  ✓ Acceptance criteria appendix already exists`);
    return existing[0].id;
  }

  // Create new appendix
  const appendixId = uuidv4();
  const content = criteria.join("\n");
  const metadata = JSON.stringify({ scope });
  const now = new Date().toISOString();

  await run(
    `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, metadata, created_at, updated_at)
     VALUES (?, ?, 'acceptance_criteria', 'inline', ?, ?, ?, ?)`,
    [appendixId, taskId, content, metadata, now, now],
  );
  await saveDb();

  console.log(
    `  ✓ Created acceptance criteria appendix with ${criteria.length} criteria`,
  );
  return appendixId;
}

// Execute test command and capture output
function executeTest(command: string): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";

    // Split command for shell execution
    const proc = spawn("sh", ["-c", command], {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: "1" },
    });

    proc.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    proc.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    proc.on("close", (code) => {
      resolve({
        exitCode: code ?? -1,
        stdout: stdout.substring(0, 50000),
        stderr: stderr.substring(0, 50000),
        duration: Date.now() - startTime,
      });
    });

    proc.on("error", (error) => {
      resolve({
        exitCode: -1,
        stdout: "",
        stderr: error.message,
        duration: Date.now() - startTime,
      });
    });
  });
}

// Save test result to database
async function saveTestResult(
  taskId: string,
  testLevel: number,
  testScope: string,
  testName: string,
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string,
  durationMs: number,
  passed: boolean,
): Promise<string> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO task_test_results
     (id, task_id, test_level, test_scope, test_name, command, exit_code, stdout, stderr, duration_ms, passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      taskId,
      testLevel,
      testScope,
      testName,
      command,
      exitCode,
      stdout,
      stderr,
      durationMs,
      passed ? 1 : 0,
      now,
    ],
  );
  await saveDb();

  return id;
}

// Update task status based on test results
async function updateTaskStatus(
  taskId: string,
  passed: boolean,
): Promise<void> {
  const newStatus = passed ? "completed" : "failed";
  const now = new Date().toISOString();

  await run(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?`, [
    newStatus,
    now,
    taskId,
  ]);
  await saveDb();
}

// Main function
async function main() {
  const displayId = process.argv[2];

  if (!displayId) {
    console.error("Usage: npx tsx scripts/run-task-tests.ts <DISPLAY_ID>");
    console.error("Example: npx tsx scripts/run-task-tests.ts TU-OBS-INF-001");
    process.exit(1);
  }

  console.log(`\n=== Task Test Runner ===`);
  console.log(`Task: ${displayId}\n`);

  // Load mapping
  const config = loadMapping();
  const mapping = config.mappings[displayId];

  if (!mapping) {
    console.error(`❌ No test mapping found for ${displayId}`);
    console.error(
      `Available mappings: ${Object.keys(config.mappings).join(", ")}`,
    );
    process.exit(1);
  }

  // Get task from database
  const task = await getTask(displayId);
  if (!task) {
    console.error(`❌ Task ${displayId} not found in database`);
    process.exit(1);
  }

  console.log(`📋 Task: ${task.title}`);
  console.log(`🔗 Task ID: ${task.id}`);
  console.log(`📁 Test files: ${mapping.testFiles.join(", ")}`);
  console.log(`⚙️  Command: ${mapping.testCommand}`);
  console.log(`📊 Level: ${mapping.testLevel}, Scope: ${mapping.testScope}\n`);

  // Ensure acceptance criteria exists
  console.log("📝 Checking acceptance criteria...");
  const appendixId = await ensureAcceptanceCriteria(
    task.id,
    mapping.acceptanceCriteria,
    mapping.testScope,
  );

  // Run tests
  console.log("\n🧪 Running tests...\n");
  console.log("─".repeat(60));

  const result = await executeTest(mapping.testCommand);

  console.log("─".repeat(60));
  console.log("");

  // Determine pass/fail
  const passed = result.exitCode === 0;

  // Save test result
  console.log("💾 Saving test result to database...");
  const resultId = await saveTestResult(
    task.id,
    mapping.testLevel,
    mapping.testScope,
    mapping.title,
    mapping.testCommand,
    result.exitCode,
    result.stdout,
    result.stderr,
    result.duration,
    passed,
  );
  console.log(`  ✓ Result saved with ID: ${resultId}`);

  // Update task status
  console.log("📊 Updating task status...");
  await updateTaskStatus(task.id, passed);
  console.log(`  ✓ Task status updated to: ${passed ? "completed" : "failed"}`);

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Task: ${displayId}`);
  console.log(`Result: ${passed ? "✅ PASSED" : "❌ FAILED"}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Exit code: ${result.exitCode}`);

  // Verify database capture
  const savedResults = await query<{ id: string; passed: number }>(
    "SELECT id, passed FROM task_test_results WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
    [task.id],
  );

  if (savedResults.length > 0) {
    console.log(`\n✅ Test result captured in database:`);
    console.log(`   task_test_results.id = ${savedResults[0].id}`);
    console.log(`   task_test_results.passed = ${savedResults[0].passed}`);
  }

  process.exit(passed ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
