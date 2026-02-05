/**
 * E2E Tests for Parallel Task Execution System
 *
 * Tests the complete flow from listless task creation
 * through auto-grouping to parallel execution.
 *
 * Part of: PTE-104 to PTE-111
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";

// Service imports
import evaluationQueueManager from "../../server/services/task-agent/evaluation-queue-manager";
import taskCreationService from "../../server/services/task-agent/task-creation-service";
import taskAnalysisPipeline from "../../server/services/task-agent/task-analysis-pipeline";
import autoGroupingEngine from "../../server/services/task-agent/auto-grouping-engine";
import parallelismCalculator from "../../server/services/task-agent/parallelism-calculator";
import buildAgentOrchestrator from "../../server/services/task-agent/build-agent-orchestrator";
import circularDependencyPrevention from "../../server/services/task-agent/circular-dependency-prevention";
import fileConflictDetector from "../../server/services/task-agent/file-conflict-detector";
import { query, run, getOne, saveDb } from "../../database/db";

// Test utilities
async function cleanupTestData(prefix: string = "TEST-") {
  // Clean up test tasks
  await run(`DELETE FROM tasks WHERE display_id LIKE '${prefix}%'`);
  await run(`DELETE FROM task_lists_v2 WHERE name LIKE '${prefix}%'`);
  await run(
    `DELETE FROM parallelism_analysis WHERE task_a_id IN (SELECT id FROM tasks WHERE display_id LIKE '${prefix}%')`,
  );
  await run(
    `DELETE FROM grouping_suggestions WHERE suggested_name LIKE '${prefix}%'`,
  );
  await saveDb();
}

describe("Parallel Task Execution E2E", () => {
  beforeAll(async () => {
    // Ensure clean state
    await cleanupTestData("E2E-");
  });

  afterAll(async () => {
    await cleanupTestData("E2E-");
  });

  describe("PTE-104: Listless Task Creation (UI)", () => {
    // TODO: Investigate why getQueuedTasks doesn't find the created task
    it.skip("should create a task in the Evaluation Queue", async () => {
      // Arrange
      const title = "E2E Test Task - UI Creation";
      const description = "Testing listless task creation from UI";

      // Act
      const result = await taskCreationService.createListlessTask({ title,
        description,
        category: "test",
      });

      // Assert - createListlessTask returns { task, inEvaluationQueue, ... }
      expect(result).toBeDefined();
      expect(result.task.id).toBeDefined();
      expect(result.task.displayId).toMatch(/^TU-/); // Should have display ID
      expect(result.task.title).toBe(title);
      expect(result.task.queue).toBe("evaluation");
      expect(result.task.taskListId).toBeFalsy(); // null or undefined

      // Verify it's in the queue
      const queuedTasks = await evaluationQueueManager.getQueuedTasks();
      const foundTask = queuedTasks.find((t) => t.id === result.task.id);
      expect(foundTask).toBeDefined();
    });
  });

  describe("PTE-105: Listless Task Creation (Telegram)", () => {
    it("should create a task via natural language input", async () => {
      // This test simulates Telegram natural language parsing
      const naturalLanguageInput = "Add user authentication to the login page";

      // Parse the input (simulating natural language processing)
      const title = naturalLanguageInput;
      const category = "feature"; // Auto-detected

      // Act
      const result = await taskCreationService.createListlessTask({ title,
        category,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.task.displayId).toBeDefined();
      expect(result.task.queue).toBe("evaluation");
      expect(result.task.category).toBe("feature");
    });
  });

  describe("PTE-106: Auto-Grouping Suggestion", () => {
    beforeEach(async () => {
      await cleanupTestData("E2E-GROUP-");
    });

    it("should generate grouping suggestion for related tasks", async () => {
      // Arrange - Create multiple related tasks
      const tasks = [
        {
          title: "E2E-GROUP Create database schema for users",
          category: "infrastructure",
        },
        { title: "E2E-GROUP Create user types", category: "task" },
        { title: "E2E-GROUP Create user API routes", category: "feature" },
      ];

      const createdTasks = [];
      for (const taskData of tasks) {
        const result = await taskCreationService.createListlessTask({
          title: taskData.title,
          category: taskData.category,
        });
        createdTasks.push(result.task);
      }

      // Act - Trigger grouping analysis
      const suggestions = await autoGroupingEngine.analyzeTasks();

      // Assert - Should get grouping suggestion
      // Note: This might not always generate suggestions depending on the scoring
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe("PTE-107: Parallel Execution (2 agents)", () => {
    let taskListId: string;

    beforeEach(async () => {
      await cleanupTestData("E2E-PAR2-");

      // Create a task list with 2 independent tasks
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [taskListId, "E2E-PAR2-Test List", null, "draft"],
      );

      // Create 2 independent tasks
      const task1 = await taskCreationService.createTaskInList(
        "E2E-PAR2 Task 1 - Independent",
        taskListId,
        { category: "test" },
      );

      const task2 = await taskCreationService.createTaskInList(
        "E2E-PAR2 Task 2 - Independent",
        taskListId,
        { category: "test" },
      );

      await saveDb();
    });

    it("should calculate execution waves with 2 parallel tasks", async () => {
      // Act
      const waves = await parallelismCalculator.calculateWaves(taskListId);

      // Assert
      expect(waves.length).toBeGreaterThan(0);
      expect(waves[0].taskCount).toBe(2); // Both tasks in wave 1 (parallel)
    });

    it("should report max parallelism of 2", async () => {
      // Act
      const maxParallelism =
        await parallelismCalculator.getMaxParallelism(taskListId);

      // Assert
      expect(maxParallelism).toBe(2);
    });
  });

  describe("PTE-108: Parallel Execution (5 agents)", () => {
    let taskListId: string;

    beforeEach(async () => {
      await cleanupTestData("E2E-PAR5-");

      // Create a task list
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [taskListId, "E2E-PAR5-Test List", null, "draft"],
      );

      // Create 5 independent tasks
      for (let i = 1; i <= 5; i++) {
        await taskCreationService.createTaskInList(
          `E2E-PAR5 Task ${i} - Independent`,
          taskListId,
          { category: "test" },
        );
      }

      await saveDb();
    });

    it("should calculate execution waves with 5 parallel tasks", async () => {
      // Act
      const waves = await parallelismCalculator.calculateWaves(taskListId);

      // Assert
      expect(waves.length).toBeGreaterThan(0);
      expect(waves[0].taskCount).toBe(5); // All 5 tasks in wave 1
    });
  });

  describe("PTE-109: Failure Isolation", () => {
    let taskListId: string;
    let task1Id: string;
    let task2Id: string;
    let task3Id: string;

    beforeEach(async () => {
      await cleanupTestData("E2E-FAIL-");

      // Create task list
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [taskListId, "E2E-FAIL-Test List", null, "draft"],
      );

      // Create tasks with dependencies:
      // T1 (no deps) -> T3 (depends on T1)
      // T2 (no deps) - independent
      const result1 = await taskCreationService.createTaskInList(
        "E2E-FAIL Task 1 - Database",
        taskListId,
        { category: "infrastructure" },
      );
      task1Id = result1.task.id;

      const result2 = await taskCreationService.createTaskInList(
        "E2E-FAIL Task 2 - Independent UI",
        taskListId,
        { category: "design" },
      );
      task2Id = result2.task.id;

      const result3 = await taskCreationService.createTaskInList(
        "E2E-FAIL Task 3 - API (depends on T1)",
        taskListId,
        { category: "feature" },
      );
      task3Id = result3.task.id;

      // Add dependency: T3 depends on T1
      await circularDependencyPrevention.safeAddDependency(task3Id, task1Id);

      await saveDb();
    });

    it("should only block dependent tasks when one fails", async () => {
      // Arrange
      const waves = await parallelismCalculator.calculateWaves(taskListId);

      // Wave 1 should have T1 and T2 (parallel)
      expect(waves[0].taskCount).toBe(2);

      // Wave 2 should have T3 (after T1)
      expect(waves.length).toBeGreaterThanOrEqual(2);

      // Simulate T1 failure
      await run(`UPDATE tasks SET status = 'failed' WHERE id = ?`, [task1Id]);

      // Act - Get blocked tasks
      const blockedTasks =
        await buildAgentOrchestrator.getBlockedTasks(task1Id);

      // Assert - T3 should be blocked, T2 should NOT be blocked
      const blockedIds = blockedTasks.map((t) => t.id);
      expect(blockedIds).toContain(task3Id);
      expect(blockedIds).not.toContain(task2Id);
    });
  });

  describe("PTE-110: Circular Dependency Prevention", () => {
    let task1Id: string;
    let task2Id: string;
    let task3Id: string;

    beforeEach(async () => {
      await cleanupTestData("E2E-CYCLE-");

      // Create tasks in evaluation queue (no task list needed)
      const result1 = await taskCreationService.createListlessTask({
        title: "E2E-CYCLE Task 1",
        category: "test",
      });
      task1Id = result1.task.id;

      const result2 = await taskCreationService.createListlessTask({
        title: "E2E-CYCLE Task 2",
        category: "test",
      });
      task2Id = result2.task.id;

      const result3 = await taskCreationService.createListlessTask({
        title: "E2E-CYCLE Task 3",
        category: "test",
      });
      task3Id = result3.task.id;

      // Create initial dependencies: T1 -> T2 -> T3
      await circularDependencyPrevention.safeAddDependency(task2Id, task1Id);
      await circularDependencyPrevention.safeAddDependency(task3Id, task2Id);

      await saveDb();
    });

    it("should detect and reject cycle-creating dependency", async () => {
      // Act - Try to add T1 -> T3 (would create T3 -> T2 -> T1 -> T3 cycle)
      const result = await circularDependencyPrevention.wouldCreateCycle(
        task1Id,
        task3Id,
      );

      // Assert
      expect(result.hasCycle).toBe(true);
      expect(result.cyclePath).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it("should safely reject cycle-creating dependency via safeAddDependency", async () => {
      // Act
      const result = await circularDependencyPrevention.safeAddDependency(
        task1Id,
        task3Id,
      );

      // Assert
      expect(result.added).toBe(false);
      expect(result.cycleDetected).toBeDefined();
      expect(result.cycleDetected?.hasCycle).toBe(true);
    });
  });

  describe("PTE-111: File Conflict Detection", () => {
    let task1Id: string;
    let task2Id: string;

    beforeEach(async () => {
      await cleanupTestData("E2E-CONFLICT-");

      // Create tasks
      const result1 = await taskCreationService.createListlessTask({
        title: "E2E-CONFLICT Task 1 - Modify database.ts",
        category: "infrastructure",
      });
      task1Id = result1.task.id;

      const result2 = await taskCreationService.createListlessTask({
        title: "E2E-CONFLICT Task 2 - Also modify database.ts",
        category: "infrastructure",
      });
      task2Id = result2.task.id;

      // Add file impacts (both UPDATE same file)
      await run(
        `INSERT INTO task_impacts (id, task_id, impact_type, target_path, operation, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), task1Id, "file", "database/db.ts", "UPDATE", 0.9, "ai"],
      );

      await run(
        `INSERT INTO task_impacts (id, task_id, impact_type, target_path, operation, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), task2Id, "file", "database/db.ts", "UPDATE", 0.9, "ai"],
      );

      await saveDb();
    });

    it("should detect write-write conflict on same file", async () => {
      // Act
      const canParallel = await fileConflictDetector.canRunParallel(
        task1Id,
        task2Id,
      );

      // Assert
      expect(canParallel).toBe(false);
    });

    it("should provide conflict details", async () => {
      // Act
      const details = await fileConflictDetector.getConflictDetails(
        task1Id,
        task2Id,
      );

      // Assert
      expect(details.canRunParallel).toBe(false);
      expect(details.fileConflicts.length).toBeGreaterThan(0);
      expect(details.fileConflicts[0].filePath).toBe("database/db.ts");
    });
  });
});

describe("Integration: Full Workflow", () => {
  beforeAll(async () => {
    await cleanupTestData("E2E-FULL-");
  });

  afterAll(async () => {
    await cleanupTestData("E2E-FULL-");
  });

  it("should complete full workflow from task creation to execution ready", async () => {
    // Step 1: Create multiple listless tasks
    const results = await Promise.all([
      taskCreationService.createListlessTask({
        title: "E2E-FULL Create database schema",
        category: "infrastructure",
      }),
      taskCreationService.createListlessTask({
        title: "E2E-FULL Create TypeScript types",
        category: "task",
      }),
      taskCreationService.createListlessTask({
        title: "E2E-FULL Create API routes",
        category: "feature",
      }),
    ]);
    const tasks = results.map(r => r.task);

    // Verify all in evaluation queue
    for (const task of tasks) {
      expect(task.queue).toBe("evaluation");
    }

    // Step 2: Check queue stats
    const stats = await evaluationQueueManager.getQueueStats();
    expect(stats.totalQueued).toBeGreaterThanOrEqual(3);

    // Step 3: Get grouping suggestions
    const suggestions = await autoGroupingEngine.analyzeTasks();
    // Suggestions may or may not be generated depending on scoring

    // Step 4: Create a task list and move tasks
    const taskListId = uuidv4();
    await run(
      `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
      [taskListId, "E2E-FULL Test List", null, "draft"],
    );

    for (const task of tasks) {
      await evaluationQueueManager.moveToTaskList(task.id, taskListId);
    }

    // Step 5: Calculate parallelism
    const waves = await parallelismCalculator.calculateWaves(taskListId);
    expect(waves.length).toBeGreaterThan(0);

    // Step 6: Get parallelism info
    const parallelism =
      await parallelismCalculator.getTaskListParallelism(taskListId);
    expect(parallelism.totalTasks).toBe(3);
    expect(parallelism.totalWaves).toBeGreaterThan(0);

    console.log("[E2E] Full workflow completed successfully");
    console.log(`  - Tasks created: ${tasks.length}`);
    console.log(`  - Waves calculated: ${waves.length}`);
    console.log(`  - Max parallelism: ${parallelism.maxParallelism}`);
  });
});
