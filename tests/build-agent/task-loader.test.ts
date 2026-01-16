/**
 * Task Loader Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  TaskLoader,
  createTaskLoader,
} from "../../agents/build/task-loader.js";
import { LoadedTask } from "../../types/task-loader.js";

describe("TaskLoader", () => {
  let tempDir: string;
  let loader: TaskLoader;

  beforeEach(() => {
    // Create temp directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "task-loader-test-"));
    loader = new TaskLoader({ projectRoot: tempDir });
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // Helper to create a test tasks file
  function createTasksFile(content: string, filename = "tasks.md"): string {
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  // Sample valid tasks content
  const validTasksContent = `---
id: test-spec
complexity: simple
total_tasks: 3
phases:
  database: 1
  types: 1
  api: 1
---

# Test Tasks

## Tasks

### T-001: database - CREATE schema

\`\`\`yaml
id: T-001
phase: database
action: CREATE
file: "database/schema.sql"
status: pending
requirements:
  - "Create tables"
gotchas:
  - "Use TEXT for dates"
validation:
  command: "sqlite3 :memory: < schema.sql"
  expected: "exit code 0"
depends_on: []
\`\`\`

### T-002: types - CREATE types

\`\`\`yaml
id: T-002
phase: types
action: CREATE
file: "types/index.ts"
status: pending
requirements:
  - "Define interfaces"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
\`\`\`

### T-003: api - CREATE routes

\`\`\`yaml
id: T-003
phase: api
action: UPDATE
file: "server/routes.ts"
status: pending
requirements:
  - "Add API routes"
code_template: |
  import { Router } from 'express';
  const router = Router();
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on:
  - T-001
  - T-002
\`\`\`
`;

  describe("constructor", () => {
    it("should use current directory as default project root", () => {
      const defaultLoader = new TaskLoader();
      expect(defaultLoader.getProjectRoot()).toBe(process.cwd());
    });

    it("should use provided project root", () => {
      const customLoader = new TaskLoader({ projectRoot: "/custom/path" });
      expect(customLoader.getProjectRoot()).toBe("/custom/path");
    });
  });

  describe("load", () => {
    it("should successfully load a valid tasks file", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);

      expect(result.success).toBe(true);
      expect(result.file).toBeDefined();
      expect(result.file!.frontmatter.id).toBe("test-spec");
      expect(result.file!.tasks).toHaveLength(3);
    });

    it("should return error for non-existent file", () => {
      const result = loader.load("/non/existent/path.md");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read tasks file");
    });

    it("should return error for file without frontmatter", () => {
      const content = "# No Frontmatter\n\nJust content";
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to parse frontmatter");
    });

    it("should return error for file without tasks", () => {
      const content = `---
id: empty-spec
complexity: simple
total_tasks: 0
phases: {}
---

# Empty Tasks

No task blocks here.
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No tasks found in file");
    });

    it("should return error for invalid dependencies", () => {
      const content = `---
id: invalid-deps
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
status: pending
depends_on:
  - T-999
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid dependency");
    });

    it("should detect circular dependencies", () => {
      const content = `---
id: circular-deps
complexity: simple
total_tasks: 2
phases:
  test: 2
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "a.ts"
status: pending
depends_on:
  - T-002
\`\`\`

\`\`\`yaml
id: T-002
phase: test
action: CREATE
file: "b.ts"
status: pending
depends_on:
  - T-001
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Circular dependency");
    });
  });

  describe("frontmatter parsing", () => {
    it("should parse all frontmatter fields", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);

      expect(result.file!.frontmatter).toEqual({
        id: "test-spec",
        complexity: "simple",
        totalTasks: 3,
        phases: {
          database: 1,
          types: 1,
          api: 1,
        },
      });
    });

    it("should use defaults for missing frontmatter fields", () => {
      const content = `---
id: minimal
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.file!.frontmatter.complexity).toBe("unknown");
      expect(result.file!.frontmatter.totalTasks).toBe(0);
      expect(result.file!.frontmatter.phases).toEqual({});
    });
  });

  describe("task extraction", () => {
    it("should extract all task YAML blocks", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);

      expect(result.file!.tasks).toHaveLength(3);
      expect(result.file!.tasks[0].id).toBe("T-001");
      expect(result.file!.tasks[1].id).toBe("T-002");
      expect(result.file!.tasks[2].id).toBe("T-003");
    });

    it("should skip non-task YAML blocks", () => {
      const content = `---
id: mixed-yaml
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
# This is not a task
name: config
value: 123
\`\`\`

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
\`\`\`

\`\`\`yaml
# Another non-task block
type: metadata
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.file!.tasks).toHaveLength(1);
      expect(result.file!.tasks[0].id).toBe("T-001");
    });

    it("should skip invalid YAML blocks", () => {
      const content = `---
id: invalid-yaml
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
\`\`\`

\`\`\`yaml
this is: [invalid yaml
  missing: closing bracket
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.file!.tasks).toHaveLength(1);
    });
  });

  describe("task normalization", () => {
    it("should normalize action to uppercase", () => {
      const content = `---
id: action-test
complexity: simple
total_tasks: 3
phases:
  test: 3
---

\`\`\`yaml
id: T-001
phase: test
action: create
file: "a.ts"
\`\`\`

\`\`\`yaml
id: T-002
phase: test
action: Update
file: "b.ts"
\`\`\`

\`\`\`yaml
id: T-003
phase: test
action: DELETE
file: "c.ts"
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.file!.tasks[0].action).toBe("CREATE");
      expect(result.file!.tasks[1].action).toBe("UPDATE");
      expect(result.file!.tasks[2].action).toBe("DELETE");
    });

    it("should default invalid action to CREATE", () => {
      const content = `---
id: invalid-action
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: INVALID
file: "test.ts"
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.file!.tasks[0].action).toBe("CREATE");
    });

    it("should handle missing optional fields", () => {
      const content = `---
id: minimal-task
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      const task = result.file!.tasks[0];
      expect(task.status).toBe("pending");
      expect(task.requirements).toEqual([]);
      expect(task.gotchas).toEqual([]);
      expect(task.validation).toEqual({ command: "", expected: "" });
      expect(task.codeTemplate).toBeUndefined();
      expect(task.dependsOn).toEqual([]);
    });

    it("should preserve code_template", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);

      const task = result.file!.tasks[2]; // T-003 has code_template
      expect(task.codeTemplate).toContain("import { Router } from 'express'");
    });
  });

  describe("orderByDependency", () => {
    it("should order tasks so dependencies come first", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);
      const ordered = loader.orderByDependency(result.file!.tasks);

      // T-001 has no deps, should come first
      // T-002 depends on T-001
      // T-003 depends on T-001 and T-002
      expect(ordered[0].id).toBe("T-001");
      expect(ordered[1].id).toBe("T-002");
      expect(ordered[2].id).toBe("T-003");
    });

    it("should handle tasks with no dependencies", () => {
      const tasks: LoadedTask[] = [
        {
          id: "T-003",
          phase: "test",
          action: "CREATE",
          file: "c.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-001",
          phase: "test",
          action: "CREATE",
          file: "a.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-002",
          phase: "test",
          action: "CREATE",
          file: "b.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      const ordered = loader.orderByDependency(tasks);
      expect(ordered).toHaveLength(3);
    });

    it("should handle complex dependency chains", () => {
      const tasks: LoadedTask[] = [
        {
          id: "T-004",
          phase: "test",
          action: "CREATE",
          file: "d.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: ["T-002", "T-003"],
        },
        {
          id: "T-001",
          phase: "test",
          action: "CREATE",
          file: "a.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-003",
          phase: "test",
          action: "CREATE",
          file: "c.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: ["T-001"],
        },
        {
          id: "T-002",
          phase: "test",
          action: "CREATE",
          file: "b.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: ["T-001"],
        },
      ];

      const ordered = loader.orderByDependency(tasks);

      // T-001 must come before T-002, T-003
      // T-002 and T-003 must come before T-004
      const indexOf = (id: string) => ordered.findIndex((t) => t.id === id);

      expect(indexOf("T-001")).toBeLessThan(indexOf("T-002"));
      expect(indexOf("T-001")).toBeLessThan(indexOf("T-003"));
      expect(indexOf("T-002")).toBeLessThan(indexOf("T-004"));
      expect(indexOf("T-003")).toBeLessThan(indexOf("T-004"));
    });
  });

  describe("getTasksByPhase", () => {
    it("should group tasks by phase", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);
      const byPhase = loader.getTasksByPhase(result.file!.tasks);

      expect(byPhase.get("database")).toHaveLength(1);
      expect(byPhase.get("types")).toHaveLength(1);
      expect(byPhase.get("api")).toHaveLength(1);
    });

    it("should handle multiple tasks in same phase", () => {
      const tasks: LoadedTask[] = [
        {
          id: "T-001",
          phase: "database",
          action: "CREATE",
          file: "a.sql",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-002",
          phase: "database",
          action: "CREATE",
          file: "b.sql",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-003",
          phase: "types",
          action: "CREATE",
          file: "c.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      const byPhase = loader.getTasksByPhase(tasks);
      expect(byPhase.get("database")).toHaveLength(2);
      expect(byPhase.get("types")).toHaveLength(1);
    });
  });

  describe("getTasksByStatus", () => {
    it("should filter tasks by status", () => {
      const tasks: LoadedTask[] = [
        {
          id: "T-001",
          phase: "test",
          action: "CREATE",
          file: "a.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-002",
          phase: "test",
          action: "CREATE",
          file: "b.ts",
          status: "completed",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-003",
          phase: "test",
          action: "CREATE",
          file: "c.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      const pending = loader.getTasksByStatus(tasks, "pending");
      const completed = loader.getTasksByStatus(tasks, "completed");

      expect(pending).toHaveLength(2);
      expect(completed).toHaveLength(1);
    });
  });

  describe("getPendingTasks", () => {
    it("should return only pending tasks", () => {
      const tasks: LoadedTask[] = [
        {
          id: "T-001",
          phase: "test",
          action: "CREATE",
          file: "a.ts",
          status: "pending",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-002",
          phase: "test",
          action: "CREATE",
          file: "b.ts",
          status: "completed",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
        {
          id: "T-003",
          phase: "test",
          action: "CREATE",
          file: "c.ts",
          status: "failed",
          requirements: [],
          gotchas: [],
          validation: { command: "", expected: "" },
          dependsOn: [],
        },
      ];

      const pending = loader.getPendingTasks(tasks);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe("T-001");
    });
  });

  describe("getTaskDependencies", () => {
    it("should calculate dependency depth", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);
      const deps = loader.getTaskDependencies(result.file!.tasks);

      const findDep = (id: string) => deps.find((d) => d.taskId === id)!;

      expect(findDep("T-001").depth).toBe(0); // No dependencies
      expect(findDep("T-002").depth).toBe(1); // Depends on T-001
      expect(findDep("T-003").depth).toBe(2); // Depends on T-001 and T-002
    });

    it("should return correct dependsOn arrays", () => {
      const filePath = createTasksFile(validTasksContent);
      const result = loader.load(filePath);
      const deps = loader.getTaskDependencies(result.file!.tasks);

      const findDep = (id: string) => deps.find((d) => d.taskId === id)!;

      expect(findDep("T-001").dependsOn).toEqual([]);
      expect(findDep("T-002").dependsOn).toEqual(["T-001"]);
      expect(findDep("T-003").dependsOn).toContain("T-001");
      expect(findDep("T-003").dependsOn).toContain("T-002");
    });
  });

  describe("setProjectRoot / getProjectRoot", () => {
    it("should update project root", () => {
      loader.setProjectRoot("/new/path");
      expect(loader.getProjectRoot()).toBe("/new/path");
    });
  });

  describe("createTaskLoader", () => {
    it("should create a TaskLoader instance", () => {
      const instance = createTaskLoader();
      expect(instance).toBeInstanceOf(TaskLoader);
    });

    it("should pass options to constructor", () => {
      const instance = createTaskLoader({ projectRoot: "/custom" });
      expect(instance.getProjectRoot()).toBe("/custom");
    });
  });

  describe("validation edge cases", () => {
    it("should reject task without id", () => {
      const content = `---
id: no-task-id
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
phase: test
action: CREATE
file: "test.ts"
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      // Task without id starting with T- should be skipped
      expect(result.success).toBe(false);
      expect(result.error).toBe("No tasks found in file");
    });

    it("should reject task without file", () => {
      const content = `---
id: no-file
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing required field: file");
    });

    it("should handle self-referencing dependency as circular", () => {
      const content = `---
id: self-ref
complexity: simple
total_tasks: 1
phases:
  test: 1
---

\`\`\`yaml
id: T-001
phase: test
action: CREATE
file: "test.ts"
depends_on:
  - T-001
\`\`\`
`;
      const filePath = createTasksFile(content);
      const result = loader.load(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Circular dependency");
    });
  });
});
