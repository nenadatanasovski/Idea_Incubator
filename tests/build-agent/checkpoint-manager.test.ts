/**
 * Checkpoint Manager Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  CheckpointManager,
  BuildState,
  createCheckpointManager,
} from "../../agents/build/checkpoint-manager.js";

describe("checkpoint-manager", () => {
  let manager: CheckpointManager;
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-test-"));
    manager = new CheckpointManager({ projectRoot: testDir });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  const createMockState = (
    overrides: Partial<BuildState> = {},
  ): BuildState => ({
    buildId: "test-build-001",
    completedTasks: ["T-001", "T-002"],
    failedTasks: [],
    currentTaskIndex: 2,
    context: { key: "value" },
    startedAt: "2024-01-01T00:00:00.000Z",
    lastUpdatedAt: "2024-01-01T00:01:00.000Z",
    ...overrides,
  });

  describe("constructor", () => {
    it("should create manager with default options", () => {
      const defaultManager = new CheckpointManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getMaxCheckpoints()).toBe(10);
    });

    it("should accept custom project root", () => {
      const customManager = new CheckpointManager({
        projectRoot: "/custom/root",
      });
      expect(customManager.getProjectRoot()).toBe("/custom/root");
    });

    it("should accept custom max checkpoints", () => {
      const customManager = new CheckpointManager({ maxCheckpoints: 5 });
      expect(customManager.getMaxCheckpoints()).toBe(5);
    });
  });

  describe("save", () => {
    it("should save checkpoint", () => {
      const state = createMockState();

      const checkpointId = manager.save("build-001", "T-001", state);

      expect(checkpointId).toBeDefined();
      expect(checkpointId).toMatch(/^cp-/);
    });

    it("should create checkpoint directory if needed", () => {
      const state = createMockState();
      const checkpointDir = path.join(testDir, ".build-checkpoints");

      expect(fs.existsSync(checkpointDir)).toBe(false);

      manager.save("build-001", "T-001", state);

      expect(fs.existsSync(checkpointDir)).toBe(true);
    });

    it("should save multiple checkpoints", () => {
      manager.save(
        "build-001",
        "T-001",
        createMockState({ currentTaskIndex: 1 }),
      );
      manager.save(
        "build-001",
        "T-002",
        createMockState({ currentTaskIndex: 2 }),
      );
      manager.save(
        "build-001",
        "T-003",
        createMockState({ currentTaskIndex: 3 }),
      );

      const count = manager.getCheckpointCount("build-001");

      expect(count).toBe(3);
    });
  });

  describe("load", () => {
    it("should load latest checkpoint", () => {
      manager.save(
        "build-001",
        "T-001",
        createMockState({ currentTaskIndex: 1 }),
      );
      manager.save(
        "build-001",
        "T-002",
        createMockState({ currentTaskIndex: 2 }),
      );

      const state = manager.load("build-001");

      expect(state).not.toBeNull();
      expect(state!.currentTaskIndex).toBe(2);
    });

    it("should return null for non-existent build", () => {
      const state = manager.load("nonexistent");

      expect(state).toBeNull();
    });

    it("should preserve state data", () => {
      const originalState = createMockState({
        completedTasks: ["T-001", "T-002", "T-003"],
        context: { custom: "data", nested: { value: 123 } },
      });

      manager.save("build-001", "T-003", originalState);
      const loadedState = manager.load("build-001");

      expect(loadedState).not.toBeNull();
      expect(loadedState!.completedTasks).toEqual(["T-001", "T-002", "T-003"]);
      expect(loadedState!.context).toEqual({
        custom: "data",
        nested: { value: 123 },
      });
    });
  });

  describe("loadById", () => {
    it("should load specific checkpoint", () => {
      const id1 = manager.save(
        "build-001",
        "T-001",
        createMockState({ currentTaskIndex: 1 }),
      );
      manager.save(
        "build-001",
        "T-002",
        createMockState({ currentTaskIndex: 2 }),
      );

      const state = manager.loadById("build-001", id1);

      expect(state).not.toBeNull();
      expect(state!.currentTaskIndex).toBe(1);
    });

    it("should return null for non-existent checkpoint", () => {
      manager.save("build-001", "T-001", createMockState());

      const state = manager.loadById("build-001", "nonexistent-id");

      expect(state).toBeNull();
    });
  });

  describe("loadCheckpoints", () => {
    it("should load all checkpoints", () => {
      manager.save("build-001", "T-001", createMockState());
      manager.save("build-001", "T-002", createMockState());

      const checkpoints = manager.loadCheckpoints("build-001");

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].taskId).toBe("T-001");
      expect(checkpoints[1].taskId).toBe("T-002");
    });

    it("should return empty array for non-existent build", () => {
      const checkpoints = manager.loadCheckpoints("nonexistent");

      expect(checkpoints).toEqual([]);
    });
  });

  describe("getCheckpointAtTask", () => {
    it("should get checkpoint for specific task", () => {
      manager.save(
        "build-001",
        "T-001",
        createMockState({ currentTaskIndex: 1 }),
      );
      manager.save(
        "build-001",
        "T-002",
        createMockState({ currentTaskIndex: 2 }),
      );

      const state = manager.getCheckpointAtTask("build-001", "T-001");

      expect(state).not.toBeNull();
      expect(state!.currentTaskIndex).toBe(1);
    });

    it("should return null for non-existent task", () => {
      manager.save("build-001", "T-001", createMockState());

      const state = manager.getCheckpointAtTask("build-001", "T-999");

      expect(state).toBeNull();
    });
  });

  describe("listBuilds", () => {
    it("should list all builds with checkpoints", () => {
      manager.save("build-001", "T-001", createMockState());
      manager.save("build-002", "T-001", createMockState());
      manager.save("build-003", "T-001", createMockState());

      const builds = manager.listBuilds();

      expect(builds).toHaveLength(3);
      expect(builds).toContain("build-001");
      expect(builds).toContain("build-002");
      expect(builds).toContain("build-003");
    });

    it("should return empty array if no checkpoints", () => {
      const builds = manager.listBuilds();

      expect(builds).toEqual([]);
    });
  });

  describe("cleanup", () => {
    it("should keep only last N checkpoints", () => {
      for (let i = 1; i <= 10; i++) {
        manager.save(
          "build-001",
          `T-${String(i).padStart(3, "0")}`,
          createMockState({ currentTaskIndex: i }),
        );
      }

      const removed = manager.cleanup("build-001", 3);

      expect(removed).toBe(7);
      expect(manager.getCheckpointCount("build-001")).toBe(3);
    });

    it("should keep latest checkpoints", () => {
      for (let i = 1; i <= 5; i++) {
        manager.save(
          "build-001",
          `T-${String(i).padStart(3, "0")}`,
          createMockState({ currentTaskIndex: i }),
        );
      }

      manager.cleanup("build-001", 2);
      const state = manager.load("build-001");

      expect(state!.currentTaskIndex).toBe(5);
    });

    it("should return 0 if fewer checkpoints than limit", () => {
      manager.save("build-001", "T-001", createMockState());

      const removed = manager.cleanup("build-001", 5);

      expect(removed).toBe(0);
    });
  });

  describe("delete", () => {
    it("should delete all checkpoints for build", () => {
      manager.save("build-001", "T-001", createMockState());
      manager.save("build-001", "T-002", createMockState());

      const deleted = manager.delete("build-001");

      expect(deleted).toBe(true);
      expect(manager.hasCheckpoints("build-001")).toBe(false);
    });

    it("should return false for non-existent build", () => {
      const deleted = manager.delete("nonexistent");

      expect(deleted).toBe(false);
    });
  });

  describe("hasCheckpoints", () => {
    it("should return true if build has checkpoints", () => {
      manager.save("build-001", "T-001", createMockState());

      expect(manager.hasCheckpoints("build-001")).toBe(true);
    });

    it("should return false if build has no checkpoints", () => {
      expect(manager.hasCheckpoints("nonexistent")).toBe(false);
    });
  });

  describe("getCheckpointCount", () => {
    it("should return correct count", () => {
      manager.save("build-001", "T-001", createMockState());
      manager.save("build-001", "T-002", createMockState());
      manager.save("build-001", "T-003", createMockState());

      expect(manager.getCheckpointCount("build-001")).toBe(3);
    });

    it("should return 0 for non-existent build", () => {
      expect(manager.getCheckpointCount("nonexistent")).toBe(0);
    });
  });

  describe("createInitialState", () => {
    it("should create initial state", () => {
      const state = manager.createInitialState("build-001");

      expect(state.buildId).toBe("build-001");
      expect(state.completedTasks).toEqual([]);
      expect(state.failedTasks).toEqual([]);
      expect(state.currentTaskIndex).toBe(0);
      expect(state.context).toEqual({});
    });

    it("should set timestamps", () => {
      const state = manager.createInitialState("build-001");

      expect(state.startedAt).toBeDefined();
      expect(state.lastUpdatedAt).toBeDefined();
    });
  });

  describe("updateStateWithTask", () => {
    it("should update state on task success", () => {
      const state = manager.createInitialState("build-001");
      const updated = manager.updateStateWithTask(state, "T-001", true);

      expect(updated.completedTasks).toContain("T-001");
      expect(updated.failedTasks).not.toContain("T-001");
      expect(updated.currentTaskIndex).toBe(1);
    });

    it("should update state on task failure", () => {
      const state = manager.createInitialState("build-001");
      const updated = manager.updateStateWithTask(state, "T-001", false);

      expect(updated.failedTasks).toContain("T-001");
      expect(updated.completedTasks).not.toContain("T-001");
      expect(updated.currentTaskIndex).toBe(1);
    });

    it("should not mutate original state", () => {
      const state = manager.createInitialState("build-001");
      const originalCompletedTasks = state.completedTasks;

      manager.updateStateWithTask(state, "T-001", true);

      expect(state.completedTasks).toBe(originalCompletedTasks);
      expect(state.completedTasks).toEqual([]);
    });
  });

  describe("setters", () => {
    it("should set project root", () => {
      manager.setProjectRoot("/new/root");
      expect(manager.getProjectRoot()).toBe("/new/root");
    });

    it("should set max checkpoints", () => {
      manager.setMaxCheckpoints(20);
      expect(manager.getMaxCheckpoints()).toBe(20);
    });
  });

  describe("createCheckpointManager", () => {
    it("should create manager instance", () => {
      const instance = createCheckpointManager();
      expect(instance).toBeInstanceOf(CheckpointManager);
    });

    it("should pass options", () => {
      const instance = createCheckpointManager({ maxCheckpoints: 15 });
      expect(instance.getMaxCheckpoints()).toBe(15);
    });
  });
});
