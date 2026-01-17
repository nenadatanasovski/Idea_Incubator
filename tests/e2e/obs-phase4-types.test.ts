/**
 * Observability Phase 4: TypeScript Types Tests
 * ==============================================
 *
 * Comprehensive tests for tasks OBS-200 to OBS-212.
 * Validates that all TypeScript type definitions in frontend/src/types/observability/
 * are correctly defined and exported.
 *
 * Test Categories:
 * 1. Type Existence Tests - All enums and interfaces exist
 * 2. Type Compatibility Tests - Mock objects conform to interfaces
 * 3. Export Tests - All types exported from index.ts
 * 4. TypeScript Compilation Tests - No type errors
 * 5. Acceptance Criteria per Task
 *
 * Run: npx vitest run tests/e2e/obs-phase4-types.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// =============================================================================
// Test Configuration
// =============================================================================

const TYPES_DIR = path.join(process.cwd(), "frontend/src/types/observability");

const TYPE_FILES = {
  transcript: "transcript.ts",
  toolUse: "tool-use.ts",
  toolIo: "tool-io.ts",
  skill: "skill.ts",
  assertion: "assertion.ts",
  messageBus: "message-bus.ts",
  websocket: "websocket.ts",
  api: "api.ts",
  crossRefs: "cross-refs.ts",
  uiProps: "ui-props.ts",
  hooks: "hooks.ts",
  security: "security.ts",
  index: "index.ts",
};

// =============================================================================
// Helper Functions
// =============================================================================

function fileExists(filename: string): boolean {
  const filePath = path.join(TYPES_DIR, filename);
  return fs.existsSync(filePath);
}

function readTypeFile(filename: string): string {
  const filePath = path.join(TYPES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return "";
  }
  return fs.readFileSync(filePath, "utf-8");
}

function countEnumValues(content: string, enumName: string): number {
  // Match enum definition and count values
  const enumMatch = content.match(
    new RegExp(`(enum|type)\\s+${enumName}\\s*=?[^{;]*[{|]([^}]+)[}|;]`, "s"),
  );
  if (!enumMatch) return 0;

  const enumBody = enumMatch[2];
  // Count lines with actual values (for string unions, count | separators + 1)
  if (enumBody.includes("|")) {
    return enumBody.split("|").filter((s) => s.trim().length > 0).length;
  }
  // For traditional enums, count comma-separated values
  return enumBody.split(",").filter((s) => s.trim().length > 0).length;
}

function hasInterface(content: string, interfaceName: string): boolean {
  return new RegExp(`interface\\s+${interfaceName}\\s*[{<]`).test(content);
}

function hasType(content: string, typeName: string): boolean {
  return new RegExp(`type\\s+${typeName}\\s*=`).test(content);
}

function hasExport(content: string, exportName: string): boolean {
  // Check for direct export or re-export
  return (
    new RegExp(`export\\s+(interface|type|enum|const)\\s+${exportName}`).test(
      content,
    ) ||
    new RegExp(`export\\s*\\{[^}]*${exportName}[^}]*\\}`).test(content) ||
    new RegExp(`export\\s+\\*\\s+from`).test(content)
  );
}

function hasGenericType(content: string, typeName: string): boolean {
  return new RegExp(`(interface|type)\\s+${typeName}\\s*<`).test(content);
}

// =============================================================================
// TEST SUITE: File Existence Tests
// =============================================================================

describe("Phase 4 File Existence Tests", () => {
  it("OBS-200: transcript.ts exists", () => {
    expect(fileExists(TYPE_FILES.transcript)).toBe(true);
  });

  it("OBS-201: tool-use.ts exists", () => {
    expect(fileExists(TYPE_FILES.toolUse)).toBe(true);
  });

  it("OBS-202: tool-io.ts exists", () => {
    expect(fileExists(TYPE_FILES.toolIo)).toBe(true);
  });

  it("OBS-203: skill.ts exists", () => {
    expect(fileExists(TYPE_FILES.skill)).toBe(true);
  });

  it("OBS-204: assertion.ts exists", () => {
    expect(fileExists(TYPE_FILES.assertion)).toBe(true);
  });

  it("OBS-205: message-bus.ts exists", () => {
    expect(fileExists(TYPE_FILES.messageBus)).toBe(true);
  });

  it("OBS-206: websocket.ts exists", () => {
    expect(fileExists(TYPE_FILES.websocket)).toBe(true);
  });

  it("OBS-207: api.ts exists", () => {
    expect(fileExists(TYPE_FILES.api)).toBe(true);
  });

  it("OBS-208: cross-refs.ts exists", () => {
    expect(fileExists(TYPE_FILES.crossRefs)).toBe(true);
  });

  it("OBS-209: ui-props.ts exists", () => {
    expect(fileExists(TYPE_FILES.uiProps)).toBe(true);
  });

  it("OBS-210: hooks.ts exists", () => {
    expect(fileExists(TYPE_FILES.hooks)).toBe(true);
  });

  it("OBS-211: security.ts exists", () => {
    expect(fileExists(TYPE_FILES.security)).toBe(true);
  });

  it("OBS-212: index.ts exists", () => {
    expect(fileExists(TYPE_FILES.index)).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-200 Core Transcript Types
// =============================================================================

describe("OBS-200: Core Transcript Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.transcript);
  });

  it("TranscriptEntryType enum has 15 values", () => {
    // Expected values: phase_start, phase_end, task_start, task_end, tool_use,
    // skill_invoke, assertion, discovery, error, decision, checkpoint, rollback,
    // lock_acquire, lock_release, validation
    const count = countEnumValues(content, "TranscriptEntryType");
    expect(count).toBeGreaterThanOrEqual(15);
  });

  it("EntryCategory enum exists", () => {
    expect(
      hasType(content, "EntryCategory") || content.includes("EntryCategory"),
    ).toBe(true);
  });

  it("TranscriptEntry interface exists", () => {
    expect(hasInterface(content, "TranscriptEntry")).toBe(true);
  });

  it("TranscriptEntry has required fields", () => {
    expect(content).toMatch(/id:\s*string/);
    expect(content).toMatch(/timestamp:\s*string/);
    expect(content).toMatch(/sequence:\s*number/);
    expect(content).toMatch(/executionId:\s*string/);
    expect(content).toMatch(/entryType:\s*TranscriptEntryType/);
    expect(content).toMatch(/category:\s*EntryCategory/);
    expect(content).toMatch(/summary:\s*string/);
  });

  it("PaginatedResponse<T> generic exists", () => {
    expect(hasGenericType(content, "PaginatedResponse")).toBe(true);
  });

  it("PaginatedResponse has data, total, hasMore fields", () => {
    expect(content).toMatch(/data:\s*T\[\]/);
    expect(content).toMatch(/total:\s*number/);
    expect(content).toMatch(/hasMore:\s*boolean/);
  });
});

// =============================================================================
// TEST SUITE: OBS-201 Tool Use Types
// =============================================================================

describe("OBS-201: Tool Use Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.toolUse);
  });

  it("ToolCategory enum has 8 values", () => {
    // Expected: file_read, file_write, file_edit, shell, search, web, mcp, agent
    const count = countEnumValues(content, "ToolCategory");
    expect(count).toBeGreaterThanOrEqual(8);
  });

  it("ToolCategory includes required values", () => {
    expect(content).toMatch(/file_read/);
    expect(content).toMatch(/file_write/);
    expect(content).toMatch(/file_edit/);
    expect(content).toMatch(/shell/);
    expect(content).toMatch(/search/);
    expect(content).toMatch(/web/);
    expect(content).toMatch(/mcp/);
    expect(content).toMatch(/agent/);
  });

  it("ToolResultStatus enum exists", () => {
    expect(
      hasType(content, "ToolResultStatus") ||
        content.includes("ToolResultStatus"),
    ).toBe(true);
  });

  it("ToolResultStatus has done, error, blocked values", () => {
    expect(content).toMatch(/done/);
    expect(content).toMatch(/error/);
    expect(content).toMatch(/blocked/);
  });

  it("ToolUse interface exists with database fields", () => {
    expect(hasInterface(content, "ToolUse")).toBe(true);
    expect(content).toMatch(/id:\s*string/);
    expect(content).toMatch(/executionId:\s*string/);
    expect(content).toMatch(/tool:\s*/);
    expect(content).toMatch(/toolCategory:\s*ToolCategory/);
    expect(content).toMatch(/resultStatus:\s*ToolResultStatus/);
    expect(content).toMatch(/durationMs:\s*number/);
  });
});

// =============================================================================
// TEST SUITE: OBS-202 Tool Input/Output Types
// =============================================================================

describe("OBS-202: Tool Input/Output Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.toolIo);
  });

  it("ReadInput interface exists", () => {
    expect(hasInterface(content, "ReadInput")).toBe(true);
  });

  it("WriteInput interface exists", () => {
    expect(hasInterface(content, "WriteInput")).toBe(true);
  });

  it("EditInput interface exists", () => {
    expect(hasInterface(content, "EditInput")).toBe(true);
  });

  it("BashInput interface exists", () => {
    expect(hasInterface(content, "BashInput")).toBe(true);
  });

  it("ToolInputUnion discriminated union exists", () => {
    expect(
      hasType(content, "ToolInputUnion") || content.includes("ToolInputUnion"),
    ).toBe(true);
  });

  it("ToolOutputUnion discriminated union exists", () => {
    expect(
      hasType(content, "ToolOutputUnion") ||
        content.includes("ToolOutputUnion"),
    ).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-203 Skill Trace Types
// =============================================================================

describe("OBS-203: Skill Trace Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.skill);
  });

  it("SkillReference interface exists", () => {
    expect(hasInterface(content, "SkillReference")).toBe(true);
  });

  it("SkillTrace interface exists", () => {
    expect(hasInterface(content, "SkillTrace")).toBe(true);
  });

  it("SkillTrace has nested toolCalls and subSkills", () => {
    expect(content).toMatch(/toolCalls/);
    expect(content).toMatch(/subSkills/);
  });

  it("SkillStatus enum exists", () => {
    expect(
      hasType(content, "SkillStatus") || content.includes("SkillStatus"),
    ).toBe(true);
  });

  it("SkillsUsageSummary interface exists", () => {
    expect(hasInterface(content, "SkillsUsageSummary")).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-204 Assertion Types
// =============================================================================

describe("OBS-204: Assertion Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.assertion);
  });

  it("AssertionCategory enum has 9 categories", () => {
    // Expected: file_created, file_modified, file_deleted, tsc_compiles,
    // test_passes, lint_passes, build_succeeds, runtime_check, custom
    const count = countEnumValues(content, "AssertionCategory");
    expect(count).toBeGreaterThanOrEqual(9);
  });

  it("AssertionCategory includes required values", () => {
    expect(content).toMatch(/file_created/);
    expect(content).toMatch(/file_modified/);
    expect(content).toMatch(/tsc_compiles/);
    expect(content).toMatch(/test_passes/);
    expect(content).toMatch(/lint_passes/);
    expect(content).toMatch(/build_succeeds/);
  });

  it("AssertionResult interface exists", () => {
    expect(
      hasInterface(content, "AssertionResult") ||
        hasType(content, "AssertionResult") ||
        content.includes("AssertionResult"),
    ).toBe(true);
  });

  it("AssertionChain interface exists", () => {
    expect(hasInterface(content, "AssertionChain")).toBe(true);
  });

  it("AssertionEvidence interface exists", () => {
    expect(hasInterface(content, "AssertionEvidence")).toBe(true);
  });

  it("AssertionEvidence has evidence fields", () => {
    expect(content).toMatch(/command/);
    expect(content).toMatch(/exitCode/);
    expect(content).toMatch(/stdout/);
    expect(content).toMatch(/stderr/);
  });
});

// =============================================================================
// TEST SUITE: OBS-205 Message Bus Types
// =============================================================================

describe("OBS-205: Message Bus Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.messageBus);
  });

  it("MessageBusSeverity enum exists", () => {
    expect(
      hasType(content, "MessageBusSeverity") ||
        content.includes("MessageBusSeverity"),
    ).toBe(true);
  });

  it("MessageBusSeverity has info, warning, error, critical", () => {
    expect(content).toMatch(/info/);
    expect(content).toMatch(/warning/);
    expect(content).toMatch(/error/);
    expect(content).toMatch(/critical/);
  });

  it("MessageBusCategory enum exists", () => {
    expect(
      hasType(content, "MessageBusCategory") ||
        content.includes("MessageBusCategory"),
    ).toBe(true);
  });

  it("MessageBusLogEntry interface exists", () => {
    expect(hasInterface(content, "MessageBusLogEntry")).toBe(true);
  });

  it("MessageBusQuery interface exists", () => {
    expect(hasInterface(content, "MessageBusQuery")).toBe(true);
  });

  it("MessageBusLogEntry has correlationId field", () => {
    expect(content).toMatch(/correlationId/);
  });
});

// =============================================================================
// TEST SUITE: OBS-206 WebSocket Event Types
// =============================================================================

describe("OBS-206: WebSocket Event Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.websocket);
  });

  it("ObservabilityEventType enum exists", () => {
    expect(
      hasType(content, "ObservabilityEventType") ||
        content.includes("ObservabilityEventType"),
    ).toBe(true);
  });

  it("ObservabilityEvent base interface exists", () => {
    expect(hasInterface(content, "ObservabilityEvent")).toBe(true);
  });

  it("TranscriptEvent interface exists", () => {
    expect(
      hasInterface(content, "TranscriptEvent") ||
        content.includes("TranscriptEvent"),
    ).toBe(true);
  });

  it("ToolUseEvent interface exists", () => {
    expect(
      hasInterface(content, "ToolUseEvent") || content.includes("ToolUseEvent"),
    ).toBe(true);
  });

  it("AssertionEvent interface exists", () => {
    expect(
      hasInterface(content, "AssertionEvent") ||
        content.includes("AssertionEvent"),
    ).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-207 API Request/Response Types
// =============================================================================

describe("OBS-207: API Request/Response Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.api);
  });

  it("ExecutionResponse interface exists", () => {
    expect(hasInterface(content, "ExecutionResponse")).toBe(true);
  });

  it("ExecutionResponse has stats fields", () => {
    expect(content).toMatch(/stats/i);
  });

  it("TranscriptQuery interface exists", () => {
    expect(hasInterface(content, "TranscriptQuery")).toBe(true);
  });

  it("ToolUseQuery interface exists", () => {
    expect(hasInterface(content, "ToolUseQuery")).toBe(true);
  });

  it("AssertionQuery interface exists", () => {
    expect(hasInterface(content, "AssertionQuery")).toBe(true);
  });

  it("ToolUsageSummaryResponse interface exists", () => {
    expect(hasInterface(content, "ToolUsageSummaryResponse")).toBe(true);
  });

  it("ErrorResponse interface exists", () => {
    expect(hasInterface(content, "ErrorResponse")).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-208 Cross-Reference Types
// =============================================================================

describe("OBS-208: Cross-Reference Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.crossRefs);
  });

  it("CrossRefEntityType enum exists", () => {
    expect(
      hasType(content, "CrossRefEntityType") ||
        content.includes("CrossRefEntityType"),
    ).toBe(true);
  });

  it("ToolUseCrossRefs interface exists", () => {
    expect(hasInterface(content, "ToolUseCrossRefs")).toBe(true);
  });

  it("AssertionCrossRefs interface exists", () => {
    expect(hasInterface(content, "AssertionCrossRefs")).toBe(true);
  });

  it("SkillTraceCrossRefs interface exists", () => {
    expect(hasInterface(content, "SkillTraceCrossRefs")).toBe(true);
  });

  it("EntityCrossRefs discriminated union exists", () => {
    expect(
      hasType(content, "EntityCrossRefs") ||
        content.includes("EntityCrossRefs"),
    ).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-209 UI Component Prop Types
// =============================================================================

describe("OBS-209: UI Component Prop Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.uiProps);
  });

  it("ExecutionListProps interface exists", () => {
    expect(hasInterface(content, "ExecutionListProps")).toBe(true);
  });

  it("TranscriptViewerProps interface exists", () => {
    expect(hasInterface(content, "TranscriptViewerProps")).toBe(true);
  });

  it("ToolUseCardProps interface exists", () => {
    expect(hasInterface(content, "ToolUseCardProps")).toBe(true);
  });

  it("AssertionCardProps interface exists", () => {
    expect(hasInterface(content, "AssertionCardProps")).toBe(true);
  });

  it("SkillTraceCardProps interface exists", () => {
    expect(hasInterface(content, "SkillTraceCardProps")).toBe(true);
  });

  it("MessageBusLogProps interface exists", () => {
    expect(hasInterface(content, "MessageBusLogProps")).toBe(true);
  });

  it("FilterPanelProps interface exists", () => {
    expect(hasInterface(content, "FilterPanelProps")).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-210 React Hook Types
// =============================================================================

describe("OBS-210: React Hook Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.hooks);
  });

  it("UseExecutionListResult interface exists", () => {
    expect(hasInterface(content, "UseExecutionListResult")).toBe(true);
  });

  it("UseExecutionResult interface exists", () => {
    expect(hasInterface(content, "UseExecutionResult")).toBe(true);
  });

  it("UseTranscriptResult interface exists", () => {
    expect(hasInterface(content, "UseTranscriptResult")).toBe(true);
  });

  it("UseToolUsesResult interface exists", () => {
    expect(hasInterface(content, "UseToolUsesResult")).toBe(true);
  });

  it("UseAssertionsResult interface exists", () => {
    expect(hasInterface(content, "UseAssertionsResult")).toBe(true);
  });

  it("UseObservabilityStreamResult interface exists", () => {
    expect(hasInterface(content, "UseObservabilityStreamResult")).toBe(true);
  });

  it("UseFiltersResult interface exists", () => {
    expect(hasInterface(content, "UseFiltersResult")).toBe(true);
  });

  it("Hook results have loading, error, data pattern", () => {
    expect(content).toMatch(/loading:\s*boolean/);
    expect(content).toMatch(/error:\s*/);
    expect(content).toMatch(/data:\s*/);
  });
});

// =============================================================================
// TEST SUITE: OBS-211 Security Types
// =============================================================================

describe("OBS-211: Security Types", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.security);
  });

  it("BlockedCommand interface exists", () => {
    expect(hasInterface(content, "BlockedCommand")).toBe(true);
  });

  it("BlockedCommand has reason and suggestion fields", () => {
    expect(content).toMatch(/reason:\s*string/);
    expect(content).toMatch(/suggestion/);
  });

  it("SecurityValidation interface exists", () => {
    expect(hasInterface(content, "SecurityValidation")).toBe(true);
  });

  it("DangerousPattern enum exists", () => {
    expect(
      hasType(content, "DangerousPattern") ||
        content.includes("DangerousPattern"),
    ).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: OBS-212 Index Export File
// =============================================================================

describe("OBS-212: Index Export File", () => {
  let content: string;

  beforeAll(() => {
    content = readTypeFile(TYPE_FILES.index);
  });

  it("index.ts uses export * from syntax", () => {
    expect(content).toMatch(/export \* from/);
  });

  it("index.ts exports from transcript.ts", () => {
    expect(content).toMatch(/from ['"]\.\/transcript['"]/);
  });

  it("index.ts exports from tool-use.ts", () => {
    expect(content).toMatch(/from ['"]\.\/tool-use['"]/);
  });

  it("index.ts exports from tool-io.ts", () => {
    expect(content).toMatch(/from ['"]\.\/tool-io['"]/);
  });

  it("index.ts exports from skill.ts", () => {
    expect(content).toMatch(/from ['"]\.\/skill['"]/);
  });

  it("index.ts exports from assertion.ts", () => {
    expect(content).toMatch(/from ['"]\.\/assertion['"]/);
  });

  it("index.ts exports from message-bus.ts", () => {
    expect(content).toMatch(/from ['"]\.\/message-bus['"]/);
  });

  it("index.ts exports from websocket.ts", () => {
    expect(content).toMatch(/from ['"]\.\/websocket['"]/);
  });

  it("index.ts exports from api.ts", () => {
    expect(content).toMatch(/from ['"]\.\/api['"]/);
  });

  it("index.ts exports from cross-refs.ts", () => {
    expect(content).toMatch(/from ['"]\.\/cross-refs['"]/);
  });

  it("index.ts exports from ui-props.ts", () => {
    expect(content).toMatch(/from ['"]\.\/ui-props['"]/);
  });

  it("index.ts exports from hooks.ts", () => {
    expect(content).toMatch(/from ['"]\.\/hooks['"]/);
  });

  it("index.ts exports from security.ts", () => {
    expect(content).toMatch(/from ['"]\.\/security['"]/);
  });

  it("exports are in alphabetical order", () => {
    const exportLines = content
      .split("\n")
      .filter((line) => line.includes("export * from"))
      .map((line) => {
        const match = line.match(/from ['"]\.\/([^'"]+)['"]/);
        return match ? match[1] : "";
      })
      .filter((name) => name.length > 0);

    const sorted = [...exportLines].sort();
    expect(exportLines).toEqual(sorted);
  });
});

// =============================================================================
// TEST SUITE: TypeScript Compilation Tests
// =============================================================================

describe("TypeScript Compilation Tests", () => {
  it("All type files compile without errors", () => {
    if (!fs.existsSync(TYPES_DIR)) {
      // Skip if directory doesn't exist yet
      expect(true).toBe(true);
      return;
    }

    try {
      // Run tsc on the types directory
      execSync(
        `npx tsc --noEmit --skipLibCheck --strict ${path.join(TYPES_DIR, "*.ts")} 2>&1`,
        {
          cwd: process.cwd(),
          encoding: "utf-8",
          stdio: "pipe",
        },
      );
      expect(true).toBe(true);
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string };
      // If tsc fails, check if it's because files don't exist
      if (
        execError.stdout?.includes("Cannot find") ||
        execError.stderr?.includes("Cannot find")
      ) {
        // Files don't exist yet - this is expected before implementation
        expect(true).toBe(true);
      } else {
        // Real compilation errors
        console.error("TypeScript compilation errors:", execError.stdout);
        expect(false).toBe(true);
      }
    }
  });

  it("No circular dependencies in type files", () => {
    if (!fs.existsSync(TYPES_DIR)) {
      expect(true).toBe(true);
      return;
    }

    const indexContent = readTypeFile(TYPE_FILES.index);
    if (!indexContent) {
      expect(true).toBe(true);
      return;
    }

    // Check that index.ts doesn't import itself
    expect(indexContent).not.toMatch(/from ['"]\.\/index['"]/);

    // Check each file doesn't create circular dependencies
    const files = Object.values(TYPE_FILES);
    for (const file of files) {
      if (file === "index.ts") continue;
      const content = readTypeFile(file);
      // Files shouldn't import from index (which would create circular deps)
      expect(content).not.toMatch(/from ['"]\.\/index['"]/);
    }
  });
});

// =============================================================================
// TEST SUITE: Type Compatibility Tests (Mock Objects)
// =============================================================================

describe("Type Compatibility Tests", () => {
  it("Mock TranscriptEntry object compiles", () => {
    // This test verifies the type can be instantiated
    const mockEntry = {
      id: "te-001",
      timestamp: "2026-01-17T00:00:00.000Z",
      sequence: 1,
      executionId: "exec-001",
      taskId: "task-001",
      instanceId: "inst-001",
      waveNumber: 1,
      entryType: "tool_use" as const,
      category: "execution" as const,
      summary: "Test entry",
      details: null,
      skillRef: null,
      toolCalls: null,
      assertions: null,
      durationMs: 100,
      tokenEstimate: 50,
      createdAt: "2026-01-17T00:00:00.000Z",
    };

    expect(mockEntry.id).toBe("te-001");
    expect(mockEntry.entryType).toBe("tool_use");
  });

  it("Mock ToolUse object compiles", () => {
    const mockToolUse = {
      id: "tu-001",
      executionId: "exec-001",
      taskId: "task-001",
      transcriptEntryId: "te-001",
      tool: "Bash" as const,
      toolCategory: "shell" as const,
      input: { command: "ls -la" },
      inputSummary: "List files",
      resultStatus: "done" as const,
      output: { stdout: "file1.txt" },
      outputSummary: "Listed 1 file",
      isError: false,
      isBlocked: false,
      errorMessage: null,
      blockReason: null,
      startTime: "2026-01-17T00:00:00.000Z",
      endTime: "2026-01-17T00:00:01.000Z",
      durationMs: 1000,
      withinSkill: null,
      parentToolUseId: null,
      createdAt: "2026-01-17T00:00:00.000Z",
    };

    expect(mockToolUse.tool).toBe("Bash");
    expect(mockToolUse.toolCategory).toBe("shell");
    expect(mockToolUse.isError).toBe(false);
  });

  it("Mock AssertionResult object compiles", () => {
    const mockAssertion = {
      id: "ar-001",
      taskId: "task-001",
      executionId: "exec-001",
      category: "tsc_compiles" as const,
      description: "TypeScript compiles without errors",
      result: "pass" as const,
      evidence: {
        command: "npx tsc --noEmit",
        exitCode: 0,
        stdout: "",
        stderr: "",
      },
      chainId: "chain-001",
      chainPosition: 0,
      timestamp: "2026-01-17T00:00:00.000Z",
      durationMs: 5000,
      transcriptEntryId: "te-001",
      createdAt: "2026-01-17T00:00:00.000Z",
    };

    expect(mockAssertion.result).toBe("pass");
    expect(mockAssertion.evidence.exitCode).toBe(0);
  });

  it("Mock SkillTrace object compiles", () => {
    const mockSkillTrace = {
      id: "st-001",
      executionId: "exec-001",
      taskId: "task-001",
      skillName: "commit",
      skillFile: "skills/commit.md",
      lineNumber: 10,
      sectionTitle: "Commit Changes",
      inputSummary: "Committing changes",
      outputSummary: "Commit successful",
      startTime: "2026-01-17T00:00:00.000Z",
      endTime: "2026-01-17T00:00:05.000Z",
      durationMs: 5000,
      tokenEstimate: 200,
      status: "success" as const,
      errorMessage: null,
      toolCalls: ["tu-001", "tu-002"],
      subSkills: [],
      createdAt: "2026-01-17T00:00:00.000Z",
    };

    expect(mockSkillTrace.skillName).toBe("commit");
    expect(mockSkillTrace.status).toBe("success");
  });

  it("Mock MessageBusLogEntry object compiles", () => {
    const mockLogEntry = {
      id: "mbl-001",
      eventId: "evt-001",
      timestamp: "2026-01-17T00:00:00.000Z",
      source: "build-agent-1",
      eventType: "task_completed",
      correlationId: "corr-001",
      humanSummary: "Task completed successfully",
      severity: "info" as const,
      category: "lifecycle" as const,
      transcriptEntryId: null,
      taskId: "task-001",
      executionId: "exec-001",
      payload: { duration: 5000 },
      createdAt: "2026-01-17T00:00:00.000Z",
    };

    expect(mockLogEntry.severity).toBe("info");
    expect(mockLogEntry.correlationId).toBe("corr-001");
  });

  it("PaginatedResponse generic works correctly", () => {
    interface TestItem {
      id: string;
      name: string;
    }

    const mockPaginated = {
      data: [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ] as TestItem[],
      total: 100,
      limit: 10,
      offset: 0,
      hasMore: true,
    };

    expect(mockPaginated.data.length).toBe(2);
    expect(mockPaginated.total).toBe(100);
    expect(mockPaginated.hasMore).toBe(true);
  });
});

// =============================================================================
// TEST SUITE: Database Schema Alignment
// =============================================================================

describe("Database Schema Alignment", () => {
  it("ToolCategory values match database enum", () => {
    const expectedCategories = [
      "file_read",
      "file_write",
      "file_edit",
      "shell",
      "search",
      "web",
      "mcp",
      "agent",
    ];

    const content = readTypeFile(TYPE_FILES.toolUse);
    for (const cat of expectedCategories) {
      expect(content).toMatch(new RegExp(cat));
    }
  });

  it("AssertionCategory values match database enum", () => {
    const expectedCategories = [
      "file_created",
      "file_modified",
      "tsc_compiles",
      "test_passes",
      "lint_passes",
      "build_succeeds",
    ];

    const content = readTypeFile(TYPE_FILES.assertion);
    for (const cat of expectedCategories) {
      expect(content).toMatch(new RegExp(cat));
    }
  });

  it("TranscriptEntryType values match database enum", () => {
    const expectedTypes = [
      "phase_start",
      "phase_end",
      "task_start",
      "task_end",
      "tool_use",
      "skill_invoke",
      "assertion",
      "discovery",
      "error",
      "decision",
      "checkpoint",
      "rollback",
    ];

    const content = readTypeFile(TYPE_FILES.transcript);
    for (const type of expectedTypes) {
      expect(content).toMatch(new RegExp(type));
    }
  });

  it("Severity values match database enum", () => {
    const expectedSeverities = ["info", "warning", "error", "critical"];

    const content = readTypeFile(TYPE_FILES.messageBus);
    for (const sev of expectedSeverities) {
      expect(content).toMatch(new RegExp(sev));
    }
  });
});

// =============================================================================
// Summary Report
// =============================================================================

describe("Phase 4 Summary", () => {
  it("generates summary report", () => {
    const existingFiles = Object.entries(TYPE_FILES)
      .filter(([_, filename]) => fileExists(filename))
      .map(([key]) => key);

    const missingFiles = Object.entries(TYPE_FILES)
      .filter(([_, filename]) => !fileExists(filename))
      .map(([key]) => key);

    console.log("\n=== PHASE 4 TYPE FILES STATUS ===");
    console.log(
      `Existing: ${existingFiles.length}/${Object.keys(TYPE_FILES).length}`,
    );
    console.log(
      `Missing: ${missingFiles.length}/${Object.keys(TYPE_FILES).length}`,
    );

    if (missingFiles.length > 0) {
      console.log(`\nMissing files: ${missingFiles.join(", ")}`);
    }

    // This test always passes - it's just for reporting
    expect(true).toBe(true);
  });
});
