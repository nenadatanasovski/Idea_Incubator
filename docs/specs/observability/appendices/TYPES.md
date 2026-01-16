# Observability Appendix A: TypeScript Type Definitions

> **Navigation:** [Documentation Index](../../DOCUMENTATION-INDEX.md) > [Observability Spec](../SPEC.md) > Appendix A: Types
> **Location:** `docs/specs/observability/appendices/TYPES.md`
> **Purpose:** Complete TypeScript type definitions for the observability system
> **Usage:** Copy these types to `server/types/observability.ts`

---

## Table of Contents

1. [Transcript Types](#1-transcript-types)
2. [Tool Use Types](#2-tool-use-types)
3. [Skill Trace Types](#3-skill-trace-types)
4. [Assertion Types](#4-assertion-types)
5. [Message Bus Types](#5-message-bus-types)
6. [WebSocket Types](#6-websocket-types)
7. [Deep Linking Types](#7-deep-linking-types)
8. [UI Component Types](#8-ui-component-types)

---

## 1. Transcript Types

### 1.1 TranscriptEntry

```typescript
/**
 * A single entry in the unified transcript.
 * Each line in the JSONL transcript file is one TranscriptEntry.
 */
interface TranscriptEntry {
  // === IDENTITY ===
  id: string; // UUID for this entry
  timestamp: string; // ISO8601 with milliseconds
  sequence: number; // Monotonic sequence within execution

  // === CONTEXT ===
  executionId: string; // Execution run ID
  taskId?: string; // Current task (if applicable)
  instanceId: string; // Build Agent instance ID
  waveNumber: number; // Parallel execution wave

  // === EVENT ===
  entryType: TranscriptEntryType;
  category: EntryCategory;

  // === CONTENT ===
  summary: string; // Human-readable summary (max 200 chars)
  details: Record<string, any>; // Structured details (type-specific)

  // === TRACEABILITY ===
  skillRef?: SkillReference; // If skill was invoked
  toolCalls?: ToolCall[]; // Tools used in this entry
  assertions?: AssertionResult[]; // Test assertions (if validation)

  // === METRICS ===
  durationMs?: number; // Time taken for this operation
  tokenEstimate?: number; // Estimated tokens used
}
```

### 1.2 TranscriptEntryType

```typescript
/**
 * All possible transcript entry types.
 */
type TranscriptEntryType =
  | "phase_start" // PIV phase beginning
  | "phase_end" // PIV phase completion
  | "task_start" // Task execution beginning
  | "task_end" // Task execution completion
  | "tool_use" // Tool invocation
  | "skill_invoke" // Skill invocation
  | "skill_complete" // Skill completion
  | "decision" // Agent decision point
  | "validation" // Validation check
  | "assertion" // Test assertion
  | "discovery" // Knowledge discovery
  | "error" // Error occurred
  | "checkpoint" // Checkpoint created/restored
  | "lock_acquire" // File lock acquired
  | "lock_release"; // File lock released
```

### 1.3 EntryCategory

```typescript
/**
 * Categories for grouping transcript entries.
 */
type EntryCategory =
  | "lifecycle" // Execution flow events
  | "action" // File/code modifications
  | "validation" // Tests and assertions
  | "knowledge" // Learning and discoveries
  | "coordination"; // Locks, waves, handoffs
```

---

## 2. Tool Use Types

### 2.1 ToolUse

```typescript
/**
 * Complete record of a single tool invocation.
 * This is the atomic unit of agent action logging.
 */
interface ToolUse {
  // === IDENTITY ===
  id: string; // UUID for this tool use
  executionId: string; // Parent execution
  taskId?: string; // Current task (if applicable)
  transcriptEntryId: string; // Link to transcript entry

  // === TOOL IDENTITY ===
  tool: ToolName; // Tool that was invoked
  toolCategory: ToolCategory; // Category for filtering

  // === INVOCATION ===
  input: ToolInput; // Full input (structured)
  inputSummary: string; // Human-readable summary (max 200 chars)

  // === RESULT ===
  resultStatus: ToolResultStatus;
  output?: ToolOutput; // Full output (structured)
  outputSummary: string; // Human-readable summary (max 500 chars)

  // === ERROR HANDLING ===
  isError: boolean;
  isBlocked: boolean; // Security-blocked command
  errorMessage?: string;
  blockReason?: string; // Why command was blocked

  // === METRICS ===
  startTime: string; // ISO8601
  endTime: string; // ISO8601
  durationMs: number;

  // === CONTEXT ===
  withinSkill?: string; // Skill ID if invoked during skill execution
  parentToolUseId?: string; // For nested tool calls
}
```

### 2.2 ToolResultStatus

```typescript
/**
 * Result status follows autonomous-coding pattern:
 * - done: Tool executed successfully
 * - error: Tool failed with error
 * - blocked: Security hook blocked execution
 */
type ToolResultStatus = "done" | "error" | "blocked";
```

### 2.3 ToolName

```typescript
/**
 * Tools available to Build Agents.
 * Matches Claude SDK built-in tools + MCP tools.
 */
type ToolName =
  // File operations
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  // System operations
  | "Bash"
  // MCP Puppeteer tools
  | "mcp__puppeteer__puppeteer_navigate"
  | "mcp__puppeteer__puppeteer_screenshot"
  | "mcp__puppeteer__puppeteer_click"
  | "mcp__puppeteer__puppeteer_fill"
  | "mcp__puppeteer__puppeteer_select"
  | "mcp__puppeteer__puppeteer_hover"
  | "mcp__puppeteer__puppeteer_evaluate"
  // Task/Agent tools
  | "Task"
  | "WebFetch"
  | "WebSearch"
  // Custom tools
  | string;
```

### 2.4 ToolCategory

```typescript
/**
 * Categories for grouping tool uses.
 */
type ToolCategory =
  | "file_read" // Read, Glob, Grep
  | "file_write" // Write, Edit
  | "shell" // Bash
  | "browser" // MCP Puppeteer
  | "network" // WebFetch, WebSearch
  | "agent" // Task (sub-agent)
  | "custom"; // Other tools
```

### 2.5 Tool Input Types

```typescript
/**
 * Structured tool inputs by tool type.
 */
type ToolInput =
  | ReadInput
  | WriteInput
  | EditInput
  | GlobInput
  | GrepInput
  | BashInput
  | PuppeteerInput
  | GenericInput;

interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

interface WriteInput {
  file_path: string;
  content: string; // Full content (logged in full for auditability)
}

interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

interface GlobInput {
  pattern: string;
  path?: string;
}

interface GrepInput {
  pattern: string;
  path?: string;
  output_mode?: "content" | "files_with_matches" | "count";
}

interface BashInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
}

interface PuppeteerInput {
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
}

interface GenericInput {
  [key: string]: any;
}
```

### 2.6 Tool Output Types

```typescript
/**
 * Structured tool outputs by tool type.
 */
type ToolOutput =
  | ReadOutput
  | WriteOutput
  | EditOutput
  | BashOutput
  | GenericOutput;

interface ReadOutput {
  success: boolean;
  content?: string; // File content (truncated in summary)
  lineCount?: number;
  charCount?: number;
}

interface WriteOutput {
  success: boolean;
  path: string;
  bytesWritten: number;
}

interface EditOutput {
  success: boolean;
  path: string;
  replacements: number;
}

interface BashOutput {
  exitCode: number;
  stdout: string; // Full stdout
  stderr: string; // Full stderr
  durationMs: number;
}

interface GenericOutput {
  success: boolean;
  [key: string]: any;
}
```

### 2.7 Security Hook Types

```typescript
/**
 * Security hook for Bash commands.
 * Implements allowlist-based validation.
 */
interface SecurityHookResult {
  decision: "allow" | "block";
  reason?: string; // Required if blocked
}

/**
 * Allowed commands for Build Agents (defense-in-depth).
 */
const ALLOWED_BASH_COMMANDS = {
  file_inspection: ["ls", "cat", "head", "tail", "wc", "grep", "find"],
  node: ["npm", "npx", "node"],
  vcs: ["git"],
  process: ["ps", "lsof", "sleep", "pkill"],
  build: ["tsc", "eslint", "prettier", "vitest", "jest"],
  custom: ["init.sh"],
} as const;

/**
 * Commands requiring extra validation.
 */
const COMMANDS_NEEDING_EXTRA_VALIDATION = ["pkill", "chmod", "rm"] as const;
```

### 2.8 Tool Use Stream Event

```typescript
/**
 * Real-time tool use event for streaming.
 */
interface ToolUseStreamEvent {
  type: "tool_start" | "tool_end" | "tool_output";
  toolUseId: string;
  timestamp: string;

  // For tool_start
  tool?: ToolName;
  inputSummary?: string;

  // For tool_end
  resultStatus?: ToolResultStatus;
  durationMs?: number;

  // For tool_output (streaming)
  chunk?: string;
  isStderr?: boolean;
}
```

### 2.9 Tool Aggregation Summary

```typescript
/**
 * Aggregated tool usage statistics for an execution.
 */
interface ToolUsageAggregation {
  executionId: string;
  totalToolUses: number;

  byTool: Record<
    ToolName,
    {
      count: number;
      success: number;
      error: number;
      blocked: number;
      avgDurationMs: number;
    }
  >;

  byCategory: Record<
    ToolCategory,
    {
      count: number;
      success: number;
      error?: number;
      blocked?: number;
    }
  >;

  errors: Array<{
    toolUseId: string;
    tool: ToolName;
    inputSummary: string;
    errorMessage: string;
    timestamp: string;
  }>;

  blocked: Array<{
    toolUseId: string;
    tool: ToolName;
    inputSummary: string;
    blockReason: string;
    timestamp: string;
  }>;

  timeline: {
    firstToolUse: string;
    lastToolUse: string;
    totalDurationMs: number;
  };
}
```

### 2.10 Tool Use Query

```typescript
/**
 * Query parameters for filtering tool uses.
 * API: GET /api/executions/{id}/tool-uses
 */
interface ToolUseQuery {
  tools?: ToolName[]; // Filter by tool
  categories?: ToolCategory[]; // Filter by category
  status?: ToolResultStatus[]; // Filter by result status
  taskId?: string; // Filter by task
  since?: string; // ISO8601 timestamp
  until?: string; // ISO8601 timestamp
  limit?: number; // Max results (default 100)
  includeInputs?: boolean; // Include full inputs (default false)
  includeOutputs?: boolean; // Include full outputs (default false)
}
```

---

## 3. Skill Trace Types

### 3.1 SkillReference

```typescript
/**
 * Reference to a skill invocation.
 */
interface SkillReference {
  // === IDENTITY ===
  skillName: string; // Skill identifier (e.g., "code-generation")
  skillFile: string; // Path to skill definition file

  // === SOURCE LOCATION ===
  lineNumber: number; // Line in skill file where definition starts
  sectionTitle: string; // Section heading in skill file

  // === INVOCATION ===
  inputSummary: string; // Summarized inputs (max 500 chars)
  outputSummary: string; // Summarized outputs (max 500 chars)

  // === METRICS ===
  startTime: string; // ISO8601
  endTime: string; // ISO8601
  tokenEstimate: number; // Estimated tokens used by skill

  // === OUTCOME ===
  status: "success" | "partial" | "failed";
  errorMessage?: string;
}
```

### 3.2 SkillTrace

```typescript
/**
 * Full trace of a skill invocation.
 */
interface SkillTrace {
  id: string; // Trace ID
  executionId: string; // Parent execution
  taskId: string; // Task that invoked skill

  // === SKILL IDENTITY ===
  skill: SkillReference;

  // === NESTED OPERATIONS ===
  toolCalls: ToolCall[]; // Tools used within skill
  subSkills: SkillTrace[]; // Skills invoked by this skill

  // === TIMELINE ===
  entries: TranscriptEntry[]; // All transcript entries during skill

  // === ASSERTIONS ===
  assertions: AssertionResult[]; // Assertions made by skill
}
```

### 3.3 Skills Usage Summary

```typescript
/**
 * Summary of all skill usage in an execution.
 */
interface SkillsUsageSummary {
  executionId: string;
  totalSkillInvocations: number;
  uniqueSkillsUsed: number;

  skills: Array<{
    skillName: string;
    skillFile: string;
    invocationCount: number;
    totalDurationMs: number;
    successRate: number;
    sections: Array<{
      section: string;
      count: number;
    }>;
  }>;

  skillFileReferences: Array<{
    file: string;
    linesReferenced: number[];
    sectionsUsed: string[];
  }>;
}
```

---

## 4. Assertion Types

### 4.1 AssertionResult

```typescript
/**
 * Result of a single assertion.
 */
interface AssertionResult {
  // === IDENTITY ===
  id: string; // Assertion ID
  taskId: string; // Task being validated
  executionId: string; // Execution context

  // === ASSERTION ===
  category: AssertionCategory;
  description: string; // What we're asserting

  // === RESULT ===
  result: "pass" | "fail" | "skip" | "warn";

  // === EVIDENCE ===
  evidence: AssertionEvidence;

  // === METADATA ===
  timestamp: string;
  durationMs: number;
}
```

### 4.2 AssertionCategory

```typescript
/**
 * Categories of assertions.
 */
type AssertionCategory =
  | "file_created" // File exists after CREATE
  | "file_modified" // File changed after UPDATE
  | "file_deleted" // File removed after DELETE
  | "typescript_compiles" // tsc --noEmit passes
  | "lint_passes" // Linting passes
  | "tests_pass" // Unit tests pass
  | "api_responds" // API endpoint responds correctly
  | "schema_valid" // Database schema valid
  | "dependency_met"; // Dependency requirements satisfied
```

### 4.3 AssertionEvidence

```typescript
/**
 * Evidence supporting an assertion result.
 */
interface AssertionEvidence {
  // === COMMAND EVIDENCE ===
  command?: string; // Command executed
  exitCode?: number; // Exit code
  stdout?: string; // Stdout (truncated to 1000 chars)
  stderr?: string; // Stderr (truncated to 1000 chars)

  // === FILE EVIDENCE ===
  filePath?: string; // File in question
  fileExists?: boolean; // Does file exist
  fileSizeBefore?: number; // Size before (for UPDATE)
  fileSizeAfter?: number; // Size after
  diffPath?: string; // Path to diff file

  // === API EVIDENCE ===
  endpoint?: string; // API endpoint tested
  statusCode?: number; // HTTP status
  responseTime?: number; // Response time in ms
  responseBodySample?: string; // Sample of response (truncated)

  // === CUSTOM EVIDENCE ===
  custom?: Record<string, any>; // Category-specific evidence
}
```

### 4.4 AssertionChain

```typescript
/**
 * Ordered chain of assertions for a task.
 */
interface AssertionChain {
  taskId: string;
  chainId: string;
  description: string; // What this chain validates

  assertions: AssertionResult[]; // Ordered assertions

  // === CHAIN RESULT ===
  overallResult: "pass" | "fail" | "partial";
  passCount: number;
  failCount: number;
  skipCount: number;

  // === FAILURE ANALYSIS ===
  firstFailure?: {
    assertionId: string;
    description: string;
    evidence: AssertionEvidence;
  };
}
```

### 4.5 Assertions Summary

```typescript
/**
 * Summary of all assertions in an execution.
 */
interface AssertionsSummary {
  executionId: string;

  summary: {
    totalAssertions: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
    passRate: number;
  };

  byCategory: Record<
    AssertionCategory,
    {
      total: number;
      passed: number;
      failed?: number;
      skipped?: number;
    }
  >;

  failures: Array<{
    assertionId: string;
    taskId: string;
    category: AssertionCategory;
    description: string;
    evidence: AssertionEvidence;
    transcriptRef: string;
  }>;

  chains: Array<{
    taskId: string;
    chainId: string;
    result: "pass" | "fail" | "partial";
    assertions: string[];
  }>;
}
```

---

## 5. Message Bus Types

### 5.1 MessageBusLogEntry

```typescript
/**
 * Human-readable log entry from Message Bus.
 */
interface MessageBusLogEntry {
  // From original event
  eventId: string;
  timestamp: string;
  source: string;
  eventType: string;
  correlationId?: string;

  // Human-readable additions
  humanSummary: string; // Plain English description
  severity: "info" | "warning" | "error" | "critical";
  category: "lifecycle" | "coordination" | "failure" | "decision";

  // Links
  transcriptEntryId?: string; // Link to transcript entry
  taskId?: string;
  executionId?: string;

  // Payload (filtered for readability)
  payload: Record<string, any>;
}
```

### 5.2 MessageBusLogQuery

```typescript
/**
 * Query parameters for Message Bus log.
 * API: GET /api/logs/message-bus
 */
interface MessageBusLogQuery {
  since?: string; // ISO8601 timestamp
  until?: string; // ISO8601 timestamp
  eventTypes?: string[]; // Filter by event type
  sources?: string[]; // Filter by source
  severity?: string[]; // Filter by severity
  correlationId?: string; // Get related events
  limit?: number; // Max entries (default 100)
}

/**
 * Response from Message Bus log query.
 */
interface MessageBusLogResponse {
  entries: MessageBusLogEntry[];
  hasMore: boolean;
  nextCursor?: string;
}
```

---

## 6. WebSocket Types

### 6.1 ObservabilityWebSocket

```typescript
/**
 * WebSocket connection for real-time observability updates.
 * Single multiplexed connection handles all log streams.
 */
interface ObservabilityWebSocket {
  url: "ws://localhost:3001/ws?monitor=observability";

  // === SUBSCRIPTION TOPICS ===
  topics: {
    "transcript:*": boolean; // All transcript entries
    "transcript:{execId}": boolean; // Specific execution
    "tooluse:*": boolean; // All tool uses
    "tooluse:{execId}": boolean; // Tool uses for execution
    "assertion:*": boolean; // All assertions
    "skill:*": boolean; // All skill traces
    "messagebus:*": boolean; // Message bus events
  };
}
```

### 6.2 ObservabilityEvent

```typescript
/**
 * Real-time events streamed to UI.
 */
type ObservabilityEvent =
  | TranscriptStreamEvent
  | ToolUseWsStreamEvent
  | AssertionStreamEvent
  | SkillStreamEvent
  | MessageBusStreamEvent;

interface TranscriptStreamEvent {
  type: "transcript:entry";
  executionId: string;
  entry: TranscriptEntry;
  // For live scroll-to-bottom behavior
  isLatest: boolean;
}

interface ToolUseWsStreamEvent {
  type: "tooluse:start" | "tooluse:end" | "tooluse:output";
  executionId: string;
  toolUseId: string;

  // For tooluse:start
  tool?: ToolName;
  inputSummary?: string;

  // For tooluse:end
  resultStatus?: ToolResultStatus;
  durationMs?: number;

  // For tooluse:output (streaming bash output)
  chunk?: string;
  isStderr?: boolean;
}

interface AssertionStreamEvent {
  type: "assertion:result";
  executionId: string;
  taskId: string;
  assertion: AssertionResult;
  // Update sparkline in real-time
  runningPassRate: number;
}

interface SkillStreamEvent {
  type: "skill:start" | "skill:end";
  executionId: string;
  skillTraceId: string;
  skillName: string;
  status?: "success" | "partial" | "failed";
}

interface MessageBusStreamEvent {
  type: "messagebus:event";
  entry: MessageBusLogEntry;
  // Highlight if requires attention
  requiresAction: boolean;
}
```

### 6.3 useObservabilityStream Hook

```typescript
/**
 * React hook for observability WebSocket.
 * @param executionId - Optional execution ID to filter events
 * @returns Connection state and events array
 */
function useObservabilityStream(executionId?: string): {
  isConnected: boolean;
  events: ObservabilityEvent[];
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
};

// Implementation reference
const useObservabilityStreamImpl = (executionId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<ObservabilityEvent[]>([]);

  useEffect(() => {
    const ws = new WebSocket(
      `ws://localhost:3001/ws?monitor=observability` +
        (executionId ? `&execution=${executionId}` : ""),
    );

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => {
      setIsConnected(false);
      // Exponential backoff reconnection
      setTimeout(() => reconnect(), getBackoffDelay());
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data) as ObservabilityEvent;
      setEvents((prev) => [...prev.slice(-1000), data]); // Keep last 1000
    };

    return () => ws.close();
  }, [executionId]);

  return { isConnected, events };
};
```

---

## 7. Deep Linking Types

### 7.1 Deep Link Patterns

```typescript
/**
 * URL patterns for deep linking.
 */
const DEEP_LINK_PATTERNS = {
  // Execution-level views
  execution: "/observability/executions/{executionId}",
  executionTimeline: "/observability/executions/{executionId}/timeline",
  executionToolUses: "/observability/executions/{executionId}/tool-uses",
  executionAssertions: "/observability/executions/{executionId}/assertions",
  executionSkills: "/observability/executions/{executionId}/skills",

  // Entity-level views
  transcriptEntry:
    "/observability/executions/{executionId}/transcript/{entryId}",
  toolUse: "/observability/executions/{executionId}/tool-uses/{toolUseId}",
  assertion: "/observability/executions/{executionId}/assertions/{assertionId}",
  skillTrace: "/observability/executions/{executionId}/skills/{skillTraceId}",

  // Cross-reference views (show entity with context)
  toolUseInContext:
    "/observability/executions/{executionId}/tool-uses/{toolUseId}?context=transcript",
  assertionWithEvidence:
    "/observability/executions/{executionId}/assertions/{assertionId}?expand=evidence",

  // Message bus
  messageBusEvent: "/observability/message-bus/{eventId}",
  messageBusCorrelated:
    "/observability/message-bus?correlationId={correlationId}",
} as const;

type DeepLinkPattern = keyof typeof DEEP_LINK_PATTERNS;
```

### 7.2 EntityCrossReferences

```typescript
/**
 * Internal cross-reference links.
 * Every entity knows its related entities.
 */
interface EntityCrossReferences {
  // Tool use knows...
  toolUse: {
    transcriptEntry: string; // Transcript entry that logged this
    task?: string; // Task it belongs to
    skill?: string; // Skill that invoked it (if any)
    parentToolUse?: string; // Parent tool use (if nested)
    childToolUses: string[]; // Child tool uses (if parent)
    relatedAssertions: string[]; // Assertions that used this as evidence
  };

  // Assertion knows...
  assertion: {
    task: string; // Task being validated
    chain?: string; // Assertion chain it belongs to
    transcriptEntries: string[]; // Transcript entries related to this
    toolUses: string[]; // Tool uses that provide evidence
    previousInChain?: string; // Previous assertion in chain
    nextInChain?: string; // Next assertion in chain
  };

  // Skill trace knows...
  skillTrace: {
    task: string; // Task that invoked skill
    transcriptEntries: string[]; // All transcript entries during skill
    toolUses: string[]; // All tool uses during skill
    assertions: string[]; // Assertions made by skill
    parentSkill?: string; // Parent skill (if nested)
    childSkills: string[]; // Child skills (if parent)
  };

  // Transcript entry knows...
  transcriptEntry: {
    execution: string; // Execution it belongs to
    task?: string; // Task (if applicable)
    toolUse?: string; // Tool use (if tool_use entry)
    skill?: string; // Skill (if skill_invoke entry)
    assertion?: string; // Assertion (if assertion entry)
    previousEntry?: string; // Previous in sequence
    nextEntry?: string; // Next in sequence
  };
}

/**
 * Service for resolving cross-references.
 */
interface CrossReferenceService {
  getCrossReferences(
    entityType: keyof EntityCrossReferences,
    entityId: string,
  ): Promise<EntityCrossReferences[typeof entityType]>;
  getRelatedEntities(
    entityType: keyof EntityCrossReferences,
    entityId: string,
  ): Promise<RelatedEntitiesResult>;
}

interface RelatedEntitiesResult {
  transcriptEntries: TranscriptEntry[];
  toolUses: ToolUse[];
  assertions: AssertionResult[];
  skillTraces: SkillTrace[];
}
```

---

## 8. UI Component Types

### 8.1 Component Hierarchy

```typescript
/**
 * Component tree for Observability Hub integration.
 */
const componentHierarchy = {
  AgentDashboard: {
    TabBar: {
      // ... existing tabs
      ObservabilityTab: {
        /* NEW */
      },
    },
    TabContent: {
      // ... existing content
      ObservabilityHub: {
        /* NEW */ QuickStats: {},
        ViewSelector: {},
        ViewContainer: {
          ExecutionTimeline: {
            PhaseGantt: {},
            TaskGantt: {},
            ToolDensityChart: {},
            EventMarkers: {},
          },
          ToolUseHeatMap: {
            HeatMapGrid: {},
            AnomalyPanel: {},
          },
          AssertionDashboard: {
            OverallHealth: {},
            CategorySparklines: {},
            FailureList: {},
            AssertionChains: {},
          },
          SkillFlowDiagram: {
            FlowCanvas: {},
            SkillNode: {},
            ToolNode: {},
            AssertionNode: {},
          },
          UnifiedLogViewer: {
            LogStream: {},
            FilterBar: {},
            SearchBox: {},
          },
        },
        DeepLinkPanel: {
          Breadcrumb: {},
          EntityDetails: {},
          CrossReferences: {},
        },
      },
    },
  },
} as const;
```

### 8.2 QuickStats Props

```typescript
/**
 * Props for QuickStats component.
 */
interface QuickStatsProps {
  executionId?: string; // Filter to specific execution
  refreshIntervalMs?: number; // Auto-refresh interval (default: 1000)
}

interface QuickStatsData {
  activeExecutions: number;
  toolCallsPerMinute: number;
  passRate: number;
  errorCount: number;
  blockedCount: number;
  discoveriesCount: number;
}
```

### 8.3 ExecutionTimeline Props

```typescript
/**
 * Props for ExecutionTimeline component.
 */
interface ExecutionTimelineProps {
  executionId: string;
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (entryId: string) => void;
  zoomLevel?: number; // 0.5 to 4 (default: 1)
  showToolDensity?: boolean; // Show tool use density chart
  showEventMarkers?: boolean; // Show vertical event markers
}
```

### 8.4 ToolUseHeatMap Props

```typescript
/**
 * Props for ToolUseHeatMap component.
 */
interface ToolUseHeatMapProps {
  executionId?: string; // Filter to specific execution
  period: "hour" | "day" | "week";
  showAnomalies?: boolean; // Show anomaly detection panel
  onCellClick?: (toolUseId: string) => void;
}
```

### 8.5 AssertionSparklines Props

```typescript
/**
 * Props for AssertionSparklines component.
 */
interface AssertionSparklinesProps {
  executionId: string;
  showChains?: boolean; // Show assertion chains visualization
  onFailureClick?: (assertionId: string) => void;
}
```

### 8.6 SkillFlowDiagram Props

```typescript
/**
 * Props for SkillFlowDiagram component.
 */
interface SkillFlowDiagramProps {
  taskId: string;
  executionId: string;
  onNodeClick?: (
    nodeType: "skill" | "tool" | "assertion",
    nodeId: string,
  ) => void;
  exportFormat?: "svg" | "mermaid" | "png";
}
```

### 8.7 DeepLinkPanel Props

```typescript
/**
 * Props for DeepLinkPanel component.
 */
interface DeepLinkPanelProps {
  entityType: keyof EntityCrossReferences;
  entityId: string;
  executionId: string;
  onNavigate?: (path: string) => void;
}
```

---

## Export Statement

```typescript
// server/types/observability.ts

export type {
  // Transcript
  TranscriptEntry,
  TranscriptEntryType,
  EntryCategory,

  // Tool Use
  ToolUse,
  ToolResultStatus,
  ToolName,
  ToolCategory,
  ToolInput,
  ReadInput,
  WriteInput,
  EditInput,
  GlobInput,
  GrepInput,
  BashInput,
  PuppeteerInput,
  GenericInput,
  ToolOutput,
  ReadOutput,
  WriteOutput,
  EditOutput,
  BashOutput,
  GenericOutput,
  SecurityHookResult,
  ToolUseStreamEvent,
  ToolUsageAggregation,
  ToolUseQuery,

  // Skill
  SkillReference,
  SkillTrace,
  SkillsUsageSummary,

  // Assertion
  AssertionResult,
  AssertionCategory,
  AssertionEvidence,
  AssertionChain,
  AssertionsSummary,

  // Message Bus
  MessageBusLogEntry,
  MessageBusLogQuery,
  MessageBusLogResponse,

  // WebSocket
  ObservabilityWebSocket,
  ObservabilityEvent,
  TranscriptStreamEvent,
  ToolUseWsStreamEvent,
  AssertionStreamEvent,
  SkillStreamEvent,
  MessageBusStreamEvent,

  // Deep Linking
  DeepLinkPattern,
  EntityCrossReferences,
  CrossReferenceService,
  RelatedEntitiesResult,

  // UI Components
  QuickStatsProps,
  QuickStatsData,
  ExecutionTimelineProps,
  ToolUseHeatMapProps,
  AssertionSparklinesProps,
  SkillFlowDiagramProps,
  DeepLinkPanelProps,
};

export {
  DEEP_LINK_PATTERNS,
  ALLOWED_BASH_COMMANDS,
  COMMANDS_NEEDING_EXTRA_VALIDATION,
};
```

---

_Copy this file to `server/types/observability.ts` and import as needed._
