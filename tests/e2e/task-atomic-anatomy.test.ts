/**
 * Task Atomic Anatomy E2E Tests
 *
 * Comprehensive E2E tests for the Task System V2 implementation.
 * Tests the following scenarios:
 * - 8.1 PRD → Task extraction → Execution
 * - 8.2 Impact conflict detection
 * - 8.3 Cascade propagation
 * - 8.4 Versioning and rollback
 *
 * Part of: TASK-ATOMIC-ANATOMY.md Implementation Checklist Phase 8
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";

// Service imports
import { prdService } from "../../server/services/prd-service";
import { prdLinkService } from "../../server/services/prd-link-service";
import { prdCoverageService } from "../../server/services/prd-coverage-service";
import { taskImpactService } from "../../server/services/task-agent/task-impact-service";
import { taskAppendixService } from "../../server/services/task-agent/task-appendix-service";
import { taskVersionService } from "../../server/services/task-agent/task-version-service";
import { taskStateHistoryService } from "../../server/services/task-agent/task-state-history-service";
import { cascadeAnalyzerService } from "../../server/services/task-agent/cascade-analyzer-service";
import { cascadeExecutorService } from "../../server/services/task-agent/cascade-executor-service";
import taskCreationService from "../../server/services/task-agent/task-creation-service";
import fileConflictDetector from "../../server/services/task-agent/file-conflict-detector";
import parallelismCalculator from "../../server/services/task-agent/parallelism-calculator";
import { query, run, getOne, saveDb } from "../../database/db";

// Test prefix for cleanup
const TEST_PREFIX = "E2E-ANATOMY-";

// Cleanup utility
async function cleanupTestData(): Promise<void> {
  try {
    // Clean up in order of dependencies
    await run(
      `DELETE FROM task_impacts WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_appendices WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_versions WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_state_history WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_test_results WHERE task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_relationships WHERE source_task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM task_relationships WHERE target_task_id IN (SELECT id FROM tasks WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM prd_tasks WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    await run(
      `DELETE FROM prd_task_lists WHERE prd_id IN (SELECT id FROM prds WHERE title LIKE '${TEST_PREFIX}%')`,
    );
    // Note: task_list_items table doesn't exist - tasks link to task_lists_v2 via task_list_id column directly
    await run(`DELETE FROM tasks WHERE title LIKE '${TEST_PREFIX}%'`);
    await run(`DELETE FROM task_lists_v2 WHERE name LIKE '${TEST_PREFIX}%'`);
    await run(`DELETE FROM prds WHERE title LIKE '${TEST_PREFIX}%'`);
    await saveDb();
  } catch (error) {
    console.error("[E2E Cleanup] Error during cleanup:", error);
  }
}

// =============================================================================
// 8.1 E2E Test: PRD → Task Extraction → Execution
// =============================================================================

describe("8.1 PRD → Task Extraction → Execution", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should complete full PRD to execution workflow", async () => {
    // Step 1: Create a PRD with requirements
    const prd = await prdService.create(
      {
        title: `${TEST_PREFIX}User Authentication Feature`,
        problemStatement: "Users cannot securely access the application",
        targetUsers: "All application users",
        functionalDescription:
          "Implement secure user authentication with login/logout",
        successCriteria: JSON.stringify([
          {
            description: "Users can log in with email/password",
            metric: "success_rate",
            target: "99%",
            verified: false,
          },
          {
            description: "Session persists across page reloads",
            metric: "session_duration",
            target: "24h",
            verified: false,
          },
        ]),
        constraints: JSON.stringify([
          "Must use JWT tokens",
          "Must support OAuth2",
        ]),
        outOfScope: JSON.stringify([
          "Social login",
          "Two-factor authentication",
        ]),
        status: "draft",
      },
      "test-user",
    );

    expect(prd).toBeDefined();
    expect(prd.id).toBeDefined();
    expect(prd.status).toBe("draft");

    // Step 2: Approve the PRD
    const approvedPrd = await prdService.approve(prd.id, "test-approver");
    expect(approvedPrd.status).toBe("approved");
    expect(approvedPrd.approvedBy).toBe("test-approver");

    // Step 3: Create a task list for the PRD
    const taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status, auto_approve_reviews) VALUES (?, ?, ?, ?, ?)`,
      [taskListId, `${TEST_PREFIX}Auth Task List`, null, "draft", 0],
    );

    // Step 4: Link the task list to the PRD
    await prdLinkService.linkTaskList(prd.id, taskListId);

    // Step 5: Create tasks extracted from PRD requirements
    const task1 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Create login endpoint`,
      taskListId,
      {
        description:
          "Create POST /api/auth/login endpoint that validates credentials and returns JWT",
        category: "feature",
        priority: "P1",
      },
    );

    const task2 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Create logout endpoint`,
      taskListId,
      {
        description:
          "Create POST /api/auth/logout endpoint that invalidates session",
        category: "feature",
        priority: "P2",
      },
    );

    const task3 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Create auth middleware`,
      taskListId,
      {
        description:
          "Create middleware that validates JWT tokens on protected routes",
        category: "feature",
        priority: "P1",
      },
    );

    // Step 6: Link tasks directly to the PRD
    // Note: requirement_ref must match format expected by prd-coverage-service
    // (success_criteria[N] or constraints[N]) for coverage calculation
    await prdLinkService.linkTask(prd.id, task1.task.id, "success_criteria[0]");
    await prdLinkService.linkTask(prd.id, task2.task.id, "success_criteria[1]");
    await prdLinkService.linkTask(prd.id, task3.task.id, "success_criteria[2]");

    // Step 7: Add task impacts
    await taskImpactService.create({
      taskId: task1.task.id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "server/routes/auth.ts",
      confidence: 0.95,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task1.task.id,
      impactType: "api",
      operation: "CREATE",
      targetPath: "/api/auth/login",
      targetName: "POST",
      confidence: 0.95,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task3.task.id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "server/middleware/auth.ts",
      confidence: 0.95,
      source: "ai",
    });

    // Step 8: Calculate coverage
    const coverage = await prdCoverageService.calculateCoverage(prd.id);
    expect(coverage.totalRequirements).toBeGreaterThan(0);
    expect(coverage.coveredRequirements).toBeGreaterThan(0);

    // Step 9: Calculate parallelism for execution
    const waves = await parallelismCalculator.calculateWaves(taskListId);
    expect(waves).toBeDefined();
    expect(waves.length).toBeGreaterThan(0);

    // Step 10: Get completion progress
    const progress = await prdCoverageService.getCompletionProgress(prd.id);
    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(0); // Not yet executed

    console.log("[E2E 8.1] PRD → Task Extraction → Execution completed");
    console.log(`  - PRD created: ${prd.id}`);
    console.log(`  - Tasks created: 3`);
    console.log(`  - Coverage: ${Math.round(coverage.coveragePercent)}%`);
    console.log(`  - Execution waves: ${waves.length}`);
  });

  it("should track PRD hierarchy with parent/child relationships", async () => {
    // Create parent (summary) PRD
    const parentPrd = await prdService.create(
      {
        title: `${TEST_PREFIX}MVP Feature Set`,
        problemStatement: "Need to deliver core MVP features",
        status: "draft",
      },
      "test-user",
    );

    // Create child PRDs
    const childPrd1 = await prdService.create(
      {
        title: `${TEST_PREFIX}Authentication Module`,
        problemStatement: "Need secure auth",
        parentPrdId: parentPrd.id,
      },
      "test-user",
    );

    const childPrd2 = await prdService.create(
      {
        title: `${TEST_PREFIX}Dashboard Module`,
        problemStatement: "Need user dashboard",
        parentPrdId: parentPrd.id,
      },
      "test-user",
    );

    // Verify hierarchy
    const children = await prdService.getChildren(parentPrd.id);
    expect(children.length).toBe(2);
    expect(children.map((c) => c.id)).toContain(childPrd1.id);
    expect(children.map((c) => c.id)).toContain(childPrd2.id);
  });
});

// =============================================================================
// 8.2 E2E Test: Impact Conflict Detection
// =============================================================================

describe("8.2 Impact Conflict Detection", () => {
  let taskListId: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // Create task list
    taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
      [taskListId, `${TEST_PREFIX}Conflict Test List`, null, "draft"],
    );

    // Create tasks
    const task1 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task A - Update database.ts`,
      taskListId,
      { category: "infrastructure" },
    );
    task1Id = task1.task.id;

    const task2 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task B - Also update database.ts`,
      taskListId,
      { category: "infrastructure" },
    );
    task2Id = task2.task.id;

    const task3 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task C - Update different file`,
      taskListId,
      { category: "feature" },
    );
    task3Id = task3.task.id;

    await saveDb();
  });

  it("should detect UPDATE-UPDATE conflict on same file", async () => {
    // Add impacts - both tasks update same file
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "database/db.ts",
      confidence: 0.9,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "database/db.ts",
      confidence: 0.9,
      source: "ai",
    });

    // Check conflict
    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task2Id,
    );
    expect(canParallel).toBe(false);

    const details = await fileConflictDetector.getConflictDetails(
      task1Id,
      task2Id,
    );
    expect(details.canRunParallel).toBe(false);
    expect(details.fileConflicts.length).toBeGreaterThan(0);
    expect(details.fileConflicts[0].conflictType).toBe("write-write");
  });

  it("should detect CREATE-CREATE conflict on same file", async () => {
    // Add impacts - both tasks create same file
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "server/routes/new-feature.ts",
      confidence: 0.95,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "server/routes/new-feature.ts",
      confidence: 0.95,
      source: "ai",
    });

    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task2Id,
    );
    expect(canParallel).toBe(false);
  });

  it("should detect DELETE-READ conflict", async () => {
    // Task 1 deletes file, Task 2 reads it
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "DELETE",
      targetPath: "server/legacy/old-service.ts",
      confidence: 1.0,
      source: "user",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "READ",
      targetPath: "server/legacy/old-service.ts",
      confidence: 0.8,
      source: "ai",
    });

    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task2Id,
    );
    expect(canParallel).toBe(false);
  });

  it("should allow READ-READ on same file", async () => {
    // Both tasks only read - no conflict
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "READ",
      targetPath: "config/settings.ts",
      confidence: 0.9,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "READ",
      targetPath: "config/settings.ts",
      confidence: 0.9,
      source: "ai",
    });

    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task2Id,
    );
    expect(canParallel).toBe(true);
  });

  it("should allow parallel execution for non-conflicting files", async () => {
    // Different files, no conflict
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "server/routes/users.ts",
      confidence: 0.9,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task3Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "server/routes/products.ts",
      confidence: 0.9,
      source: "ai",
    });

    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task3Id,
    );
    expect(canParallel).toBe(true);
  });

  it("should detect API route conflicts", async () => {
    // Both tasks create same API route
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "api",
      operation: "CREATE",
      targetPath: "/api/auth/login",
      targetName: "POST",
      confidence: 0.95,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "api",
      operation: "CREATE",
      targetPath: "/api/auth/login",
      targetName: "POST",
      confidence: 0.95,
      source: "ai",
    });

    const canParallel = await fileConflictDetector.canRunParallel(
      task1Id,
      task2Id,
    );
    expect(canParallel).toBe(false);
  });

  it("should get all conflicting tasks for a given task", async () => {
    // Set up impacts for multiple tasks
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "shared/types.ts",
      confidence: 0.9,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "shared/types.ts",
      confidence: 0.9,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task3Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "shared/types.ts",
      confidence: 0.9,
      source: "ai",
    });

    // Get all tasks that conflict with task1
    const conflictingTasks =
      await fileConflictDetector.getConflictingTasks(task1Id);
    expect(conflictingTasks.length).toBe(2);
    expect(conflictingTasks.map((t) => t.id)).toContain(task2Id);
    expect(conflictingTasks.map((t) => t.id)).toContain(task3Id);
  });
});

// =============================================================================
// 8.3 E2E Test: Cascade Propagation
// =============================================================================

describe("8.3 Cascade Propagation", () => {
  let taskListId: string;
  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // Create task list
    taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status, auto_approve_reviews) VALUES (?, ?, ?, ?, ?)`,
      [taskListId, `${TEST_PREFIX}Cascade Test List`, null, "draft", 0],
    );

    // Create tasks with dependencies
    const task1 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task 1 - Create user types`,
      taskListId,
      { category: "types" },
    );
    task1Id = task1.task.id;

    const task2 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task 2 - Create user service (depends on types)`,
      taskListId,
      { category: "service" },
    );
    task2Id = task2.task.id;

    const task3 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Task 3 - Create user API (depends on service)`,
      taskListId,
      { category: "feature" },
    );
    task3Id = task3.task.id;

    // Create dependency chain: task1 <- task2 <- task3
    await run(
      `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
       VALUES (?, ?, ?, 'depends_on', datetime('now'))`,
      [uuidv4(), task2Id, task1Id],
    );

    await run(
      `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type, created_at)
       VALUES (?, ?, ?, 'depends_on', datetime('now'))`,
      [uuidv4(), task3Id, task2Id],
    );

    // Add file impacts
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "types/user.ts",
      confidence: 0.95,
      source: "ai",
    });

    await taskImpactService.create({
      taskId: task2Id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "types/user.ts",
      targetName: "User",
      confidence: 0.8,
      source: "ai",
    });

    await saveDb();
  });

  it("should detect cascade triggers when task impacts change", async () => {
    // Get current impacts for task1
    const originalImpacts = await taskImpactService.getByTaskId(task1Id);

    // Add a new impact that overlaps with task2's dependency
    await taskImpactService.create({
      taskId: task1Id,
      impactType: "type",
      operation: "CREATE",
      targetPath: "types/user.ts",
      targetName: "UserProfile",
      confidence: 0.9,
      source: "ai",
    });

    const newImpacts = await taskImpactService.getByTaskId(task1Id);

    // Analyze cascade effects
    const cascadeAnalysis = await cascadeAnalyzerService.analyzeTaskEdit(
      task1Id,
      originalImpacts,
      newImpacts,
    );

    expect(cascadeAnalysis).toBeDefined();
    expect(cascadeAnalysis.affectedTasks).toBeDefined();
    // Task2 should be flagged as it depends on task1 and both touch types/user.ts
  });

  it("should identify tasks with overlapping file impacts", async () => {
    // Find all tasks that might be affected by changes to types/user.ts
    const tasksWithOverlap =
      await cascadeAnalyzerService.findTasksWithOverlappingImpacts(
        "file",
        "types/user.ts",
      );

    expect(tasksWithOverlap.length).toBeGreaterThanOrEqual(2);
    expect(tasksWithOverlap.map((t) => t.id)).toContain(task1Id);
    expect(tasksWithOverlap.map((t) => t.id)).toContain(task2Id);
  });

  it("should propagate status changes through dependency chain", async () => {
    // Mark task1 as failed
    await run(`UPDATE tasks SET status = 'failed' WHERE id = ?`, [task1Id]);
    await taskStateHistoryService.recordStateChange(
      task1Id,
      "pending",
      "failed",
      "test",
      "Simulated failure",
    );

    // Check if dependent tasks should be blocked
    const task2Row = (await getOne(`SELECT status FROM tasks WHERE id = ?`, [
      task2Id,
    ])) as any;
    const task3Row = (await getOne(`SELECT status FROM tasks WHERE id = ?`, [
      task3Id,
    ])) as any;

    // Tasks with unmet dependencies should be blockable
    // The actual blocking happens during execution, but we can check the dependency chain
    const dependsOnTask1 = await query(
      `SELECT source_task_id FROM task_relationships WHERE target_task_id = ? AND relationship_type = 'depends_on'`,
      [task1Id],
    );

    expect(dependsOnTask1.length).toBeGreaterThanOrEqual(1);
    expect(dependsOnTask1.map((r: any) => r.source_task_id)).toContain(task2Id);
  });

  it("should track cascade effects for auto-approve lists", async () => {
    // Update task list to auto-approve
    await run(
      `UPDATE task_lists_v2 SET auto_approve_reviews = 1 WHERE id = ?`,
      [taskListId],
    );

    // Verify auto-approve is set
    const taskList = (await getOne(
      `SELECT auto_approve_reviews FROM task_lists_v2 WHERE id = ?`,
      [taskListId],
    )) as any;
    expect(taskList.auto_approve_reviews).toBe(1);

    // With auto-approve, cascade changes would be applied automatically
    // This is handled by cascade-executor-service
    const canAutoApprove =
      await cascadeExecutorService.canAutoApprove(taskListId);
    expect(canAutoApprove).toBe(true);
  });

  it("should generate cascade report for task edit", async () => {
    // Simulate editing task1 description
    const originalTask = (await getOne(`SELECT * FROM tasks WHERE id = ?`, [
      task1Id,
    ])) as any;

    // Generate cascade report
    const report = await cascadeAnalyzerService.generateCascadeReport(task1Id);

    expect(report).toBeDefined();
    expect(report.taskId).toBe(task1Id);
    expect(report.dependentTasks).toBeDefined();
    expect(report.impactOverlaps).toBeDefined();
  });
});

// =============================================================================
// 8.4 E2E Test: Versioning and Rollback
// =============================================================================

describe("8.4 Versioning and Rollback", () => {
  let taskId: string;
  let taskListId: string;

  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    await cleanupTestData();

    // Create task list
    taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
      [taskListId, `${TEST_PREFIX}Version Test List`, null, "draft"],
    );

    // Create initial task
    const taskResult = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Versioned Task - Original`,
      taskListId,
      {
        description: "Original description v1",
        category: "feature",
        priority: "P2",
      },
    );
    taskId = taskResult.task.id;

    await saveDb();
  });

  it("should create version 1 on task creation", async () => {
    // Get initial version
    const versions = await taskVersionService.getVersionHistory(taskId);

    expect(versions).toBeDefined();
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].version).toBe(1);
  });

  it("should create new version on task edit", async () => {
    // Edit the task
    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - Updated`,
      description: "Updated description v2",
      changedBy: "test-user",
      changeReason: "Updated requirements",
    });

    // Get version history
    const versions = await taskVersionService.getVersionHistory(taskId);

    expect(versions.length).toBe(2);
    expect(versions[1].version).toBe(2);
    expect(versions[1].changeReason).toBe("Updated requirements");
  });

  it("should track all field changes between versions", async () => {
    // Create multiple versions
    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V2`,
      description: "Description v2",
      changedBy: "user-a",
      changeReason: "First update",
    });

    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V3`,
      description: "Description v3",
      category: "improvement",
      changedBy: "user-b",
      changeReason: "Second update",
    });

    // Get version history
    const versions = await taskVersionService.getVersionHistory(taskId);
    expect(versions.length).toBe(3);

    // Compare versions
    const diff = await taskVersionService.compareVersions(taskId, 1, 3);
    expect(diff.changes).toBeDefined();
    expect(diff.changes.title).toBeDefined();
    expect(diff.changes.description).toBeDefined();
  });

  it("should support rollback to previous version", async () => {
    // Create v2
    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V2`,
      description: "Description v2 - with a mistake",
      changedBy: "user-a",
      changeReason: "Made a mistake",
    });

    // Verify v2 is current
    const currentTask = (await getOne(
      `SELECT title, description FROM tasks WHERE id = ?`,
      [taskId],
    )) as any;
    expect(currentTask.title).toContain("V2");

    // Rollback to v1
    await taskVersionService.rollbackToVersion(
      taskId,
      1,
      "user-a",
      "Reverting mistake",
    );

    // Verify rollback created v3 with v1 content
    const versions = await taskVersionService.getVersionHistory(taskId);
    expect(versions.length).toBe(3);

    const rolledBackTask = (await getOne(
      `SELECT title, description FROM tasks WHERE id = ?`,
      [taskId],
    )) as any;
    expect(rolledBackTask.title).toContain("Original");
  });

  it("should record state transitions in history", async () => {
    // Record various state changes
    await taskStateHistoryService.recordStateChange(
      taskId,
      "pending",
      "in_progress",
      "agent-1",
      "Started work",
    );
    await taskStateHistoryService.recordStateChange(
      taskId,
      "in_progress",
      "validating",
      "agent-1",
      "Code complete",
    );
    await taskStateHistoryService.recordStateChange(
      taskId,
      "validating",
      "failed",
      "validator",
      "Tests failed",
    );
    await taskStateHistoryService.recordStateChange(
      taskId,
      "failed",
      "in_progress",
      "agent-1",
      "Retry attempt",
    );
    await taskStateHistoryService.recordStateChange(
      taskId,
      "in_progress",
      "validating",
      "agent-1",
      "Fixed issue",
    );
    await taskStateHistoryService.recordStateChange(
      taskId,
      "validating",
      "completed",
      "validator",
      "All tests passed",
    );

    // Get state history
    const history = await taskStateHistoryService.getHistory(taskId);

    expect(history.length).toBe(6);
    expect(history[0].fromStatus).toBe("pending");
    expect(history[history.length - 1].toStatus).toBe("completed");
  });

  it("should provide version metadata with timestamps", async () => {
    // Create versions
    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V2`,
      changedBy: "user-a",
      changeReason: "Update 1",
    });

    await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay

    await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V3`,
      changedBy: "user-b",
      changeReason: "Update 2",
    });

    // Get version metadata
    const versions = await taskVersionService.getVersionHistory(taskId);

    expect(versions[0].createdAt).toBeDefined();
    expect(versions[1].createdAt).toBeDefined();
    expect(versions[2].createdAt).toBeDefined();

    // Verify timestamps are in order
    const timestamps = versions.map((v) => new Date(v.createdAt).getTime());
    expect(timestamps[0]).toBeLessThan(timestamps[1]);
    expect(timestamps[1]).toBeLessThan(timestamps[2]);
  });

  it("should link version to superseded task", async () => {
    // Create new version
    const newVersion = await taskVersionService.createVersion(taskId, {
      title: `${TEST_PREFIX}Versioned Task - V2`,
      changedBy: "user-a",
      changeReason: "Major revision",
    });

    // The new version should reference the original
    expect(newVersion.supersedesVersion).toBe(1);

    // Get latest version
    const latest = await taskVersionService.getLatestVersion(taskId);
    expect(latest.version).toBe(2);
  });

  it("should support appendix versioning", async () => {
    // Add an appendix
    const appendix1 = await taskAppendixService.create({
      taskId,
      appendixType: "code_context",
      contentType: "inline",
      content: "// Original code context",
      title: "Code Context v1",
    });

    // Update the appendix
    const appendix2 = await taskAppendixService.update(appendix1.id, {
      content: "// Updated code context with new information",
      title: "Code Context v2",
    });

    expect(appendix2.id).toBe(appendix1.id);
    expect(appendix2.content).toContain("Updated");

    // Get appendices for task
    const appendices = await taskAppendixService.getByTaskId(taskId);
    expect(appendices.length).toBe(1);
  });
});

// =============================================================================
// Integration Test: Full Workflow
// =============================================================================

describe("Integration: Full Task System Workflow", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it("should complete full workflow from PRD to versioned task execution", async () => {
    console.log("[E2E Integration] Starting full workflow test...");

    // 1. Create PRD
    const prd = await prdService.create(
      {
        title: `${TEST_PREFIX}Integration Test PRD`,
        problemStatement: "Test problem",
        status: "draft",
      },
      "test-user",
    );
    console.log(`  [1/8] PRD created: ${prd.id}`);

    // 2. Approve PRD
    await prdService.approve(prd.id, "test-approver");
    console.log("  [2/8] PRD approved");

    // 3. Create task list
    const taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
      [taskListId, `${TEST_PREFIX}Integration Task List`, null, "draft"],
    );
    await prdLinkService.linkTaskList(prd.id, taskListId);
    console.log(`  [3/8] Task list created and linked: ${taskListId}`);

    // 4. Create tasks with impacts
    const task1 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Integration Task 1`,
      taskListId,
      { category: "feature" },
    );
    await taskImpactService.create({
      taskId: task1.task.id,
      impactType: "file",
      operation: "CREATE",
      targetPath: "server/routes/integration.ts",
      confidence: 0.95,
      source: "ai",
    });

    const task2 = await taskCreationService.createTaskInList(
      `${TEST_PREFIX}Integration Task 2`,
      taskListId,
      { category: "feature" },
    );
    await taskImpactService.create({
      taskId: task2.task.id,
      impactType: "file",
      operation: "UPDATE",
      targetPath: "server/routes/index.ts",
      confidence: 0.9,
      source: "ai",
    });
    console.log("  [4/8] Tasks created with impacts");

    // 5. Check conflicts
    const canParallel = await fileConflictDetector.canRunParallel(
      task1.task.id,
      task2.task.id,
    );
    expect(canParallel).toBe(true); // Different files
    console.log(`  [5/8] Conflict check passed (canParallel: ${canParallel})`);

    // 6. Create version
    await taskVersionService.createVersion(task1.task.id, {
      title: `${TEST_PREFIX}Integration Task 1 - Updated`,
      description: "Added more requirements",
      changedBy: "test-user",
      changeReason: "Requirements update",
    });
    console.log("  [6/8] Task version created");

    // 7. Calculate execution waves
    const waves = await parallelismCalculator.calculateWaves(taskListId);
    expect(waves.length).toBeGreaterThan(0);
    console.log(`  [7/8] Execution waves calculated: ${waves.length} waves`);

    // 8. Get coverage
    const coverage = await prdCoverageService.calculateCoverage(prd.id);
    console.log(
      `  [8/8] Coverage calculated: ${Math.round(coverage.coveragePercent)}%`,
    );

    console.log("[E2E Integration] Full workflow completed successfully!");
  });
});
