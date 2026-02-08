/**
 * Claude Client Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ClaudeClient,
} from "../../agents/specification/claude-client.js";
import { ParsedBrief } from "../../agents/specification/brief-parser.js";
import {
  LoadedContext,
} from "../../agents/specification/context-loader.js";

// Mock the anthropic client module to avoid CLI/API key requirements
vi.mock("../../utils/anthropic-client.js", () => {
  const mockClient = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "{}" }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  };
  return {
    createAnthropicClient: vi.fn().mockReturnValue(mockClient),
    useClaudeCli: false,
    client: mockClient,
  };
});

describe("claude-client", () => {
  let client: ClaudeClient;

  const mockBrief: ParsedBrief = {
    id: "test-feature",
    title: "Test Feature",
    complexity: "simple",
    problem: "Users need X",
    solution: "Implement Y",
    mvpScope: {
      inScope: ["Feature A"],
      outOfScope: ["Feature B"],
    },
    constraints: [],
    successCriteria: ["Works correctly"],
    rawContent: "",
  };

  const mockContext: LoadedContext = {
    claude: "# Project Guide",
    templates: {
      "spec.md": "Template content",
      "tasks.md": "Tasks template",
    },
    gotchas: [
      {
        id: "G-001",
        content: "Use TEXT for timestamps",
        filePattern: "*.sql",
        actionType: "CREATE",
        confidence: "high",
        source: "knowledge_base",
      },
    ],
    requirements: [],
    tokenEstimate: 1000,
  };

  beforeEach(() => {
    client = new ClaudeClient({ apiKey: "test-key" });
  });

  describe("constructor", () => {
    it("should create client with default options", () => {
      const defaultClient = new ClaudeClient();
      expect(defaultClient).toBeDefined();
    });

    it("should accept custom options", () => {
      const customClient = new ClaudeClient({
        model: "claude-3-opus",
        maxTokens: 4096,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe("parseTaskYaml", () => {
    it("should parse valid task YAML", () => {
      const yamlContent = `id: T-001
phase: database
action: CREATE
file: "database/migrations/001.sql"
status: pending
requirements:
  - "Create table"
  - "Add indexes"
gotchas:
  - "Use TEXT for dates"
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
depends_on: []`;

      // Access private method via type assertion
      const task = (client as any).parseTaskYaml(yamlContent);

      expect(task).toBeDefined();
      expect(task.id).toBe("T-001");
      expect(task.phase).toBe("database");
      expect(task.action).toBe("CREATE");
      expect(task.file).toBe("database/migrations/001.sql");
      expect(task.requirements).toContain("Create table");
      expect(task.gotchas).toContain("Use TEXT for dates");
    });

    it("should handle task with code template", () => {
      const yamlContent = `id: T-002
phase: types
action: CREATE
file: "types/feature.ts"
status: pending
requirements:
  - "Define interface"
gotchas: []
validation:
  command: "npx tsc --noEmit"
  expected: "exit code 0"
code_template: |
  export interface Feature {
    id: string;
    name: string;
  }
depends_on:
  - T-001`;

      const task = (client as any).parseTaskYaml(yamlContent);

      expect(task).toBeDefined();
      expect(task.id).toBe("T-002");
      expect(task.codeTemplate).toContain("export interface Feature");
      expect(task.dependsOn).toContain("T-001");
    });

    it("should return null for invalid YAML", () => {
      const invalidYaml = `some: invalid
yaml: without
required: fields`;

      const task = (client as any).parseTaskYaml(invalidYaml);
      expect(task).toBeNull();
    });
  });

  describe("parseTasks", () => {
    it("should extract multiple tasks from response", () => {
      const response = `Here are the tasks:

\`\`\`yaml
id: T-001
phase: database
action: CREATE
file: "db/001.sql"
status: pending
requirements: []
gotchas: []
validation:
  command: "echo ok"
  expected: "ok"
depends_on: []
\`\`\`

\`\`\`yaml
id: T-002
phase: types
action: CREATE
file: "types/x.ts"
status: pending
requirements: []
gotchas: []
validation:
  command: "echo ok"
  expected: "ok"
depends_on:
  - T-001
\`\`\``;

      const tasks = (client as any).parseTasks(response);

      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe("T-001");
      expect(tasks[1].id).toBe("T-002");
      expect(tasks[1].dependsOn).toContain("T-001");
    });
  });

  describe("parseRequirements", () => {
    it("should parse JSON from code block", () => {
      const response = `Here's the analysis:

\`\`\`json
{
  "functionalRequirements": [
    { "id": "FR-001", "description": "Feature A", "priority": "must" }
  ],
  "nonFunctionalRequirements": [],
  "constraints": ["SQLite only"],
  "successCriteria": ["Works"],
  "ambiguities": []
}
\`\`\``;

      const reqs = (client as any).parseRequirements(response);

      expect(reqs.functionalRequirements).toHaveLength(1);
      expect(reqs.functionalRequirements[0].id).toBe("FR-001");
      expect(reqs.constraints).toContain("SQLite only");
    });

    it("should return empty requirements for invalid JSON", () => {
      const response = "Some text without JSON";

      const reqs = (client as any).parseRequirements(response);

      expect(reqs.functionalRequirements).toHaveLength(0);
    });
  });

  describe("retry logic", () => {
    it("should implement exponential backoff", () => {
      const delay0 = (client as any).calculateBackoff(0);
      const delay1 = (client as any).calculateBackoff(1);
      const delay2 = (client as any).calculateBackoff(2);

      // Each retry should be approximately 2x the previous
      expect(delay1).toBeGreaterThan(delay0);
      expect(delay2).toBeGreaterThan(delay1);
    });

    it("should cap backoff at 60 seconds", () => {
      const delay10 = (client as any).calculateBackoff(10);
      expect(delay10).toBeLessThanOrEqual(60000);
    });

    it("should identify retryable errors", () => {
      expect((client as any).isRetryableError({ status: 429 })).toBe(true);
      expect((client as any).isRetryableError({ status: 500 })).toBe(true);
      expect((client as any).isRetryableError({ code: "ECONNRESET" })).toBe(
        true,
      );
      expect((client as any).isRetryableError({ status: 400 })).toBe(false);
    });
  });

  describe("token tracking", () => {
    it("should track tokens used", async () => {
      // The mock returns 150 tokens per call
      expect(client.getTokensUsed()).toBe(0);

      await client.analyzeBrief(mockBrief, mockContext);

      expect(client.getTokensUsed()).toBe(150);
    });

    it("should reset token counter", async () => {
      await client.analyzeBrief(mockBrief, mockContext);
      expect(client.getTokensUsed()).toBeGreaterThan(0);

      client.resetTokenCounter();
      expect(client.getTokensUsed()).toBe(0);
    });
  });
});
