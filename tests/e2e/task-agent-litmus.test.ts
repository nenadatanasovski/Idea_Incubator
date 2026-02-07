/**
 * Task Agent Litmus Test (Vitest version)
 *
 * End-to-end tests for validating Task Agent functionality.
 * These tests use actual services and can be run with vitest.
 *
 * Run: npm test -- tests/e2e/task-agent-litmus.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { v4 as uuidv4 } from "uuid";

// Import services
import taskCreationService from "../../server/services/task-agent/task-creation-service";
import evaluationQueueManager from "../../server/services/task-agent/evaluation-queue-manager";
import parallelismCalculator from "../../server/services/task-agent/parallelism-calculator";
import circularDependencyPrevention from "../../server/services/task-agent/circular-dependency-prevention";
import buildAgentOrchestrator from "../../server/services/task-agent/build-agent-orchestrator";
import fileConflictDetector from "../../server/services/task-agent/file-conflict-detector";
import { run, saveDb } from "../../database/db";

// Test configuration
const CONFIG = {
  TEST_PREFIX: "LITMUS-",
};

// Cleanup test data
async function cleanupTestData(): Promise<void> {
  await run(
    `DELETE FROM tasks WHERE display_id LIKE '${CONFIG.TEST_PREFIX}%' OR title LIKE '${CONFIG.TEST_PREFIX}%'`,
  );
  await run(
    `DELETE FROM task_lists_v2 WHERE name LIKE '${CONFIG.TEST_PREFIX}%'`,
  );
  await saveDb();
}

describe("Task Agent Litmus Tests", () => {
  beforeAll(async () => {
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("Flow 1: Task Creation → Evaluation Queue → Task List → Parallel Execution", () => {
    let taskId: string;
    let taskDisplayId: string;
    let taskListId: string;

    it("should create a task via TaskCreationService", async () => {
      const result = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Create test endpoint`,
        description:
          'Create a simple GET /api/test endpoint that returns { status: "ok" }',
        category: "feature",
      });

      const task = result.task;
      taskId = task.id;
      taskDisplayId = task.displayId;

      expect(task).toBeDefined();
      expect(task.displayId).toBeDefined();
      expect(task.queue).toBe("evaluation");

      console.log(`\n[LITMUS] Task created: ${task.displayId} - ${task.title}`);
      console.log(`[LITMUS] Task queue: ${task.queue}`);
    });

    it("should find task in Evaluation Queue", async () => {
      const queuedTask = await evaluationQueueManager.getQueuedTask(taskId);

      expect(queuedTask).toBeDefined();
      expect(queuedTask?.displayId).toBe(taskDisplayId);

      console.log(`[LITMUS] Found in queue: ${queuedTask?.displayId}`);
    });

    it("should show queue statistics", async () => {
      const stats = await evaluationQueueManager.getQueueStats();

      expect(stats.totalQueued).toBeGreaterThan(0);

      console.log(
        `[LITMUS] Queue stats: ${stats.totalQueued} queued, ${stats.staleCount} stale`,
      );
    });

    it("should move task to task list", async () => {
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [taskListId, `${CONFIG.TEST_PREFIX}Test Feature List`, null, "draft"],
      );
      await saveDb();

      await evaluationQueueManager.moveToTaskList(taskId, taskListId);

      // Verify task is no longer in queue (returns null when not found)
      const queuedTask = await evaluationQueueManager.getQueuedTask(taskId);
      expect(queuedTask).toBeNull();

      console.log(`[LITMUS] Task moved to list: ${taskListId}`);
    });

    it("should calculate parallelism for task list", async () => {
      const parallelism =
        await parallelismCalculator.getTaskListParallelism(taskListId);

      expect(parallelism.totalTasks).toBe(1);
      expect(parallelism.totalWaves).toBeGreaterThan(0);

      console.log(`[LITMUS] Total tasks: ${parallelism.totalTasks}`);
      console.log(`[LITMUS] Total waves: ${parallelism.totalWaves}`);
      console.log(`[LITMUS] Max parallelism: ${parallelism.maxParallelism}`);
    });
  });

  describe("Flow 2: Multiple Tasks → Parallel Execution Waves", () => {
    let taskListId: string;
    let tasks: Array<{ id: string; displayId: string }> = [];

    beforeEach(async () => {
      tasks = [];
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [taskListId, `${CONFIG.TEST_PREFIX}Parallel Test List`, null, "draft"],
      );
    });

    it("should create 3 independent tasks in task list", async () => {
      for (let i = 1; i <= 3; i++) {
        const result = await taskCreationService.createTaskInList({
          title: `${CONFIG.TEST_PREFIX}Independent Task ${i}`,
          taskListId,
          category: "task",
        });
        tasks.push({ id: result.task.id, displayId: result.task.displayId });
        console.log(`[LITMUS] Created task ${i}: ${result.task.displayId}`);
      }

      await saveDb();
      expect(tasks.length).toBe(3);
    });

    it("should put all 3 independent tasks in Wave 1", async () => {
      // Create tasks first
      for (let i = 1; i <= 3; i++) {
        const result = await taskCreationService.createTaskInList({
          title: `${CONFIG.TEST_PREFIX}Wave Test Task ${i}`,
          taskListId,
          category: "task",
        });
        tasks.push({ id: result.task.id, displayId: result.task.displayId });
      }
      await saveDb();

      const waves = await parallelismCalculator.calculateWaves(taskListId);

      expect(waves.length).toBe(1);
      expect(waves[0].taskCount).toBe(3);

      console.log(`[LITMUS] Total waves: ${waves.length}`);
      console.log(`[LITMUS] Wave 1 task count: ${waves[0].taskCount}`);
    });

    it("should create Wave 2 when dependency added", async () => {
      // Create tasks first
      for (let i = 1; i <= 3; i++) {
        const result = await taskCreationService.createTaskInList({
          title: `${CONFIG.TEST_PREFIX}Dep Test Task ${i}`,
          taskListId,
          category: "task",
        });
        tasks.push({ id: result.task.id, displayId: result.task.displayId });
      }
      await saveDb();

      // Add dependency: Task 3 depends on Task 1
      await circularDependencyPrevention.safeAddDependency(
        tasks[2].id,
        tasks[0].id,
      );

      const waves = await parallelismCalculator.calculateWaves(taskListId);

      expect(waves.length).toBe(2);

      console.log(`[LITMUS] Total waves after dependency: ${waves.length}`);
      for (const wave of waves) {
        console.log(
          `[LITMUS]   Wave ${wave.waveNumber}: ${wave.taskCount} tasks`,
        );
      }
    });
  });

  describe("Flow 3: Circular Dependency Prevention", () => {
    let taskA: { id: string; displayId: string };
    let taskB: { id: string; displayId: string };
    let taskC: { id: string; displayId: string };

    beforeEach(async () => {
      const resultA = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Chain Task A`,
        category: "task",
      });
      taskA = { id: resultA.task.id, displayId: resultA.task.displayId };

      const resultB = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Chain Task B`,
        category: "task",
      });
      taskB = { id: resultB.task.id, displayId: resultB.task.displayId };

      const resultC = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Chain Task C`,
        category: "task",
      });
      taskC = { id: resultC.task.id, displayId: resultC.task.displayId };

      // Create chain: B depends on A, C depends on B
      await circularDependencyPrevention.safeAddDependency(taskB.id, taskA.id);
      await circularDependencyPrevention.safeAddDependency(taskC.id, taskB.id);
      await saveDb();

      console.log(`[LITMUS] Task A: ${taskA.displayId}`);
      console.log(`[LITMUS] Task B: ${taskB.displayId}`);
      console.log(`[LITMUS] Task C: ${taskC.displayId}`);
      console.log(`[LITMUS] Created dependency chain: A → B → C`);
    });

    it("should detect cycle when trying to add A depends on C", async () => {
      const cycleCheck = await circularDependencyPrevention.wouldCreateCycle(
        taskA.id,
        taskC.id,
      );

      expect(cycleCheck.hasCycle).toBe(true);
      expect(cycleCheck.cyclePath).toBeDefined();

      console.log(`[LITMUS] Cycle detected: ${cycleCheck.hasCycle}`);
      if (cycleCheck.cyclePath) {
        console.log(`[LITMUS] Cycle path: ${cycleCheck.cyclePath.join(" → ")}`);
      }
    });

    it("should prevent cycle-creating dependency", async () => {
      const addResult = await circularDependencyPrevention.safeAddDependency(
        taskA.id,
        taskC.id,
      );

      expect(addResult.added).toBe(false);
      expect(addResult.cycleDetected?.hasCycle).toBe(true);

      console.log(`[LITMUS] Dependency added: ${addResult.added}`);
      console.log(
        `[LITMUS] Cycle prevented: ${addResult.cycleDetected?.hasCycle ? "YES" : "NO"}`,
      );
    });
  });

  describe("Flow 4: File Conflict Detection", () => {
    let task1: { id: string; displayId: string };
    let task2: { id: string; displayId: string };

    beforeEach(async () => {
      const result1 = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Modify config.ts - Task 1`,
        category: "task",
      });
      task1 = { id: result1.task.id, displayId: result1.task.displayId };

      const result2 = await taskCreationService.createListlessTask({
        title: `${CONFIG.TEST_PREFIX}Modify config.ts - Task 2`,
        category: "task",
      });
      task2 = { id: result2.task.id, displayId: result2.task.displayId };

      // Add file impacts (both UPDATE same file)
      await run(
        `INSERT INTO task_impacts (id, task_id, impact_type, target_path, operation, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), task1.id, "file", "server/config.ts", "UPDATE", 0.9, "ai"],
      );
      await run(
        `INSERT INTO task_impacts (id, task_id, impact_type, target_path, operation, confidence, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), task2.id, "file", "server/config.ts", "UPDATE", 0.9, "ai"],
      );
      await saveDb();

      console.log(`[LITMUS] Task 1: ${task1.displayId}`);
      console.log(`[LITMUS] Task 2: ${task2.displayId}`);
      console.log(`[LITMUS] Both tasks UPDATE server/config.ts`);
    });

    it("should detect that tasks cannot run in parallel due to file conflict", async () => {
      const canParallel = await fileConflictDetector.canRunParallel(
        task1.id,
        task2.id,
      );

      expect(canParallel).toBe(false);

      console.log(`[LITMUS] Can run in parallel: ${canParallel}`);
    });

    it("should provide file conflict details", async () => {
      const details = await fileConflictDetector.getConflictDetails(
        task1.id,
        task2.id,
      );

      expect(details.canRunParallel).toBe(false);
      expect(details.fileConflicts.length).toBeGreaterThan(0);
      expect(details.fileConflicts[0].filePath).toBe("server/config.ts");

      console.log(`[LITMUS] Conflict details:`);
      console.log(`[LITMUS]   - Can parallel: ${details.canRunParallel}`);
      console.log(
        `[LITMUS]   - File conflicts: ${details.fileConflicts.length}`,
      );
      console.log(
        `[LITMUS]   - Conflicting file: ${details.fileConflicts[0].filePath}`,
      );
    });
  });

  describe("Flow 5: Failure Isolation", () => {
    let taskListId: string;
    let t1: { id: string; displayId: string };
    let t2: { id: string; displayId: string };
    let t3: { id: string; displayId: string };

    beforeEach(async () => {
      taskListId = uuidv4();
      await run(
        `INSERT INTO task_lists_v2 (id, name, project_id, status) VALUES (?, ?, ?, ?)`,
        [
          taskListId,
          `${CONFIG.TEST_PREFIX}Failure Isolation Test`,
          null,
          "draft",
        ],
      );

      // Create 3 tasks: T1 (no deps), T2 (no deps), T3 (depends on T1)
      const result1 = await taskCreationService.createTaskInList({
        title: `${CONFIG.TEST_PREFIX}Failure - Task 1 (Independent)`,
        taskListId,
        category: "task",
      });
      t1 = { id: result1.task.id, displayId: result1.task.displayId };

      const result2 = await taskCreationService.createTaskInList({
        title: `${CONFIG.TEST_PREFIX}Failure - Task 2 (Independent)`,
        taskListId,
        category: "task",
      });
      t2 = { id: result2.task.id, displayId: result2.task.displayId };

      const result3 = await taskCreationService.createTaskInList({
        title: `${CONFIG.TEST_PREFIX}Failure - Task 3 (Depends on T1)`,
        taskListId,
        category: "task",
      });
      t3 = { id: result3.task.id, displayId: result3.task.displayId };

      // Add dependency: T3 depends on T1
      await circularDependencyPrevention.safeAddDependency(t3.id, t1.id);
      await saveDb();

      console.log(`[LITMUS] T1: ${t1.displayId} - Independent`);
      console.log(`[LITMUS] T2: ${t2.displayId} - Independent`);
      console.log(`[LITMUS] T3: ${t3.displayId} - Depends on T1`);
    });

    it("should only block dependent task T3 when T1 fails", async () => {
      // Simulate T1 failure
      await run(`UPDATE tasks SET status = 'failed' WHERE id = ?`, [t1.id]);
      await saveDb();

      const blockedTasks = await buildAgentOrchestrator.getBlockedTasks(t1.id);

      const t2Blocked = blockedTasks.some((t) => t.id === t2.id);
      const t3Blocked = blockedTasks.some((t) => t.id === t3.id);

      expect(t2Blocked).toBe(false);
      expect(t3Blocked).toBe(true);

      console.log(`[LITMUS] Blocked tasks count: ${blockedTasks.length}`);
      console.log(`[LITMUS] T2 blocked: ${t2Blocked} (should be false)`);
      console.log(`[LITMUS] T3 blocked: ${t3Blocked} (should be true)`);
    });
  });

  describe("Flow 6: Build Agent Orchestrator Status", () => {
    it("should return orchestrator status", async () => {
      const status = await buildAgentOrchestrator.getOrchestratorStatus();

      expect(status).toBeDefined();
      expect(typeof status.activeListCount).toBe("number");
      expect(typeof status.runningAgentCount).toBe("number");

      console.log(`[LITMUS] Orchestrator Status:`);
      console.log(`[LITMUS]   Active lists: ${status.activeListCount}`);
      console.log(`[LITMUS]   Running agents: ${status.runningAgentCount}`);
      console.log(`[LITMUS]   Total tasks today: ${status.totalTasksToday}`);
      console.log(`[LITMUS]   Completed today: ${status.completedToday}`);
      console.log(`[LITMUS]   Failed today: ${status.failedToday}`);
    });
  });
});
