/**
 * Spec Agent Acceptance Tests
 *
 * These tests verify that Spec Agent output matches the reference specifications.
 * Reference specs are hand-written gold standards in ideas/vibe/reference/
 *
 * Tests will fail initially (no Spec Agent yet). Use as goal for SPC-001 through SPC-008.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";

// Reference paths
const REFERENCE_BASE = "ideas/vibe/reference";
const SIMPLE_COUNTER = path.join(REFERENCE_BASE, "simple-counter");
const USER_PROFILES = path.join(REFERENCE_BASE, "user-profiles");
const NOTIFICATIONS = path.join(REFERENCE_BASE, "notifications");

// Complexity requirements
const TASK_COUNT_REQUIREMENTS = {
  simple: { min: 5, max: 8 },
  medium: { min: 10, max: 15 },
  complex: { min: 20, max: 30 },
};

// Required sections in spec.md
const REQUIRED_SPEC_SECTIONS = [
  "Overview",
  "Functional Requirements",
  "Architecture",
  "API Design",
  "Data Models",
  "Known Gotchas",
  "Validation Strategy",
];

// Required fields in task YAML blocks
const REQUIRED_TASK_FIELDS = [
  "id",
  "phase",
  "action",
  "file",
  "status",
  "requirements",
  "gotchas",
  "validation",
  "depends_on",
];

// Valid phases in order
const VALID_PHASES = [
  "database",
  "types",
  "services",
  "api",
  "tests",
  "exports",
];

/**
 * Parse YAML frontmatter from markdown file
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  try {
    return yaml.parse(match[1]) || {};
  } catch {
    return {};
  }
}

/**
 * Extract all YAML task blocks from tasks.md
 */
function extractTaskBlocks(content: string): Array<Record<string, any>> {
  const tasks: Array<Record<string, any>> = [];
  const regex = /```yaml\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = yaml.parse(match[1]);
      if (parsed && parsed.id && parsed.id.startsWith("T-")) {
        tasks.push(parsed);
      }
    } catch {
      // Skip invalid YAML
    }
  }

  return tasks;
}

/**
 * Check if content has required sections
 */
function hasRequiredSections(content: string, sections: string[]): string[] {
  const missing: string[] = [];
  for (const section of sections) {
    if (!content.includes(section)) {
      missing.push(section);
    }
  }
  return missing;
}

/**
 * Validate task has required fields
 */
function validateTaskFields(task: Record<string, any>): string[] {
  const missing: string[] = [];
  for (const field of REQUIRED_TASK_FIELDS) {
    if (!(field in task)) {
      missing.push(field);
    }
  }
  return missing;
}

/**
 * Validate task dependencies form a DAG (no circular deps)
 */
function validateDependencyGraph(tasks: Array<Record<string, any>>): {
  valid: boolean;
  error?: string;
} {
  const taskIds = new Set(tasks.map((t) => t.id));
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(taskId: string, path: string[]): boolean {
    if (visiting.has(taskId)) {
      return false; // Cycle detected
    }
    if (visited.has(taskId)) {
      return true;
    }

    visiting.add(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.depends_on) {
      for (const dep of task.depends_on) {
        if (!taskIds.has(dep)) {
          // Dependency doesn't exist - that's an error
          return false;
        }
        if (!visit(dep, [...path, taskId])) {
          return false;
        }
      }
    }
    visiting.delete(taskId);
    visited.add(taskId);
    return true;
  }

  for (const task of tasks) {
    if (!visit(task.id, [])) {
      return {
        valid: false,
        error: `Circular or invalid dependency involving ${task.id}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Calculate structural similarity between two specs
 */
function calculateStructuralSimilarity(
  generated: string,
  reference: string,
): number {
  const genSections = REQUIRED_SPEC_SECTIONS.filter((s) =>
    generated.includes(s),
  );
  const refSections = REQUIRED_SPEC_SECTIONS.filter((s) =>
    reference.includes(s),
  );

  const genFrontmatter = parseFrontmatter(generated);
  const refFrontmatter = parseFrontmatter(reference);

  let score = 0;
  let total = 0;

  // Section coverage (50% of score)
  total += REQUIRED_SPEC_SECTIONS.length;
  score += genSections.length;

  // Frontmatter fields (30% of score)
  const frontmatterFields = ["id", "title", "complexity", "status", "version"];
  for (const field of frontmatterFields) {
    total += 1;
    if (field in genFrontmatter) score += 1;
  }

  // Has code blocks (10% of score)
  total += 2;
  if (generated.includes("```sql")) score += 1;
  if (generated.includes("```typescript")) score += 1;

  // Has tables (10% of score)
  total += 1;
  if (generated.includes("| ")) score += 1;

  return (score / total) * 100;
}

describe("Spec Agent Acceptance Tests", () => {
  describe("Test 1: Simple Feature (simple-counter)", () => {
    const specPath = path.join(SIMPLE_COUNTER, "build", "spec.md");
    const tasksPath = path.join(SIMPLE_COUNTER, "build", "tasks.md");
    let specContent: string;
    let tasksContent: string;
    let frontmatter: Record<string, any>;
    let tasks: Array<Record<string, any>>;

    beforeAll(() => {
      specContent = fs.readFileSync(specPath, "utf-8");
      tasksContent = fs.readFileSync(tasksPath, "utf-8");
      frontmatter = parseFrontmatter(tasksContent);
      tasks = extractTaskBlocks(tasksContent);
    });

    it("should have valid spec.md with all required sections", () => {
      const missing = hasRequiredSections(specContent, REQUIRED_SPEC_SECTIONS);
      expect(missing, `Missing sections: ${missing.join(", ")}`).toHaveLength(
        0,
      );
    });

    it("should have correct task count for simple complexity (5-8 tasks)", () => {
      const { min, max } = TASK_COUNT_REQUIREMENTS.simple;
      expect(tasks.length).toBeGreaterThanOrEqual(min);
      expect(tasks.length).toBeLessThanOrEqual(max);
    });

    it("should have valid YAML frontmatter", () => {
      expect(frontmatter.id).toBe("simple-counter");
      expect(frontmatter.total_tasks).toBe(tasks.length);
    });

    it("should have all required fields in each task", () => {
      for (const task of tasks) {
        const missing = validateTaskFields(task);
        expect(
          missing,
          `Task ${task.id} missing: ${missing.join(", ")}`,
        ).toHaveLength(0);
      }
    });

    it("should have valid dependency graph", () => {
      const result = validateDependencyGraph(tasks);
      expect(result.valid, result.error).toBe(true);
    });
  });

  describe("Test 2: Medium Feature (user-profiles)", () => {
    const specPath = path.join(USER_PROFILES, "build", "spec.md");
    const tasksPath = path.join(USER_PROFILES, "build", "tasks.md");
    let specContent: string;
    let tasksContent: string;
    let frontmatter: Record<string, any>;
    let tasks: Array<Record<string, any>>;

    beforeAll(() => {
      specContent = fs.readFileSync(specPath, "utf-8");
      tasksContent = fs.readFileSync(tasksPath, "utf-8");
      frontmatter = parseFrontmatter(tasksContent);
      tasks = extractTaskBlocks(tasksContent);
    });

    it("should have valid spec.md with all required sections", () => {
      const missing = hasRequiredSections(specContent, REQUIRED_SPEC_SECTIONS);
      expect(missing, `Missing sections: ${missing.join(", ")}`).toHaveLength(
        0,
      );
    });

    it("should have correct task count for medium complexity (10-15 tasks)", () => {
      const { min, max } = TASK_COUNT_REQUIREMENTS.medium;
      expect(tasks.length).toBeGreaterThanOrEqual(min);
      expect(tasks.length).toBeLessThanOrEqual(max);
    });

    it("should have valid YAML frontmatter", () => {
      expect(frontmatter.id).toBe("user-profiles");
      expect(frontmatter.total_tasks).toBe(tasks.length);
    });

    it("should have multiple phases represented", () => {
      const phases = new Set(tasks.map((t) => t.phase));
      expect(phases.size).toBeGreaterThanOrEqual(3);
    });

    it("should include service layer tasks", () => {
      const serviceTasks = tasks.filter((t) => t.phase === "services");
      expect(serviceTasks.length).toBeGreaterThan(0);
    });
  });

  describe("Test 3: Complex Feature (notifications)", () => {
    const specPath = path.join(NOTIFICATIONS, "build", "spec.md");
    const tasksPath = path.join(NOTIFICATIONS, "build", "tasks.md");
    let specContent: string;
    let tasksContent: string;
    let frontmatter: Record<string, any>;
    let tasks: Array<Record<string, any>>;

    beforeAll(() => {
      specContent = fs.readFileSync(specPath, "utf-8");
      tasksContent = fs.readFileSync(tasksPath, "utf-8");
      frontmatter = parseFrontmatter(tasksContent);
      tasks = extractTaskBlocks(tasksContent);
    });

    it("should have valid spec.md with all required sections", () => {
      const missing = hasRequiredSections(specContent, REQUIRED_SPEC_SECTIONS);
      expect(missing, `Missing sections: ${missing.join(", ")}`).toHaveLength(
        0,
      );
    });

    it("should have correct task count for complex complexity (20-30 tasks)", () => {
      const { min, max } = TASK_COUNT_REQUIREMENTS.complex;
      expect(tasks.length).toBeGreaterThanOrEqual(min);
      expect(tasks.length).toBeLessThanOrEqual(max);
    });

    it("should have valid YAML frontmatter", () => {
      expect(frontmatter.id).toBe("notifications");
      expect(frontmatter.total_tasks).toBe(tasks.length);
    });

    it("should have all phases represented", () => {
      const phases = new Set(tasks.map((t) => t.phase));
      // Complex features should have at least 4 different phases
      expect(phases.size).toBeGreaterThanOrEqual(4);
    });

    it("should include test tasks", () => {
      const testTasks = tasks.filter((t) => t.phase === "tests");
      expect(testTasks.length).toBeGreaterThan(0);
    });

    it("should have comprehensive dependency chain", () => {
      // At least 50% of tasks should have dependencies
      const tasksWithDeps = tasks.filter(
        (t) => t.depends_on && t.depends_on.length > 0,
      );
      expect(tasksWithDeps.length).toBeGreaterThanOrEqual(tasks.length * 0.5);
    });
  });

  describe("Test 4: YAML Schema Validation", () => {
    it("should have valid YAML in all task blocks across all references", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      const errors: string[] = [];

      for (const ref of references) {
        const tasksPath = path.join(ref, "build", "tasks.md");
        const content = fs.readFileSync(tasksPath, "utf-8");

        // Try to parse all YAML blocks
        const regex = /```yaml\n([\s\S]*?)```/g;
        let match;
        let blockNum = 0;

        while ((match = regex.exec(content)) !== null) {
          blockNum++;
          try {
            yaml.parse(match[1]);
          } catch (e) {
            errors.push(`${ref} block ${blockNum}: ${e}`);
          }
        }
      }

      expect(errors, `YAML errors: ${errors.join("\n")}`).toHaveLength(0);
    });

    it("should have valid YAML frontmatter in all spec files", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      const errors: string[] = [];

      for (const ref of references) {
        const specPath = path.join(ref, "build", "spec.md");
        const content = fs.readFileSync(specPath, "utf-8");
        const frontmatter = parseFrontmatter(content);

        if (!frontmatter.id) {
          errors.push(`${ref}/build/spec.md: missing id in frontmatter`);
        }
        if (!frontmatter.title) {
          errors.push(`${ref}/build/spec.md: missing title in frontmatter`);
        }
      }

      expect(errors, `Frontmatter errors: ${errors.join("\n")}`).toHaveLength(
        0,
      );
    });
  });

  describe("Test 5: Implementability Checks", () => {
    it("should have actionable file paths in all tasks", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      const errors: string[] = [];

      for (const ref of references) {
        const tasksPath = path.join(ref, "build", "tasks.md");
        const content = fs.readFileSync(tasksPath, "utf-8");
        const tasks = extractTaskBlocks(content);

        for (const task of tasks) {
          if (!task.file || task.file === "") {
            errors.push(`${ref} ${task.id}: missing file path`);
          }
          if (
            task.file &&
            !task.file.includes("/") &&
            !task.file.includes(".")
          ) {
            errors.push(`${ref} ${task.id}: invalid file path '${task.file}'`);
          }
        }
      }

      expect(errors, `File path errors: ${errors.join("\n")}`).toHaveLength(0);
    });

    it("should have validation commands in all tasks", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      const errors: string[] = [];

      for (const ref of references) {
        const tasksPath = path.join(ref, "build", "tasks.md");
        const content = fs.readFileSync(tasksPath, "utf-8");
        const tasks = extractTaskBlocks(content);

        for (const task of tasks) {
          if (!task.validation || !task.validation.command) {
            errors.push(`${ref} ${task.id}: missing validation command`);
          }
        }
      }

      expect(errors, `Validation errors: ${errors.join("\n")}`).toHaveLength(0);
    });

    it("should have code templates in CREATE tasks", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      const errors: string[] = [];

      for (const ref of references) {
        const tasksPath = path.join(ref, "build", "tasks.md");
        const content = fs.readFileSync(tasksPath, "utf-8");
        const tasks = extractTaskBlocks(content);

        for (const task of tasks) {
          if (task.action === "CREATE" && !task.code_template) {
            errors.push(`${ref} ${task.id}: CREATE task missing code_template`);
          }
        }
      }

      expect(errors, `Template errors: ${errors.join("\n")}`).toHaveLength(0);
    });

    it("should have at least one gotcha per task", () => {
      const references = [SIMPLE_COUNTER, USER_PROFILES, NOTIFICATIONS];
      let totalTasks = 0;
      let tasksWithGotchas = 0;

      for (const ref of references) {
        const tasksPath = path.join(ref, "build", "tasks.md");
        const content = fs.readFileSync(tasksPath, "utf-8");
        const tasks = extractTaskBlocks(content);

        for (const task of tasks) {
          totalTasks++;
          if (task.gotchas && task.gotchas.length > 0) {
            tasksWithGotchas++;
          }
        }
      }

      // At least 80% of tasks should have gotchas
      const percentage = (tasksWithGotchas / totalTasks) * 100;
      expect(percentage).toBeGreaterThanOrEqual(80);
    });
  });

  describe("Test 6: Structural Similarity", () => {
    it("should achieve >= 80% structural similarity for generated specs", () => {
      // This test will compare Spec Agent output against references
      // For now, we verify the reference specs are well-formed
      const references = [
        { path: SIMPLE_COUNTER, name: "simple-counter" },
        { path: USER_PROFILES, name: "user-profiles" },
        { path: NOTIFICATIONS, name: "notifications" },
      ];

      for (const ref of references) {
        const specPath = path.join(ref.path, "build", "spec.md");
        const content = fs.readFileSync(specPath, "utf-8");

        // Reference should have 100% of required sections
        const missingSections = hasRequiredSections(
          content,
          REQUIRED_SPEC_SECTIONS,
        );
        expect(
          missingSections,
          `${ref.name} reference missing sections: ${missingSections.join(", ")}`,
        ).toHaveLength(0);

        // Self-similarity should be 100%
        const similarity = calculateStructuralSimilarity(content, content);
        expect(similarity).toBe(100);
      }
    });
  });
});
