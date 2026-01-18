/**
 * Phase 9 Routing Tests - Observability Deep Linking
 *
 * Tests:
 * 1. URL utilities (buildObservabilityUrl, parseExecutionId, parseEntityFromUrl)
 * 2. Route navigation
 * 3. Deep links
 * 4. Breadcrumbs
 * 5. Query params
 * 6. Copy link functionality
 * 7. 404 handling
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Import URL utilities for testing
import {
  buildObservabilityUrl,
  parseExecutionId,
  parseEntityFromUrl,
  generateBreadcrumbs,
  OBSERVABILITY_PATHS,
  isObservabilityPath,
  getObservabilityTab,
} from "../../frontend/src/utils/observability-urls";

// Test configuration
const TEST_EXECUTION_ID = "exec-12345678-abcd-1234-abcd-123456789abc";
const TEST_TASK_ID = "task-12345678-abcd-1234-abcd-123456789abc";
const TEST_TOOL_ID = "tool-12345678-abcd-1234-abcd-123456789abc";
const TEST_ASSERT_ID = "assert-12345678-abcd-1234-abcd-123456789abc";
const TEST_SKILL_ID = "skill-12345678-abcd-1234-abcd-123456789abc";
const TEST_ENTRY_ID = "entry-12345678-abcd-1234-abcd-123456789abc";

describe("Phase 9: URL Utilities", () => {
  describe("buildObservabilityUrl", () => {
    it("should build root URL", () => {
      const url = buildObservabilityUrl("root");
      expect(url).toBe("/observability");
    });

    it("should build executions list URL", () => {
      const url = buildObservabilityUrl("executions");
      expect(url).toBe("/observability/executions");
    });

    it("should build execution detail URL", () => {
      const url = buildObservabilityUrl("execution", { id: TEST_EXECUTION_ID });
      expect(url).toBe(`/observability/executions/${TEST_EXECUTION_ID}`);
    });

    it("should build task detail URL", () => {
      const url = buildObservabilityUrl("task", {
        id: TEST_EXECUTION_ID,
        taskId: TEST_TASK_ID,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/tasks/${TEST_TASK_ID}`,
      );
    });

    it("should build tool use detail URL", () => {
      const url = buildObservabilityUrl("tool", {
        id: TEST_EXECUTION_ID,
        toolId: TEST_TOOL_ID,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/tools/${TEST_TOOL_ID}`,
      );
    });

    it("should build assertion detail URL", () => {
      const url = buildObservabilityUrl("assertion", {
        id: TEST_EXECUTION_ID,
        assertId: TEST_ASSERT_ID,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/assertions/${TEST_ASSERT_ID}`,
      );
    });

    it("should build wave detail URL", () => {
      const url = buildObservabilityUrl("wave", {
        id: TEST_EXECUTION_ID,
        waveNum: 3,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/waves/3`,
      );
    });

    it("should build skill trace detail URL", () => {
      const url = buildObservabilityUrl("skill", {
        id: TEST_EXECUTION_ID,
        skillId: TEST_SKILL_ID,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/skills/${TEST_SKILL_ID}`,
      );
    });

    it("should build transcript entry URL", () => {
      const url = buildObservabilityUrl("transcript", {
        id: TEST_EXECUTION_ID,
        entryId: TEST_ENTRY_ID,
      });
      expect(url).toBe(
        `/observability/executions/${TEST_EXECUTION_ID}/transcript/${TEST_ENTRY_ID}`,
      );
    });

    it("should add query parameters", () => {
      const url = buildObservabilityUrl(
        "execution",
        { id: TEST_EXECUTION_ID },
        { view: "timeline", filter: "errors" },
      );
      expect(url).toContain(`/observability/executions/${TEST_EXECUTION_ID}?`);
      expect(url).toContain("view=timeline");
      expect(url).toContain("filter=errors");
    });
  });

  describe("parseExecutionId", () => {
    it("should parse execution ID from execution path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}`;
      const result = parseExecutionId(pathname);
      expect(result).toBe(TEST_EXECUTION_ID);
    });

    it("should parse execution ID from nested task path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tasks/${TEST_TASK_ID}`;
      const result = parseExecutionId(pathname);
      expect(result).toBe(TEST_EXECUTION_ID);
    });

    it("should parse execution ID from nested tool path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tools/${TEST_TOOL_ID}`;
      const result = parseExecutionId(pathname);
      expect(result).toBe(TEST_EXECUTION_ID);
    });

    it("should return null for non-execution paths", () => {
      const pathname = "/observability/agents";
      const result = parseExecutionId(pathname);
      expect(result).toBeNull();
    });

    it("should return null for root path", () => {
      const pathname = "/observability";
      const result = parseExecutionId(pathname);
      expect(result).toBeNull();
    });
  });

  describe("parseEntityFromUrl", () => {
    it("should parse task entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tasks/${TEST_TASK_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("task");
      expect(result.entityId).toBe(TEST_TASK_ID);
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should parse tool entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tools/${TEST_TOOL_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("tool");
      expect(result.entityId).toBe(TEST_TOOL_ID);
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should parse assertion entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/assertions/${TEST_ASSERT_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("assertion");
      expect(result.entityId).toBe(TEST_ASSERT_ID);
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should parse wave entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/waves/3`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("wave");
      expect(result.entityId).toBe("3");
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should parse skill entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/skills/${TEST_SKILL_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("skill");
      expect(result.entityId).toBe(TEST_SKILL_ID);
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should parse transcript entity from URL", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/transcript/${TEST_ENTRY_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBe("transcript");
      expect(result.entityId).toBe(TEST_ENTRY_ID);
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should return null for execution path without entity", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}`;
      const result = parseEntityFromUrl(pathname);
      expect(result.entityType).toBeNull();
      expect(result.entityId).toBeNull();
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });
  });

  describe("generateBreadcrumbs", () => {
    it("should generate breadcrumbs for root path", () => {
      const breadcrumbs = generateBreadcrumbs("/observability");
      expect(breadcrumbs).toHaveLength(1);
      expect(breadcrumbs[0].label).toBe("Observability");
      expect(breadcrumbs[0].path).toBe("/observability");
    });

    it("should generate breadcrumbs for execution path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0].label).toBe("Observability");
      expect(breadcrumbs[1].label).toBe("Executions");
      expect(breadcrumbs[2].label).toBe(TEST_EXECUTION_ID.slice(0, 8));
    });

    it("should generate breadcrumbs for task path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tasks/${TEST_TASK_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs).toHaveLength(5);
      expect(breadcrumbs[3].label).toBe("Tasks");
      expect(breadcrumbs[4].label).toBe(TEST_TASK_ID.slice(0, 8));
    });

    it("should use custom entity names when provided", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tasks/${TEST_TASK_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname, {
        execution: "My Execution",
        task: "My Task",
      });
      expect(breadcrumbs[2].label).toBe("My Execution");
      expect(breadcrumbs[4].label).toBe("My Task");
    });
  });

  describe("isObservabilityPath", () => {
    it("should return true for observability paths", () => {
      expect(isObservabilityPath("/observability")).toBe(true);
      expect(isObservabilityPath("/observability/executions")).toBe(true);
      expect(isObservabilityPath("/observability/agents")).toBe(true);
    });

    it("should return false for non-observability paths", () => {
      expect(isObservabilityPath("/")).toBe(false);
      expect(isObservabilityPath("/ideas")).toBe(false);
      expect(isObservabilityPath("/agents")).toBe(false);
    });
  });

  describe("getObservabilityTab", () => {
    it("should return correct tab for each path", () => {
      expect(getObservabilityTab("/observability")).toBe("overview");
      expect(getObservabilityTab("/observability/events")).toBe("events");
      expect(getObservabilityTab("/observability/executions")).toBe(
        "executions",
      );
      expect(getObservabilityTab("/observability/agents")).toBe("agents");
      expect(getObservabilityTab("/observability/analytics")).toBe("analytics");
    });

    it("should return null for non-observability paths", () => {
      expect(getObservabilityTab("/ideas")).toBeNull();
    });
  });
});

describe("Phase 9: Route Navigation", () => {
  describe("OBSERVABILITY_PATHS constants", () => {
    it("should have all required paths", () => {
      expect(OBSERVABILITY_PATHS.root).toBe("/observability");
      expect(OBSERVABILITY_PATHS.events).toBe("/observability/events");
      expect(OBSERVABILITY_PATHS.executions).toBe("/observability/executions");
      expect(OBSERVABILITY_PATHS.agents).toBe("/observability/agents");
      expect(OBSERVABILITY_PATHS.analytics).toBe("/observability/analytics");
      expect(OBSERVABILITY_PATHS.execution).toBe(
        "/observability/executions/:id",
      );
      expect(OBSERVABILITY_PATHS.task).toBe(
        "/observability/executions/:id/tasks/:taskId",
      );
      expect(OBSERVABILITY_PATHS.tool).toBe(
        "/observability/executions/:id/tools/:toolId",
      );
      expect(OBSERVABILITY_PATHS.assertion).toBe(
        "/observability/executions/:id/assertions/:assertId",
      );
      expect(OBSERVABILITY_PATHS.wave).toBe(
        "/observability/executions/:id/waves/:waveNum",
      );
      expect(OBSERVABILITY_PATHS.skill).toBe(
        "/observability/executions/:id/skills/:skillId",
      );
      expect(OBSERVABILITY_PATHS.transcript).toBe(
        "/observability/executions/:id/transcript/:entryId",
      );
      expect(OBSERVABILITY_PATHS.agent).toBe("/observability/agents/:agentId");
    });
  });
});

describe("Phase 9: Deep Links", () => {
  describe("Deep link URL generation", () => {
    it("should generate valid deep link for task", () => {
      const url = buildObservabilityUrl("task", {
        id: TEST_EXECUTION_ID,
        taskId: TEST_TASK_ID,
      });
      expect(url).toMatch(
        /^\/observability\/executions\/[^\/]+\/tasks\/[^\/]+$/,
      );
    });

    it("should generate valid deep link for tool use", () => {
      const url = buildObservabilityUrl("tool", {
        id: TEST_EXECUTION_ID,
        toolId: TEST_TOOL_ID,
      });
      expect(url).toMatch(
        /^\/observability\/executions\/[^\/]+\/tools\/[^\/]+$/,
      );
    });

    it("should generate valid deep link for assertion", () => {
      const url = buildObservabilityUrl("assertion", {
        id: TEST_EXECUTION_ID,
        assertId: TEST_ASSERT_ID,
      });
      expect(url).toMatch(
        /^\/observability\/executions\/[^\/]+\/assertions\/[^\/]+$/,
      );
    });

    it("should generate valid deep link for wave", () => {
      const url = buildObservabilityUrl("wave", {
        id: TEST_EXECUTION_ID,
        waveNum: 5,
      });
      expect(url).toMatch(/^\/observability\/executions\/[^\/]+\/waves\/\d+$/);
    });

    it("should generate valid deep link for skill", () => {
      const url = buildObservabilityUrl("skill", {
        id: TEST_EXECUTION_ID,
        skillId: TEST_SKILL_ID,
      });
      expect(url).toMatch(
        /^\/observability\/executions\/[^\/]+\/skills\/[^\/]+$/,
      );
    });

    it("should generate valid deep link for transcript entry", () => {
      const url = buildObservabilityUrl("transcript", {
        id: TEST_EXECUTION_ID,
        entryId: TEST_ENTRY_ID,
      });
      expect(url).toMatch(
        /^\/observability\/executions\/[^\/]+\/transcript\/[^\/]+$/,
      );
    });
  });
});

describe("Phase 9: Breadcrumbs", () => {
  describe("Breadcrumb generation for all entity types", () => {
    it("should generate correct breadcrumbs for tool use path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/tools/${TEST_TOOL_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs.some((b) => b.label === "Tool Uses")).toBe(true);
    });

    it("should generate correct breadcrumbs for assertion path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/assertions/${TEST_ASSERT_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs.some((b) => b.label === "Assertions")).toBe(true);
    });

    it("should generate correct breadcrumbs for wave path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/waves/3`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs.some((b) => b.label === "Waves")).toBe(true);
    });

    it("should generate correct breadcrumbs for skill path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/skills/${TEST_SKILL_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs.some((b) => b.label === "Skills")).toBe(true);
    });

    it("should generate correct breadcrumbs for transcript path", () => {
      const pathname = `/observability/executions/${TEST_EXECUTION_ID}/transcript/${TEST_ENTRY_ID}`;
      const breadcrumbs = generateBreadcrumbs(pathname);
      expect(breadcrumbs.some((b) => b.label === "Transcript")).toBe(true);
    });
  });
});

describe("Phase 9: Query Params", () => {
  describe("Query parameter handling", () => {
    it("should handle single query parameter", () => {
      const url = buildObservabilityUrl(
        "execution",
        { id: TEST_EXECUTION_ID },
        { view: "timeline" },
      );
      expect(url).toContain("?view=timeline");
    });

    it("should handle multiple query parameters", () => {
      const url = buildObservabilityUrl(
        "execution",
        { id: TEST_EXECUTION_ID },
        { view: "timeline", filter: "errors", page: "2" },
      );
      expect(url).toContain("view=timeline");
      expect(url).toContain("filter=errors");
      expect(url).toContain("page=2");
    });

    it("should handle empty query object", () => {
      const url = buildObservabilityUrl(
        "execution",
        { id: TEST_EXECUTION_ID },
        {},
      );
      expect(url).not.toContain("?");
    });

    it("should handle undefined query", () => {
      const url = buildObservabilityUrl("execution", { id: TEST_EXECUTION_ID });
      expect(url).not.toContain("?");
    });

    it("should encode special characters in query values", () => {
      const url = buildObservabilityUrl(
        "execution",
        { id: TEST_EXECUTION_ID },
        { search: "hello world" },
      );
      expect(url).toContain("search=hello+world");
    });
  });
});

describe("Phase 9: Copy Link", () => {
  describe("Shareable URL generation", () => {
    it("should generate URLs that can be parsed back", () => {
      const url = buildObservabilityUrl("task", {
        id: TEST_EXECUTION_ID,
        taskId: TEST_TASK_ID,
      });

      // Parse the generated URL
      const parsed = parseEntityFromUrl(url);

      expect(parsed.executionId).toBe(TEST_EXECUTION_ID);
      expect(parsed.entityType).toBe("task");
      expect(parsed.entityId).toBe(TEST_TASK_ID);
    });

    it("should round-trip all entity types", () => {
      const entities = [
        {
          type: "task" as const,
          params: { id: TEST_EXECUTION_ID, taskId: TEST_TASK_ID },
        },
        {
          type: "tool" as const,
          params: { id: TEST_EXECUTION_ID, toolId: TEST_TOOL_ID },
        },
        {
          type: "assertion" as const,
          params: { id: TEST_EXECUTION_ID, assertId: TEST_ASSERT_ID },
        },
        {
          type: "wave" as const,
          params: { id: TEST_EXECUTION_ID, waveNum: "3" },
        },
        {
          type: "skill" as const,
          params: { id: TEST_EXECUTION_ID, skillId: TEST_SKILL_ID },
        },
        {
          type: "transcript" as const,
          params: { id: TEST_EXECUTION_ID, entryId: TEST_ENTRY_ID },
        },
      ];

      for (const entity of entities) {
        const url = buildObservabilityUrl(entity.type, entity.params);
        const parsed = parseEntityFromUrl(url);
        expect(parsed.executionId).toBe(TEST_EXECUTION_ID);
        expect(parsed.entityType).toBe(entity.type);
      }
    });
  });
});

describe("Phase 9: 404 Handling", () => {
  describe("Invalid URL parsing", () => {
    it("should return null for completely invalid paths", () => {
      const result = parseEntityFromUrl("/invalid/path/here");
      expect(result.entityType).toBeNull();
      expect(result.entityId).toBeNull();
      expect(result.executionId).toBeNull();
    });

    it("should handle malformed execution paths gracefully", () => {
      const result = parseExecutionId("/observability/executions/");
      expect(result).toBeNull();
    });

    it("should handle paths with only execution ID", () => {
      const result = parseEntityFromUrl(
        `/observability/executions/${TEST_EXECUTION_ID}`,
      );
      expect(result.entityType).toBeNull();
      expect(result.entityId).toBeNull();
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });

    it("should handle unknown entity types gracefully", () => {
      const result = parseEntityFromUrl(
        `/observability/executions/${TEST_EXECUTION_ID}/unknown/some-id`,
      );
      expect(result.entityType).toBeNull();
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
    });
  });
});

// Summary
console.log(`
Phase 9 Routing Tests
=====================

Test Categories:
1. URL Utilities - Testing buildObservabilityUrl, parseExecutionId, parseEntityFromUrl
2. Route Navigation - Testing OBSERVABILITY_PATHS constants
3. Deep Links - Testing URL generation for all entity types
4. Breadcrumbs - Testing breadcrumb generation
5. Query Params - Testing query parameter handling
6. Copy Link - Testing shareable URL generation and round-tripping
7. 404 Handling - Testing graceful handling of invalid URLs

Total Test Suites: 7
`);
