/**
 * Build Agent Acceptance Tests
 *
 * Integration tests for the full build execution flow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  BuildAgent,
  createBuildAgent,
  runBuild,
} from "../../agents/build/core.js";
import { TaskLoader } from "../../agents/build/task-loader.js";
import { TaskExecutor } from "../../agents/build/task-executor.js";
import { CheckpointManager } from "../../agents/build/checkpoint-manager.js";

// Mock the database functions
vi.mock("../../database/db.js", () => ({
  createBuildExecution: vi.fn().mockResolvedValue("test-build-id"),
  getBuildExecution: vi.fn().mockResolvedValue({
    id: "test-build-id",
    spec_id: "test-spec",
    spec_path: "/test/tasks.md",
    status: "pending",
  }),
  updateBuildExecution: vi.fn().mockResolvedValue(undefined),
  createTaskExecution: vi.fn().mockResolvedValue("test-task-exec-id"),
  updateTaskExecution: vi.fn().mockResolvedValue(undefined),
  createBuildCheckpoint: vi.fn().mockResolvedValue("test-checkpoint-id"),
  getLatestCheckpoint: vi.fn().mockResolvedValue(null),
  saveDb: vi.fn().mockResolvedValue(undefined),
}));

// Mock WebSocket events
vi.mock("../../server/websocket.js", () => ({
  emitBuildEvent: vi.fn(),
  emitTaskStarted: vi.fn(),
  emitTaskCompleted: vi.fn(),
  emitTaskFailed: vi.fn(),
  emitBuildProgress: vi.fn(),
}));

describe("Build Agent Acceptance", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "build-agent-acceptance-"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Helper to create test files
  function createTestFile(relativePath: string, content: string): string {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content);
    return fullPath;
  }

  // Sample tasks file for testing
  const simpleTasksContent = `---
id: simple-test
complexity: simple
total_tasks: 2
phases:
  types: 1
  api: 1
---

# Simple Test Tasks

\`\`\`yaml
id: T-001
phase: types
action: CREATE
file: "types/test.ts"
status: pending
requirements:
  - "Create interface"
validation:
  command: "echo OK"
  expected: "OK"
depends_on: []
\`\`\`

\`\`\`yaml
id: T-002
phase: api
action: CREATE
file: "api/test.ts"
status: pending
requirements:
  - "Create route"
validation:
  command: "echo OK"
  expected: "OK"
depends_on:
  - T-001
\`\`\`
`;

  describe("BuildAgent", () => {
    it("should create a BuildAgent instance", () => {
      const agent = new BuildAgent({ projectRoot: tempDir });
      expect(agent).toBeInstanceOf(BuildAgent);
    });

    it("should create agent with createBuildAgent factory", () => {
      const agent = createBuildAgent({ projectRoot: tempDir });
      expect(agent).toBeInstanceOf(BuildAgent);
    });

    it("should parse tasks file correctly", () => {
      const tasksPath = createTestFile("tasks.md", simpleTasksContent);
      const loader = new TaskLoader({ projectRoot: tempDir });
      const result = loader.load(tasksPath);

      expect(result.success).toBe(true);
      expect(result.file?.tasks).toHaveLength(2);
      expect(result.file?.frontmatter.id).toBe("simple-test");
    });

    it("should order tasks by dependencies", () => {
      const tasksPath = createTestFile("tasks.md", simpleTasksContent);
      const loader = new TaskLoader({ projectRoot: tempDir });
      const result = loader.load(tasksPath);
      const ordered = loader.orderByDependency(result.file!.tasks);

      expect(ordered[0].id).toBe("T-001");
      expect(ordered[1].id).toBe("T-002");
    });
  });

  describe("TaskExecutor integration", () => {
    it("should execute tasks in order", async () => {
      const tasksPath = createTestFile("tasks.md", simpleTasksContent);
      const loader = new TaskLoader({ projectRoot: tempDir });
      const result = loader.load(tasksPath);

      const executedTasks: string[] = [];
      const executor = new TaskExecutor({
        onTaskComplete: (result) => {
          executedTasks.push(result.taskId);
        },
      });

      // Convert to AtomicTask format
      const atomicTasks = result.file!.tasks.map((t) => ({
        id: t.id,
        phase: t.phase,
        action: t.action,
        file: t.file,
        status: t.status,
        requirements: t.requirements,
        gotchas: t.gotchas,
        validation: t.validation,
        codeTemplate: t.codeTemplate,
        dependsOn: t.dependsOn,
      }));

      const results = await executor.execute(atomicTasks, tasksPath);

      expect(results).toHaveLength(2);
      expect(executedTasks).toContain("T-001");
      expect(executedTasks).toContain("T-002");
    });

    it("should skip tasks with unmet dependencies", async () => {
      const executor = new TaskExecutor();

      // Task with dependency that doesn't exist in the list
      const atomicTasks = [
        {
          id: "T-002",
          phase: "api",
          action: "CREATE" as const,
          file: "api/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: ["T-001"], // T-001 not in list
        },
      ];

      const results = await executor.execute(atomicTasks, "/test/tasks.md");

      expect(results[0].state).toBe("skipped");
    });

    it("should track task states", async () => {
      const executor = new TaskExecutor();

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      await executor.execute(atomicTasks, "/test/tasks.md");

      expect(executor.getTaskState("T-001")).toBe("done");
    });

    it("should reset state", async () => {
      const executor = new TaskExecutor();

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      await executor.execute(atomicTasks, "/test/tasks.md");
      expect(executor.getTaskState("T-001")).toBe("done");

      executor.reset();
      expect(executor.getTaskState("T-001")).toBeUndefined();
    });
  });

  describe("Checkpoint and Resume", () => {
    it("should create checkpoint manager", () => {
      const manager = new CheckpointManager();
      expect(manager).toBeInstanceOf(CheckpointManager);
    });

    it("should save and load checkpoint", () => {
      const manager = new CheckpointManager();
      const state = {
        buildId: "test-build",
        completedTasks: ["T-001"],
        failedTasks: [],
        currentTaskIndex: 1,
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        context: { key: "value" },
      };

      manager.save("test-build", "T-001", state);
      const loaded = manager.load("test-build");

      expect(loaded).toBeDefined();
      expect(loaded?.completedTasks).toEqual(["T-001"]);
    });

    it("should return null for non-existent checkpoint", () => {
      const manager = new CheckpointManager();
      const loaded = manager.load("non-existent");

      expect(loaded).toBeNull();
    });

    it("should cleanup old checkpoints", () => {
      const manager = new CheckpointManager();

      // Create multiple checkpoints
      for (let i = 0; i < 10; i++) {
        manager.save("test-build", `T-00${i}`, {
          buildId: "test-build",
          completedTasks: [`T-00${i}`],
          currentTaskIndex: i,
          failedTasks: [],
          startedAt: new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          context: {},
        });
      }

      manager.cleanup("test-build", 3);

      // Should still have at least one checkpoint
      const loaded = manager.load("test-build");
      expect(loaded).toBeDefined();
    });
  });

  describe("Progress Tracking", () => {
    it("should emit progress events", async () => {
      const progressUpdates: Array<{ completed: number; total: number }> = [];

      const executor = new TaskExecutor({
        onProgress: (progress) => {
          progressUpdates.push({
            completed: progress.completed,
            total: progress.total,
          });
        },
      });

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-002",
          phase: "api",
          action: "CREATE" as const,
          file: "api/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      await executor.execute(atomicTasks, "/test/tasks.md");

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1].completed).toBe(2);
    });

    it("should calculate progress percentage", async () => {
      let finalPercentage = 0;

      const executor = new TaskExecutor({
        onProgress: (progress) => {
          finalPercentage = progress.percentage;
        },
      });

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      await executor.execute(atomicTasks, "/test/tasks.md");

      expect(finalPercentage).toBe(100);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing tasks file gracefully", () => {
      const loader = new TaskLoader({ projectRoot: tempDir });
      const result = loader.load("/non/existent/tasks.md");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle invalid YAML gracefully", () => {
      const invalidContent = `---
id: invalid
---

\`\`\`yaml
this is: [not valid: yaml
  broken: structure
\`\`\`
`;
      const tasksPath = createTestFile("invalid.md", invalidContent);
      const loader = new TaskLoader({ projectRoot: tempDir });
      const result = loader.load(tasksPath);

      expect(result.success).toBe(false);
    });

    it("should report task failures", async () => {
      const failures: Array<{ taskId: string; error: Error }> = [];

      const mockCodeGenerator = {
        generate: vi.fn().mockRejectedValue(new Error("Generation failed")),
      };

      const executor = new TaskExecutor({
        codeGenerator: mockCodeGenerator,
        onTaskFailed: (taskId, error) => {
          failures.push({ taskId, error });
        },
      });

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      const results = await executor.execute(atomicTasks, "/test/tasks.md");

      expect(results[0].state).toBe("failed");
      expect(failures).toHaveLength(1);
      expect(failures[0].taskId).toBe("T-001");
    });
  });

  describe("Dry Run Mode", () => {
    it("should support dry run without writing files", async () => {
      const executor = new TaskExecutor({
        // No file writer = dry run
      });

      const atomicTasks = [
        {
          id: "T-001",
          phase: "types",
          action: "CREATE" as const,
          file: "types/test.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          codeTemplate: "export interface Test {}",
          dependsOn: [],
        },
      ];

      const results = await executor.execute(atomicTasks, "/test/tasks.md");

      expect(results[0].state).toBe("done");
      // File should not be created
      expect(fs.existsSync(path.join(tempDir, "types/test.ts"))).toBe(false);
    });
  });

  describe("runBuild helper", () => {
    it("should export runBuild function", () => {
      expect(typeof runBuild).toBe("function");
    });
  });
});
