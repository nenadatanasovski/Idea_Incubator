/**
 * Gotcha Injector Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  GotchaInjector,
  Gotcha,
  createGotchaInjector,
  getHardcodedGotchas,
} from "../../agents/specification/gotcha-injector.js";
import { AtomicTask } from "../../agents/specification/task-generator.js";

describe("gotcha-injector", () => {
  let injector: GotchaInjector;

  const createMockTask = (overrides: Partial<AtomicTask> = {}): AtomicTask => ({
    id: "T-001",
    phase: "database",
    action: "CREATE",
    file: "database/migrations/001_test.sql",
    status: "pending",
    requirements: ["Create table"],
    gotchas: [],
    validation: {
      command: "echo ok",
      expected: "ok",
    },
    dependsOn: [],
    ...overrides,
  });

  beforeEach(() => {
    injector = new GotchaInjector();
  });

  describe("constructor", () => {
    it("should create injector with default options", () => {
      const defaultInjector = new GotchaInjector();
      expect(defaultInjector).toBeDefined();
    });

    it("should accept custom options", () => {
      const customInjector = new GotchaInjector({
        maxGotchasPerTask: 3,
        includeComments: false,
      });
      expect(customInjector).toBeDefined();
    });
  });

  describe("getGotchaCount", () => {
    it("should have at least 20 gotchas", () => {
      expect(injector.getGotchaCount()).toBeGreaterThanOrEqual(20);
    });
  });

  describe("getGotchas", () => {
    it("should return all gotchas", () => {
      const gotchas = injector.getGotchas();
      expect(gotchas).toBeDefined();
      expect(Array.isArray(gotchas)).toBe(true);
      expect(gotchas.length).toBeGreaterThanOrEqual(20);
    });

    it("should return gotchas with required fields", () => {
      const gotchas = injector.getGotchas();

      for (const gotcha of gotchas) {
        expect(gotcha.id).toBeDefined();
        expect(gotcha.content).toBeDefined();
        expect(gotcha.filePattern).toBeDefined();
        expect(gotcha.actionType).toBeDefined();
        expect(gotcha.severity).toBeDefined();
        expect(gotcha.category).toBeDefined();
      }
    });
  });

  describe("getCategories", () => {
    it("should return unique categories", () => {
      const categories = injector.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain("sql");
      expect(categories).toContain("api");
      expect(categories).toContain("types");
    });
  });

  describe("getGotchasByCategory", () => {
    it("should filter by category", () => {
      const sqlGotchas = injector.getGotchasByCategory("sql");
      expect(sqlGotchas.length).toBeGreaterThan(0);

      for (const gotcha of sqlGotchas) {
        expect(gotcha.category).toBe("sql");
      }
    });
  });

  describe("inject", () => {
    it("should inject gotchas into tasks", () => {
      const task = createMockTask();
      const [injectedTask] = injector.inject([task]);

      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should inject SQL gotchas for SQL files", () => {
      const task = createMockTask({
        file: "database/migrations/001_test.sql",
        action: "CREATE",
      });
      const [injectedTask] = injector.inject([task]);

      // Should have SQL-related gotchas
      const hasParamGotcha = injectedTask.gotchas.some(
        (g) =>
          g.toLowerCase().includes("parameterized") ||
          g.toLowerCase().includes("sql"),
      );
      expect(hasParamGotcha).toBe(true);
    });

    it("should inject API gotchas for route files", () => {
      const task = createMockTask({
        phase: "api",
        file: "server/routes/test.ts",
        action: "CREATE",
      });
      const [injectedTask] = injector.inject([task]);

      // Should have API-related gotchas
      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should inject type gotchas for type files", () => {
      const task = createMockTask({
        phase: "types",
        file: "types/test.ts",
        action: "CREATE",
      });
      const [injectedTask] = injector.inject([task]);

      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should inject test gotchas for test files", () => {
      const task = createMockTask({
        phase: "tests",
        file: "tests/test.ts",
        action: "CREATE",
      });
      const [injectedTask] = injector.inject([task]);

      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should limit gotchas per task", () => {
      const customInjector = new GotchaInjector({ maxGotchasPerTask: 2 });
      const task = createMockTask();
      const [injectedTask] = customInjector.inject([task]);

      expect(injectedTask.gotchas.length).toBeLessThanOrEqual(2);
    });

    it("should not duplicate existing gotchas", () => {
      const task = createMockTask({
        gotchas: ["Always use parameterized queries to prevent SQL injection"],
      });
      const [injectedTask] = injector.inject([task]);

      const paramCount = injectedTask.gotchas.filter((g) =>
        g.includes("parameterized queries"),
      ).length;
      expect(paramCount).toBe(1);
    });

    it("should preserve task properties", () => {
      const task = createMockTask({
        id: "T-999",
        requirements: ["Custom requirement"],
      });
      const [injectedTask] = injector.inject([task]);

      expect(injectedTask.id).toBe("T-999");
      expect(injectedTask.requirements).toContain("Custom requirement");
    });

    it("should process multiple tasks", () => {
      const tasks = [
        createMockTask({ id: "T-001", file: "database/migrations/001.sql" }),
        createMockTask({
          id: "T-002",
          file: "server/routes/api.ts",
          phase: "api",
        }),
        createMockTask({ id: "T-003", file: "tests/test.ts", phase: "tests" }),
      ];

      const injectedTasks = injector.inject(tasks);

      expect(injectedTasks).toHaveLength(3);
      expect(injectedTasks[0].id).toBe("T-001");
      expect(injectedTasks[1].id).toBe("T-002");
      expect(injectedTasks[2].id).toBe("T-003");
    });
  });

  describe("action type matching", () => {
    it("should match CREATE gotchas to CREATE tasks", () => {
      const task = createMockTask({
        action: "CREATE",
        file: "database/migrations/001.sql",
      });
      const [injectedTask] = injector.inject([task]);

      // Should include CREATE-specific gotchas
      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should match UPDATE gotchas to UPDATE tasks", () => {
      const task = createMockTask({
        action: "UPDATE",
        file: "database/db.ts",
      });
      const [injectedTask] = injector.inject([task]);

      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should match BOTH gotchas to any action", () => {
      const createTask = createMockTask({
        action: "CREATE",
        file: "database/db.ts",
      });
      const updateTask = createMockTask({
        action: "UPDATE",
        file: "database/db.ts",
      });

      const [injectedCreate] = injector.inject([createTask]);
      const [injectedUpdate] = injector.inject([updateTask]);

      // Both should have some common gotchas (the BOTH ones)
      expect(injectedCreate.gotchas.length).toBeGreaterThan(0);
      expect(injectedUpdate.gotchas.length).toBeGreaterThan(0);
    });
  });

  describe("code template comments", () => {
    it("should add gotcha comments to code template when enabled", () => {
      const task = createMockTask({
        file: "database/migrations/001.sql",
        codeTemplate: "CREATE TABLE test (id TEXT);",
      });
      const [injectedTask] = injector.inject([task]);

      // Should have GOTCHA comment for critical gotchas
      expect(injectedTask.codeTemplate).toContain("GOTCHA");
    });

    it("should not add comments when disabled", () => {
      const noCommentInjector = new GotchaInjector({ includeComments: false });
      const task = createMockTask({
        file: "database/migrations/001.sql",
        codeTemplate: "CREATE TABLE test (id TEXT);",
      });
      const [injectedTask] = noCommentInjector.inject([task]);

      // Should not have GOTCHA comment
      expect(injectedTask.codeTemplate).not.toContain("GOTCHA");
    });

    it("should use correct comment style for SQL files", () => {
      const task = createMockTask({
        file: "database/migrations/001.sql",
        codeTemplate: "CREATE TABLE test (id TEXT);",
      });
      const [injectedTask] = injector.inject([task]);

      // SQL comments use --
      if (injectedTask.codeTemplate?.includes("GOTCHA")) {
        expect(injectedTask.codeTemplate).toContain("--");
      }
    });

    it("should use correct comment style for TypeScript files", () => {
      const task = createMockTask({
        file: "server/routes/api.ts",
        phase: "api",
        codeTemplate: "const router = express.Router();",
      });
      const [injectedTask] = injector.inject([task]);

      // TS comments use //
      if (injectedTask.codeTemplate?.includes("GOTCHA")) {
        expect(injectedTask.codeTemplate).toContain("//");
      }
    });
  });

  describe("pattern matching", () => {
    it("should match exact patterns", () => {
      const gotchas = injector.getGotchasForPattern("database/db.ts");
      expect(gotchas.length).toBeGreaterThan(0);
    });

    it("should match glob patterns", () => {
      const task = createMockTask({ file: "server/routes/users.ts" });
      const [injectedTask] = injector.inject([task]);
      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });

    it("should match wildcard patterns", () => {
      const task = createMockTask({ file: "some/deep/path/file.ts" });
      const [injectedTask] = injector.inject([task]);
      // Should match *.ts pattern gotchas
      expect(injectedTask.gotchas.length).toBeGreaterThan(0);
    });
  });

  describe("severity prioritization", () => {
    it("should prioritize critical gotchas", () => {
      const task = createMockTask({
        file: "database/migrations/001.sql",
      });
      const [injectedTask] = injector.inject([task]);

      // First gotchas should be critical ones
      const sqlCritical = injectedTask.gotchas.find((g) =>
        g.toLowerCase().includes("parameterized"),
      );
      expect(sqlCritical).toBeDefined();
    });
  });

  describe("addGotcha", () => {
    it("should allow adding custom gotchas", () => {
      const initialCount = injector.getGotchaCount();

      injector.addGotcha({
        id: "CUSTOM-001",
        content: "Custom gotcha for testing",
        filePattern: "custom/*.ts",
        actionType: "CREATE",
        severity: "warning",
        category: "custom",
      });

      expect(injector.getGotchaCount()).toBe(initialCount + 1);
    });
  });

  describe("createGotchaInjector", () => {
    it("should create injector instance", () => {
      const instance = createGotchaInjector();
      expect(instance).toBeInstanceOf(GotchaInjector);
    });

    it("should pass options to constructor", () => {
      const instance = createGotchaInjector({ maxGotchasPerTask: 2 });
      const task = createMockTask();
      const [injectedTask] = instance.inject([task]);
      expect(injectedTask.gotchas.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getHardcodedGotchas", () => {
    it("should return array of gotchas", () => {
      const gotchas = getHardcodedGotchas();
      expect(Array.isArray(gotchas)).toBe(true);
      expect(gotchas.length).toBeGreaterThanOrEqual(20);
    });

    it("should return a copy, not original", () => {
      const gotchas1 = getHardcodedGotchas();
      const gotchas2 = getHardcodedGotchas();
      expect(gotchas1).not.toBe(gotchas2);
    });
  });
});
