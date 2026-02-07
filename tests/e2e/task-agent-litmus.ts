/**
 * Task Agent Litmus Test
 *
 * End-to-end test script for validating Task Agent functionality.
 * This script sets up test data and provides checkpoints for human validation.
 *
 * Run: npx ts-node tests/e2e/task-agent-litmus.ts
 */

// @ts-expect-error better-sqlite3 types not installed; this is a standalone script
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import * as readline from "readline";

// Test configuration
const CONFIG = {
  DB_PATH: "./database/ideas.db",
  TEST_USER_SLUG: "TU",
  TEST_PROJECT_SLUG: "TEST",
  TELEGRAM_CHAT_ID: process.env.TEST_TELEGRAM_CHAT_ID || "TEST_CHAT",
};

// Test data types
interface TestTask {
  id: string;
  title: string;
  description: string;
  category: string;
  acceptanceCriteria: string[];
  codebaseTests: string[];
  apiTests: string[];
  uiTests: string[];
  dependsOn?: string[];
}

interface TestTaskList {
  id: string;
  name: string;
  description: string;
  taskIds: string[];
}

// Human checkpoint helper
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function checkpoint(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log("\n" + "=".repeat(60));
    console.log("CHECKPOINT: " + message);
    console.log("=".repeat(60));
    rl.question(
      'Press ENTER when verified (or type "skip" to skip): ',
      (answer) => {
        resolve(answer.toLowerCase() !== "skip");
      },
    );
  });
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function logSection(title: string): void {
  console.log("\n" + "#".repeat(60));
  console.log(`# ${title}`);
  console.log("#".repeat(60) + "\n");
}

// Database setup
function setupDatabase(db: Database.Database): void {
  log("Setting up test database...");

  // Create tables if they don't exist (simplified for test)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      telegram_chat_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, slug)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      idea_id TEXT,
      parent_task_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      risk_level TEXT NOT NULL DEFAULT 'medium',
      priority_score INTEGER DEFAULT 0,
      blocks_count INTEGER DEFAULT 0,
      is_quick_win INTEGER DEFAULT 0,
      deadline TEXT,
      acceptance_criteria TEXT NOT NULL DEFAULT '[]',
      codebase_tests TEXT NOT NULL DEFAULT '[]',
      api_tests TEXT NOT NULL DEFAULT '[]',
      ui_tests TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT NOT NULL,
      project_id TEXT,
      idea_id TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      user_approval_required INTEGER NOT NULL DEFAULT 1,
      telegram_chat_id TEXT,
      total_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      failed_tasks INTEGER DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_list_items (
      id TEXT PRIMARY KEY,
      task_list_id TEXT NOT NULL REFERENCES task_lists(id),
      task_id TEXT NOT NULL REFERENCES tasks(id),
      position INTEGER NOT NULL,
      item_status TEXT NOT NULL DEFAULT 'pending',
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(task_list_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS task_relationships (
      id TEXT PRIMARY KEY,
      source_task_id TEXT NOT NULL,
      target_task_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source_task_id, target_task_id, relationship_type)
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      task_list_id TEXT NOT NULL,
      task_id TEXT,
      question_type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      question_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      callback_data TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  log("Database tables created/verified");
}

// Seed test data
function seedTestData(db: Database.Database): {
  userId: string;
  projectId: string;
  ideaId: string;
} {
  log("Seeding test data...");

  const userId = `user-${randomUUID().slice(0, 8)}`;
  const projectId = `proj-${randomUUID().slice(0, 8)}`;
  const ideaId = `idea-${randomUUID().slice(0, 8)}`;

  // Create test user
  db.prepare(
    `
    INSERT OR REPLACE INTO users (id, slug, name, telegram_chat_id)
    VALUES (?, ?, ?, ?)
  `,
  ).run(userId, CONFIG.TEST_USER_SLUG, "Test User", CONFIG.TELEGRAM_CHAT_ID);

  // Create test project
  db.prepare(
    `
    INSERT OR REPLACE INTO projects (id, slug, name, owner_id)
    VALUES (?, ?, ?, ?)
  `,
  ).run(projectId, CONFIG.TEST_PROJECT_SLUG, "Test Project", userId);

  // Create test idea
  db.prepare(
    `
    INSERT OR REPLACE INTO ideas (id, slug, project_id, name)
    VALUES (?, ?, ?, ?)
  `,
  ).run(ideaId, "task-agent-test", projectId, "Task Agent Test");

  log(`Created test user: ${userId}`);
  log(`Created test project: ${projectId}`);
  log(`Created test idea: ${ideaId}`);

  return { userId, projectId, ideaId };
}

// Create a test task
function createTask(
  db: Database.Database,
  userId: string,
  projectId: string,
  task: TestTask,
): void {
  db.prepare(
    `
    INSERT INTO tasks (
      id, user_id, project_id, title, description, category,
      acceptance_criteria, codebase_tests, api_tests, ui_tests
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    task.id,
    userId,
    projectId,
    task.title,
    task.description,
    task.category,
    JSON.stringify(task.acceptanceCriteria),
    JSON.stringify(task.codebaseTests),
    JSON.stringify(task.apiTests),
    JSON.stringify(task.uiTests),
  );

  // Add dependencies
  if (task.dependsOn) {
    for (const depId of task.dependsOn) {
      db.prepare(
        `
        INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
        VALUES (?, ?, ?, 'depends_on')
      `,
      ).run(randomUUID(), task.id, depId);
    }
  }

  log(`Created task: ${task.id} - ${task.title}`);
}

// Create a test task list
function createTaskList(
  db: Database.Database,
  userId: string,
  projectId: string,
  taskList: TestTaskList,
): void {
  db.prepare(
    `
    INSERT INTO task_lists (id, name, description, user_id, project_id, total_tasks, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    taskList.id,
    taskList.name,
    taskList.description,
    userId,
    projectId,
    taskList.taskIds.length,
    userId,
  );

  // Add task list items
  for (let i = 0; i < taskList.taskIds.length; i++) {
    db.prepare(
      `
      INSERT INTO task_list_items (id, task_list_id, task_id, position)
      VALUES (?, ?, ?, ?)
    `,
    ).run(randomUUID(), taskList.id, taskList.taskIds[i], i + 1);
  }

  log(`Created task list: ${taskList.id} - ${taskList.name}`);
}

// Test Flow 1: Task Creation → Validation → Approval → Execution → Completion
async function testFlow1(
  db: Database.Database,
  userId: string,
  projectId: string,
): Promise<void> {
  logSection(
    "TEST FLOW 1: Task Creation → Validation → Approval → Execution → Completion",
  );

  const taskId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-001`;

  const task: TestTask = {
    id: taskId,
    title: "Create test endpoint",
    description:
      'Create a simple GET /api/test endpoint that returns { status: "ok" }',
    category: "feature",
    acceptanceCriteria: ["Endpoint returns 200", "Response is JSON"],
    codebaseTests: ["npx tsc --noEmit passes"],
    apiTests: ['GET /api/test returns 200 with { status: "ok" }'],
    uiTests: [],
  };

  log("Step 1.1: Creating task...");
  createTask(db, userId, projectId, task);

  await checkpoint("Verify task appears in database (check tasks table)");

  log("Step 1.2: Task created with draft status");
  const taskRow = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
  console.log("Task status:", (taskRow as any)?.status);

  await checkpoint('Verify task status is "draft"');

  log("Step 1.3: Simulating validation (update status to pending)...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run("pending", taskId);

  await checkpoint('Verify task status changed to "pending"');

  log("Step 1.4: Creating task list for execution...");
  const taskListId = `list-flow1-${randomUUID().slice(0, 8)}`;
  createTaskList(db, userId, projectId, {
    id: taskListId,
    name: "Test Feature List",
    description: "Task list for flow 1 test",
    taskIds: [taskId],
  });

  await checkpoint("Verify task list created and task is linked");

  log("Flow 1 setup complete. Check Telegram for suggestion message.");
  await checkpoint(
    "Telegram: Verify suggestion message received with [Execute Now] button",
  );

  log("Simulating task completion...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "completed",
    taskId,
  );
  db.prepare(
    "UPDATE task_lists SET status = ?, completed_tasks = 1 WHERE id = ?",
  ).run("completed", taskListId);

  await checkpoint("Telegram: Verify completion message received");

  log("TEST FLOW 1 COMPLETE");
}

// Test Flow 2: Duplicate Detection → Merge Decision
async function testFlow2(
  db: Database.Database,
  userId: string,
  projectId: string,
): Promise<void> {
  logSection("TEST FLOW 2: Duplicate Detection → Merge Decision");

  const existingTaskId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-002`;
  const duplicateTaskId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-003`;

  log("Step 2.1: Creating existing task...");
  createTask(db, userId, projectId, {
    id: existingTaskId,
    title: "Add user authentication endpoint",
    description: "Create POST /api/auth/login endpoint for user authentication",
    category: "feature",
    acceptanceCriteria: ["Login endpoint works"],
    codebaseTests: ["npx tsc --noEmit passes"],
    apiTests: ["POST /api/auth/login returns 200"],
    uiTests: [],
  });

  await checkpoint("Verify existing task created");

  log("Step 2.2: Creating similar (duplicate) task...");
  createTask(db, userId, projectId, {
    id: duplicateTaskId,
    title: "Implement login API",
    description: "Create endpoint for user login at POST /api/auth/login",
    category: "feature",
    acceptanceCriteria: ["Users can log in"],
    codebaseTests: ["npx tsc --noEmit passes"],
    apiTests: ["POST /api/auth/login returns 200"],
    uiTests: [],
  });

  // Create duplicate relationship manually for test
  db.prepare(
    `
    INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
    VALUES (?, ?, ?, 'duplicate_of')
  `,
  ).run(randomUUID(), duplicateTaskId, existingTaskId);

  await checkpoint("Telegram: Verify duplicate detection alert received");

  log("Step 2.3: Simulating merge (archive duplicate)...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "cancelled",
    duplicateTaskId,
  );

  await checkpoint("Verify duplicate task archived/cancelled");

  log("TEST FLOW 2 COMPLETE");
}

// Test Flow 4: Dependency Chain Resolution
async function testFlow4(
  db: Database.Database,
  userId: string,
  projectId: string,
): Promise<void> {
  logSection("TEST FLOW 4: Dependency Chain Resolution");

  const taskAId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-010`;
  const taskBId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-011`;
  const taskCId = `${CONFIG.TEST_USER_SLUG}-${CONFIG.TEST_PROJECT_SLUG}-FEA-012`;

  log("Step 4.1: Creating Task A (no dependencies)...");
  createTask(db, userId, projectId, {
    id: taskAId,
    title: "Create database schema",
    description: "Create initial database schema for habits",
    category: "infrastructure",
    acceptanceCriteria: ["Schema created"],
    codebaseTests: ["Migration runs without error"],
    apiTests: [],
    uiTests: [],
  });
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "pending",
    taskAId,
  );

  log("Step 4.2: Creating Task B (depends on A)...");
  createTask(db, userId, projectId, {
    id: taskBId,
    title: "Create data models",
    description: "Create TypeScript models for habits",
    category: "feature",
    acceptanceCriteria: ["Models created"],
    codebaseTests: ["npx tsc --noEmit passes"],
    apiTests: [],
    uiTests: [],
    dependsOn: [taskAId],
  });
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "blocked",
    taskBId,
  );

  log("Step 4.3: Creating Task C (depends on B)...");
  createTask(db, userId, projectId, {
    id: taskCId,
    title: "Create API routes using models",
    description: "Create CRUD API routes for habits",
    category: "feature",
    acceptanceCriteria: ["Routes created"],
    codebaseTests: ["npx tsc --noEmit passes"],
    apiTests: ["GET /api/habits returns 200"],
    uiTests: [],
    dependsOn: [taskBId],
  });
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "blocked",
    taskCId,
  );

  await checkpoint("Verify dependency chain: A → B → C (B and C blocked)");

  log("Step 4.4: Completing Task A...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "completed",
    taskAId,
  );

  log("Step 4.5: Unblocking Task B...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "pending",
    taskBId,
  );

  await checkpoint("Telegram: Verify unblock notification for Task B");

  log("Step 4.6: Completing Task B...");
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "completed",
    taskBId,
  );
  db.prepare("UPDATE tasks SET status = ? WHERE id = ?").run(
    "pending",
    taskCId,
  );

  await checkpoint("Verify Task C unblocked after B completed");

  log("TEST FLOW 4 COMPLETE");
}

// Main test runner
async function runTests(): Promise<void> {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         TASK AGENT LITMUS TEST                             ║");
  console.log("║         Human-in-the-Loop Validation                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("\n");

  log("Opening database...");
  const db = new Database(CONFIG.DB_PATH);

  try {
    // Setup
    setupDatabase(db);
    const { userId, projectId, ideaId } = seedTestData(db);

    console.log("\n");
    console.log("Test data seeded. Ready to begin tests.");
    console.log("Make sure:");
    console.log("  1. Task Agent service is running");
    console.log("  2. Telegram bot is connected");
    console.log("  3. You have access to the test Telegram chat");
    console.log("\n");

    await checkpoint("Confirm prerequisites are met");

    // Run test flows
    await testFlow1(db, userId, projectId);
    await testFlow2(db, userId, projectId);
    await testFlow4(db, userId, projectId);

    // Summary
    console.log("\n");
    console.log(
      "╔════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║         TEST SUMMARY                                       ║",
    );
    console.log(
      "╚════════════════════════════════════════════════════════════╝",
    );
    console.log("\n");
    console.log("Flows tested:");
    console.log("  - Flow 1: Task Creation → Completion");
    console.log("  - Flow 2: Duplicate Detection → Merge");
    console.log("  - Flow 4: Dependency Chain Resolution");
    console.log("\n");
    console.log("For full test coverage, also run:");
    console.log("  - Flow 3: Task List Approval → Execution");
    console.log("  - Flow 5: Failure → Retry → Escalation");
    console.log("  - Flow 6: Stale Task Notification");
    console.log("  - Flow 7-10: See task-agent-test-plan.md");
    console.log("\n");
  } finally {
    db.close();
    rl.close();
  }
}

// Run if executed directly
runTests().catch(console.error);
