# Observability System Implementation Plan - Phase 4: TypeScript Types

> **Location:** `docs/specs/observability/implementation-plan-phase-4.md`
> **Purpose:** Actionable implementation plan for TypeScript type definitions
> **Status:** Ready for execution
> **Priority:** P1 (Required for API and UI phases)
> **Dependencies:** Phase 1 (Database Schema)

---

## Executive Summary

Phase 4 creates all TypeScript type definitions required by the API routes (Phase 5) and UI components (Phase 7-10). Types are derived from the [appendices/TYPES.md](./appendices/TYPES.md) specification.

| Scope               | Details                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| **Type Files**      | `frontend/src/types/observability.ts`, `server/types/observability.ts` |
| **Tasks**           | OBS-200 to OBS-212                                                     |
| **Deliverables**    | Complete TypeScript interfaces for all observability data              |
| **Test Validation** | TypeScript compilation passes, all types are importable                |

---

## File Organization

```
frontend/src/types/
├── observability.ts          # Frontend types (shared subset)
│
server/types/
├── observability.ts          # Backend types (full set)
├── observability-api.ts      # API request/response types
├── observability-websocket.ts # WebSocket event types
```

---

## Task Breakdown

### OBS-200: Create Core Transcript Types

**File:** `server/types/observability.ts`

**Purpose:** Define transcript entry types and enums.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 1: Transcript Types

/**
 * All possible transcript entry types.
 */
export type TranscriptEntryType =
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

/**
 * Categories for grouping transcript entries.
 */
export type EntryCategory =
  | "lifecycle" // Execution flow events
  | "action" // File/code modifications
  | "validation" // Tests and assertions
  | "knowledge" // Learning and discoveries
  | "coordination"; // Locks, waves, handoffs

/**
 * A single entry in the unified transcript.
 */
export interface TranscriptEntry {
  // === IDENTITY ===
  id: string; // UUID for this entry
  timestamp: string; // ISO8601 with milliseconds
  sequence: number; // Monotonic sequence within execution

  // === CONTEXT ===
  executionId: string; // Execution run ID
  taskId?: string; // Current task (if applicable)
  instanceId: string; // Build Agent instance ID
  waveNumber?: number; // Parallel execution wave

  // === EVENT ===
  entryType: TranscriptEntryType;
  category: EntryCategory;

  // === CONTENT ===
  summary: string; // Human-readable summary (max 200 chars)
  details: Record<string, unknown>; // Structured details (type-specific)

  // === TRACEABILITY ===
  skillRef?: SkillReference; // If skill was invoked
  toolCalls?: ToolCall[]; // Tools used in this entry
  assertions?: AssertionResult[]; // Test assertions (if validation)

  // === METRICS ===
  durationMs?: number; // Time taken for this operation
  tokenEstimate?: number; // Estimated tokens used
}

/**
 * Input for creating a transcript entry (without generated fields).
 */
export interface TranscriptEntryInput {
  entryType: TranscriptEntryType;
  category: EntryCategory;
  summary: string;
  taskId?: string;
  details?: Record<string, unknown>;
  skillRef?: SkillReference;
  durationMs?: number;
  tokenEstimate?: number;
}
```

#### Acceptance Criteria

- [ ] `TranscriptEntryType` enum includes all 15 entry types
- [ ] `EntryCategory` enum includes all 5 categories
- [ ] `TranscriptEntry` interface includes all fields from schema
- [ ] `TranscriptEntryInput` provides creation interface
- [ ] Types export without TypeScript errors

---

### OBS-201: Create Tool Use Types

**File:** `server/types/observability.ts`

**Purpose:** Define tool invocation types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 2: Tool Use Types

/**
 * Result status for tool execution.
 */
export type ToolResultStatus = "done" | "error" | "blocked";

/**
 * Tools available to Build Agents.
 */
export type ToolName =
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

/**
 * Categories for grouping tool uses.
 */
export type ToolCategory =
  | "file_read" // Read, Glob, Grep
  | "file_write" // Write, Edit
  | "shell" // Bash
  | "browser" // MCP Puppeteer
  | "network" // WebFetch, WebSearch
  | "agent" // Task (sub-agent)
  | "custom"; // Other tools

/**
 * Complete record of a single tool invocation.
 */
export interface ToolUse {
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
  withinSkill?: string; // Skill ID if invoked during skill
  parentToolUseId?: string; // For nested tool calls
}

/**
 * Simplified tool call reference for transcript entries.
 */
export interface ToolCall {
  toolUseId: string;
  tool: ToolName;
  inputSummary: string;
  resultStatus: ToolResultStatus;
  durationMs: number;
}
```

#### Acceptance Criteria

- [ ] `ToolResultStatus` covers all 3 statuses (done, error, blocked)
- [ ] `ToolName` includes all built-in tools and MCP tools
- [ ] `ToolCategory` covers all 7 categories
- [ ] `ToolUse` interface matches database schema
- [ ] `ToolCall` provides lightweight reference type

---

### OBS-202: Create Tool Input/Output Types

**File:** `server/types/observability.ts`

**Purpose:** Define structured tool input and output types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 3: Tool Input/Output Types

/**
 * Structured tool inputs by tool type.
 */
export type ToolInput =
  | ReadInput
  | WriteInput
  | EditInput
  | GlobInput
  | GrepInput
  | BashInput
  | PuppeteerInput
  | GenericInput;

export interface ReadInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface WriteInput {
  file_path: string;
  content: string;
}

export interface EditInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface GlobInput {
  pattern: string;
  path?: string;
}

export interface GrepInput {
  pattern: string;
  path?: string;
  output_mode?: "content" | "files_with_matches" | "count";
}

export interface BashInput {
  command: string;
  description?: string;
  timeout?: number;
  run_in_background?: boolean;
}

export interface PuppeteerInput {
  url?: string;
  selector?: string;
  value?: string;
  script?: string;
  name?: string;
}

export interface GenericInput {
  [key: string]: unknown;
}

/**
 * Structured tool outputs by tool type.
 */
export type ToolOutput =
  | ReadOutput
  | WriteOutput
  | EditOutput
  | BashOutput
  | GenericOutput;

export interface ReadOutput {
  success: boolean;
  content?: string;
  lineCount?: number;
  charCount?: number;
}

export interface WriteOutput {
  success: boolean;
  path: string;
  bytesWritten: number;
}

export interface EditOutput {
  success: boolean;
  path: string;
  replacements: number;
}

export interface BashOutput {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface GenericOutput {
  success: boolean;
  [key: string]: unknown;
}
```

#### Acceptance Criteria

- [ ] Input types defined for all 7 tool categories
- [ ] Output types defined for file and shell tools
- [ ] Generic types handle custom/unknown tools
- [ ] All types compile without errors

---

### OBS-203: Create Skill Trace Types

**File:** `server/types/observability.ts`

**Purpose:** Define skill invocation types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 4: Skill Trace Types

/**
 * Reference to a skill invocation.
 */
export interface SkillReference {
  // === IDENTITY ===
  skillName: string; // Skill identifier
  skillFile: string; // Path to skill definition file

  // === SOURCE LOCATION ===
  lineNumber: number; // Line in skill file
  sectionTitle: string; // Section heading in skill file

  // === INVOCATION ===
  inputSummary: string; // Summarized inputs (max 500 chars)
  outputSummary: string; // Summarized outputs (max 500 chars)

  // === METRICS ===
  startTime: string; // ISO8601
  endTime: string; // ISO8601
  tokenEstimate: number; // Estimated tokens used

  // === OUTCOME ===
  status: "success" | "partial" | "failed";
  errorMessage?: string;
}

/**
 * Full trace of a skill invocation.
 */
export interface SkillTrace {
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

/**
 * Summary of all skill usage in an execution.
 */
export interface SkillsUsageSummary {
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

#### Acceptance Criteria

- [ ] `SkillReference` includes file:line source location
- [ ] `SkillTrace` supports nested skill invocations
- [ ] `SkillsUsageSummary` provides execution-level aggregation
- [ ] All skill types compile without errors

---

### OBS-204: Create Assertion Types

**File:** `server/types/observability.ts`

**Purpose:** Define assertion and evidence types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 5: Assertion Types

/**
 * Categories of assertions.
 */
export type AssertionCategory =
  | "file_created" // File exists after CREATE
  | "file_modified" // File changed after UPDATE
  | "file_deleted" // File removed after DELETE
  | "typescript_compiles" // tsc --noEmit passes
  | "lint_passes" // Linting passes
  | "tests_pass" // Unit tests pass
  | "api_responds" // API endpoint responds correctly
  | "schema_valid" // Database schema valid
  | "dependency_met"; // Dependency requirements satisfied

/**
 * Assertion result status.
 */
export type AssertionStatus = "pass" | "fail" | "skip" | "warn";

/**
 * Evidence supporting an assertion result.
 */
export interface AssertionEvidence {
  // === COMMAND EVIDENCE ===
  command?: string; // Command executed
  exitCode?: number; // Exit code
  stdout?: string; // Stdout (truncated)
  stderr?: string; // Stderr (truncated)

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
  responseBodySample?: string; // Sample of response

  // === CUSTOM EVIDENCE ===
  custom?: Record<string, unknown>; // Category-specific evidence
}

/**
 * Result of a single assertion.
 */
export interface AssertionResult {
  // === IDENTITY ===
  id: string; // Assertion ID
  taskId: string; // Task being validated
  executionId: string; // Execution context
  chainId?: string; // Assertion chain ID

  // === ASSERTION ===
  category: AssertionCategory;
  description: string; // What we're asserting

  // === RESULT ===
  result: AssertionStatus;

  // === EVIDENCE ===
  evidence: AssertionEvidence;

  // === METADATA ===
  timestamp: string;
  durationMs: number;
}

/**
 * Ordered chain of assertions for a task.
 */
export interface AssertionChain {
  id: string;
  taskId: string;
  executionId: string;
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

/**
 * Summary of all assertions in an execution.
 */
export interface AssertionsSummary {
  executionId: string;

  summary: {
    totalAssertions: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
    passRate: number;
  };

  byCategory: Partial<
    Record<
      AssertionCategory,
      {
        total: number;
        passed: number;
        failed?: number;
        skipped?: number;
      }
    >
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

#### Acceptance Criteria

- [ ] `AssertionCategory` includes all 9 categories
- [ ] `AssertionEvidence` covers command, file, and API evidence
- [ ] `AssertionChain` tracks pass/fail counts
- [ ] `AssertionsSummary` provides execution-level aggregation

---

### OBS-205: Create Message Bus Types

**File:** `server/types/observability.ts`

**Purpose:** Define message bus log types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 6: Message Bus Types

/**
 * Severity levels for message bus entries.
 */
export type LogSeverity = "info" | "warning" | "error" | "critical";

/**
 * Categories for message bus events.
 */
export type MessageBusCategory =
  | "lifecycle"
  | "coordination"
  | "failure"
  | "decision";

/**
 * Human-readable log entry from Message Bus.
 */
export interface MessageBusLogEntry {
  // From original event
  eventId: string;
  timestamp: string;
  source: string;
  eventType: string;
  correlationId?: string;

  // Human-readable additions
  humanSummary: string; // Plain English description
  severity: LogSeverity;
  category: MessageBusCategory;

  // Links
  transcriptEntryId?: string; // Link to transcript entry
  taskId?: string;
  executionId?: string;

  // Payload (filtered for readability)
  payload: Record<string, unknown>;
}
```

#### Acceptance Criteria

- [ ] `LogSeverity` covers all 4 levels
- [ ] `MessageBusCategory` covers all 4 categories
- [ ] `MessageBusLogEntry` links to transcript entries

---

### OBS-206: Create WebSocket Event Types

**File:** `server/types/observability-websocket.ts`

**Purpose:** Define real-time streaming event types.

#### Type Definitions

```typescript
// server/types/observability-websocket.ts

import type {
  TranscriptEntry,
  ToolName,
  ToolResultStatus,
  AssertionResult,
} from "./observability";

/**
 * WebSocket event types for observability streaming.
 */
export type ObservabilityEventType =
  | "transcript:entry"
  | "tooluse:start"
  | "tooluse:end"
  | "tooluse:output"
  | "assertion:result"
  | "skill:start"
  | "skill:end"
  | "messagebus:event";

/**
 * Base interface for all observability events.
 */
export interface BaseObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
}

/**
 * Transcript entry stream event.
 */
export interface TranscriptStreamEvent extends BaseObservabilityEvent {
  type: "transcript:entry";
  executionId: string;
  entry: TranscriptEntry;
  isLatest: boolean; // For live scroll-to-bottom
}

/**
 * Tool use start event.
 */
export interface ToolUseStartEvent extends BaseObservabilityEvent {
  type: "tooluse:start";
  executionId: string;
  toolUseId: string;
  tool: ToolName;
  inputSummary: string;
}

/**
 * Tool use end event.
 */
export interface ToolUseEndEvent extends BaseObservabilityEvent {
  type: "tooluse:end";
  executionId: string;
  toolUseId: string;
  resultStatus: ToolResultStatus;
  durationMs: number;
  outputSummary?: string;
}

/**
 * Tool output streaming event.
 */
export interface ToolUseOutputEvent extends BaseObservabilityEvent {
  type: "tooluse:output";
  executionId: string;
  toolUseId: string;
  chunk: string;
  isStderr: boolean;
}

/**
 * Assertion result event.
 */
export interface AssertionStreamEvent extends BaseObservabilityEvent {
  type: "assertion:result";
  executionId: string;
  taskId: string;
  assertion: AssertionResult;
  runningPassRate: number; // Update sparkline in real-time
}

/**
 * Skill start event.
 */
export interface SkillStartEvent extends BaseObservabilityEvent {
  type: "skill:start";
  executionId: string;
  skillTraceId: string;
  skillName: string;
  skillFile: string;
  lineNumber: number;
}

/**
 * Skill end event.
 */
export interface SkillEndEvent extends BaseObservabilityEvent {
  type: "skill:end";
  executionId: string;
  skillTraceId: string;
  skillName: string;
  status: "success" | "partial" | "failed";
  durationMs: number;
}

/**
 * Message bus event forwarded to UI.
 */
export interface MessageBusStreamEvent extends BaseObservabilityEvent {
  type: "messagebus:event";
  entry: import("./observability").MessageBusLogEntry;
  requiresAction: boolean; // Highlight if needs attention
}

/**
 * Union of all observability events.
 */
export type ObservabilityEvent =
  | TranscriptStreamEvent
  | ToolUseStartEvent
  | ToolUseEndEvent
  | ToolUseOutputEvent
  | AssertionStreamEvent
  | SkillStartEvent
  | SkillEndEvent
  | MessageBusStreamEvent;

/**
 * WebSocket subscription request.
 */
export interface ObservabilitySubscription {
  topic: string; // e.g., 'transcript:*', 'tooluse:exec-123'
  action: "subscribe" | "unsubscribe";
}

/**
 * WebSocket connection state.
 */
export interface ObservabilityConnectionState {
  isConnected: boolean;
  executionId?: string;
  subscriptions: string[];
  lastEventTime?: string;
}
```

#### Acceptance Criteria

- [ ] All 8 event types defined with proper structure
- [ ] Union type `ObservabilityEvent` covers all events
- [ ] Subscription/connection types for React hooks
- [ ] Types are importable from WebSocket module

---

### OBS-207: Create API Request/Response Types

**File:** `server/types/observability-api.ts`

**Purpose:** Define REST API types.

#### Type Definitions

```typescript
// server/types/observability-api.ts

import type {
  TranscriptEntry,
  ToolUse,
  AssertionResult,
  SkillTrace,
  MessageBusLogEntry,
  ToolResultStatus,
  ToolCategory,
  AssertionCategory,
} from "./observability";

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

/**
 * Query parameters for tool uses endpoint.
 */
export interface ToolUseQuery {
  tools?: string[]; // Filter by tool name
  categories?: ToolCategory[]; // Filter by category
  status?: ToolResultStatus[]; // Filter by result status
  taskId?: string; // Filter by task
  since?: string; // ISO8601 timestamp
  until?: string; // ISO8601 timestamp
  limit?: number; // Max results (default 100)
  includeInputs?: boolean; // Include full inputs
  includeOutputs?: boolean; // Include full outputs
}

/**
 * Query parameters for transcript endpoint.
 */
export interface TranscriptQuery {
  entryTypes?: string[]; // Filter by entry type
  categories?: string[]; // Filter by category
  taskId?: string; // Filter by task
  since?: string; // ISO8601 timestamp
  until?: string; // ISO8601 timestamp
  limit?: number; // Max results (default 500)
  cursor?: string; // Pagination cursor
}

/**
 * Query parameters for message bus endpoint.
 */
export interface MessageBusQuery {
  since?: string; // ISO8601 timestamp
  until?: string; // ISO8601 timestamp
  eventTypes?: string[]; // Filter by event type
  sources?: string[]; // Filter by source
  severity?: string[]; // Filter by severity
  correlationId?: string; // Get related events
  limit?: number; // Max results (default 100)
}

/**
 * Query parameters for assertions endpoint.
 */
export interface AssertionQuery {
  categories?: AssertionCategory[]; // Filter by category
  result?: ("pass" | "fail" | "skip" | "warn")[]; // Filter by result
  taskId?: string; // Filter by task
  chainId?: string; // Filter by chain
  since?: string; // ISO8601 timestamp
  limit?: number; // Max results
}

// ============================================================================
// RESPONSE TYPES
// ============================================================================

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Error response.
 */
export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Execution details response.
 */
export interface ExecutionResponse {
  id: string;
  startTime: string;
  endTime?: string;
  status: "running" | "completed" | "failed";
  taskCount: number;
  agentCount: number;
  waveCount: number;
  stats: {
    totalToolUses: number;
    totalAssertions: number;
    passRate: number;
    errorCount: number;
    durationMs?: number;
  };
}

/**
 * Executions list response.
 */
export type ExecutionsListResponse = PaginatedResponse<ExecutionResponse>;

/**
 * Transcript entries response.
 */
export type TranscriptResponse = PaginatedResponse<TranscriptEntry>;

/**
 * Tool uses response.
 */
export type ToolUsesResponse = PaginatedResponse<ToolUse>;

/**
 * Assertions response.
 */
export type AssertionsResponse = PaginatedResponse<AssertionResult>;

/**
 * Skill traces response.
 */
export type SkillTracesResponse = PaginatedResponse<SkillTrace>;

/**
 * Message bus response.
 */
export type MessageBusResponse = PaginatedResponse<MessageBusLogEntry>;

// ============================================================================
// AGGREGATION TYPES
// ============================================================================

/**
 * Tool usage summary response.
 */
export interface ToolUsageSummaryResponse {
  executionId: string;
  totalToolUses: number;

  byTool: Record<
    string,
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

  timeline: {
    firstToolUse: string;
    lastToolUse: string;
    totalDurationMs: number;
  };

  errors: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    errorMessage: string;
    timestamp: string;
  }>;

  blocked: Array<{
    toolUseId: string;
    tool: string;
    inputSummary: string;
    blockReason: string;
    timestamp: string;
  }>;
}

/**
 * Assertion summary response.
 */
export interface AssertionSummaryResponse {
  executionId: string;

  summary: {
    totalAssertions: number;
    passed: number;
    failed: number;
    skipped: number;
    warnings: number;
    passRate: number;
  };

  byCategory: Partial<
    Record<
      AssertionCategory,
      {
        total: number;
        passed: number;
        failed?: number;
        skipped?: number;
      }
    >
  >;

  recentFailures: Array<{
    assertionId: string;
    taskId: string;
    category: AssertionCategory;
    description: string;
    timestamp: string;
  }>;
}
```

#### Acceptance Criteria

- [ ] Query types defined for all endpoints
- [ ] `PaginatedResponse` wraps all list endpoints
- [ ] Summary/aggregation response types defined
- [ ] All types compile without errors

---

### OBS-208: Create Cross-Reference Types

**File:** `server/types/observability.ts`

**Purpose:** Define entity linking and navigation types.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 7: Cross-Reference Types

/**
 * Deep link URL patterns.
 */
export const DEEP_LINK_PATTERNS = {
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

  // Cross-reference views
  toolUseInContext:
    "/observability/executions/{executionId}/tool-uses/{toolUseId}?context=transcript",
  assertionWithEvidence:
    "/observability/executions/{executionId}/assertions/{assertionId}?expand=evidence",

  // Message bus
  messageBusEvent: "/observability/message-bus/{eventId}",
  messageBusCorrelated:
    "/observability/message-bus?correlationId={correlationId}",
} as const;

export type DeepLinkPattern = keyof typeof DEEP_LINK_PATTERNS;

/**
 * Entity type for cross-referencing.
 */
export type CrossRefEntityType =
  | "transcriptEntry"
  | "toolUse"
  | "assertion"
  | "skillTrace";

/**
 * Cross-references for a tool use.
 */
export interface ToolUseCrossRefs {
  transcriptEntry: string; // Transcript entry that logged this
  task?: string; // Task it belongs to
  skill?: string; // Skill that invoked it (if any)
  parentToolUse?: string; // Parent tool use (if nested)
  childToolUses: string[]; // Child tool uses (if parent)
  relatedAssertions: string[]; // Assertions using this as evidence
}

/**
 * Cross-references for an assertion.
 */
export interface AssertionCrossRefs {
  task: string; // Task being validated
  chain?: string; // Assertion chain it belongs to
  transcriptEntries: string[]; // Related transcript entries
  toolUses: string[]; // Tool uses that provide evidence
  previousInChain?: string; // Previous assertion in chain
  nextInChain?: string; // Next assertion in chain
}

/**
 * Cross-references for a skill trace.
 */
export interface SkillTraceCrossRefs {
  task: string; // Task that invoked skill
  transcriptEntries: string[]; // All entries during skill
  toolUses: string[]; // All tool uses during skill
  assertions: string[]; // Assertions made by skill
  parentSkill?: string; // Parent skill (if nested)
  childSkills: string[]; // Child skills (if parent)
}

/**
 * Cross-references for a transcript entry.
 */
export interface TranscriptEntryCrossRefs {
  execution: string; // Execution it belongs to
  task?: string; // Task (if applicable)
  toolUse?: string; // Tool use (if tool_use entry)
  skill?: string; // Skill (if skill_invoke entry)
  assertion?: string; // Assertion (if assertion entry)
  previousEntry?: string; // Previous in sequence
  nextEntry?: string; // Next in sequence
}

/**
 * Union of all cross-reference types.
 */
export type EntityCrossRefs =
  | { type: "toolUse"; refs: ToolUseCrossRefs }
  | { type: "assertion"; refs: AssertionCrossRefs }
  | { type: "skillTrace"; refs: SkillTraceCrossRefs }
  | { type: "transcriptEntry"; refs: TranscriptEntryCrossRefs };

/**
 * Related entities result.
 */
export interface RelatedEntitiesResult {
  transcriptEntries: TranscriptEntry[];
  toolUses: ToolUse[];
  assertions: AssertionResult[];
  skillTraces: SkillTrace[];
}
```

#### Acceptance Criteria

- [ ] Deep link patterns defined for all entity types
- [ ] Cross-reference types for tool uses, assertions, skills, entries
- [ ] Union type allows discriminated type checking
- [ ] `RelatedEntitiesResult` supports full entity loading

---

### OBS-209: Create UI Component Prop Types

**File:** `frontend/src/types/observability.ts`

**Purpose:** Define React component prop types for frontend.

#### Type Definitions

```typescript
// frontend/src/types/observability.ts

// Re-export core types from shared definitions
export type {
  TranscriptEntry,
  TranscriptEntryType,
  EntryCategory,
  ToolUse,
  ToolResultStatus,
  ToolName,
  ToolCategory,
  ToolCall,
  SkillReference,
  SkillTrace,
  AssertionResult,
  AssertionCategory,
  AssertionEvidence,
  AssertionChain,
  MessageBusLogEntry,
  LogSeverity,
} from "./observability-shared";

// ============================================================================
// UI COMPONENT PROPS
// ============================================================================

/**
 * Props for QuickStats component.
 */
export interface QuickStatsProps {
  executionId?: string; // Filter to specific execution
  refreshIntervalMs?: number; // Auto-refresh interval (default: 1000)
}

/**
 * Data structure for QuickStats display.
 */
export interface QuickStatsData {
  activeExecutions: number;
  toolCallsPerMinute: number;
  passRate: number;
  errorCount: number;
  blockedCount: number;
  discoveriesCount: number;
}

/**
 * Props for ExecutionTimeline component.
 */
export interface ExecutionTimelineProps {
  executionId: string;
  onTaskClick?: (taskId: string) => void;
  onEventClick?: (entryId: string) => void;
  zoomLevel?: number; // 0.5 to 4 (default: 1)
  showToolDensity?: boolean; // Show tool use density chart
  showEventMarkers?: boolean; // Show vertical event markers
}

/**
 * Props for ToolUseHeatMap component.
 */
export interface ToolUseHeatMapProps {
  executionId?: string; // Filter to specific execution
  period: "hour" | "day" | "week";
  showAnomalies?: boolean; // Show anomaly detection panel
  onCellClick?: (toolUseId: string) => void;
}

/**
 * Props for AssertionSparklines component.
 */
export interface AssertionSparklinesProps {
  executionId: string;
  showChains?: boolean; // Show assertion chains visualization
  onFailureClick?: (assertionId: string) => void;
}

/**
 * Props for SkillFlowDiagram component.
 */
export interface SkillFlowDiagramProps {
  taskId: string;
  executionId: string;
  onNodeClick?: (
    nodeType: "skill" | "tool" | "assertion",
    nodeId: string,
  ) => void;
  exportFormat?: "svg" | "mermaid" | "png";
}

/**
 * Props for DeepLinkPanel component.
 */
export interface DeepLinkPanelProps {
  entityType: "toolUse" | "assertion" | "skillTrace" | "transcriptEntry";
  entityId: string;
  executionId: string;
  onNavigate?: (path: string) => void;
}

/**
 * Props for UnifiedLogViewer component.
 */
export interface UnifiedLogViewerProps {
  executionId?: string;
  autoScroll?: boolean; // Auto-scroll to latest
  maxEntries?: number; // Max entries to keep in view
  filters?: {
    entryTypes?: string[];
    categories?: string[];
    severity?: string[];
  };
}

/**
 * Props for TranscriptPanel component.
 */
export interface TranscriptPanelProps {
  executionId: string;
  selectedEntryId?: string;
  onEntrySelect?: (entryId: string) => void;
  showFilters?: boolean;
}

/**
 * Props for ToolUseDetail component.
 */
export interface ToolUseDetailProps {
  toolUse: ToolUse;
  showInput?: boolean;
  showOutput?: boolean;
  onRelatedClick?: (entityType: string, entityId: string) => void;
}

/**
 * Props for AssertionDetail component.
 */
export interface AssertionDetailProps {
  assertion: AssertionResult;
  showEvidence?: boolean;
  onChainNavigate?: (direction: "prev" | "next") => void;
}
```

#### Acceptance Criteria

- [ ] Prop types defined for all UI components
- [ ] Event handler types properly typed
- [ ] Optional props have sensible defaults documented
- [ ] Types importable from frontend types module

---

### OBS-210: Create React Hook Types

**File:** `frontend/src/types/observability.ts`

**Purpose:** Define types for React hooks.

#### Type Definitions

```typescript
// frontend/src/types/observability.ts - Part 2: Hook Types

import type { ObservabilityEvent } from "./observability-websocket";

/**
 * Return type for useObservabilityStream hook.
 */
export interface UseObservabilityStreamResult {
  isConnected: boolean;
  events: ObservabilityEvent[];
  latestEvent?: ObservabilityEvent;
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  clearEvents: () => void;
}

/**
 * Return type for useExecution hook.
 */
export interface UseExecutionResult {
  execution: ExecutionResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Return type for useTranscript hook.
 */
export interface UseTranscriptResult {
  entries: TranscriptEntry[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => void;
}

/**
 * Return type for useToolUses hook.
 */
export interface UseToolUsesResult {
  toolUses: ToolUse[];
  isLoading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  filters: ToolUseQuery;
  setFilters: (filters: Partial<ToolUseQuery>) => void;
}

/**
 * Return type for useAssertions hook.
 */
export interface UseAssertionsResult {
  assertions: AssertionResult[];
  summary: AssertionSummaryResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Return type for useCrossReferences hook.
 */
export interface UseCrossReferencesResult {
  refs: EntityCrossRefs | null;
  relatedEntities: RelatedEntitiesResult | null;
  isLoading: boolean;
  error: Error | null;
}
```

#### Acceptance Criteria

- [ ] Return types defined for all observability hooks
- [ ] Types support loading/error states
- [ ] Pagination hooks include `loadMore` and `hasMore`
- [ ] Filter hooks include setter functions

---

### OBS-211: Create Security Types

**File:** `server/types/observability.ts`

**Purpose:** Define security-related types for Bash command validation.

#### Type Definitions

```typescript
// server/types/observability.ts - Part 8: Security Types

/**
 * Security hook result for Bash commands.
 */
export interface SecurityHookResult {
  decision: "allow" | "block";
  reason?: string; // Required if blocked
}

/**
 * Allowed commands for Build Agents (defense-in-depth).
 */
export const ALLOWED_BASH_COMMANDS = {
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
export const COMMANDS_NEEDING_EXTRA_VALIDATION = [
  "pkill",
  "chmod",
  "rm",
] as const;

/**
 * Type for allowed command categories.
 */
export type AllowedCommandCategory = keyof typeof ALLOWED_BASH_COMMANDS;

/**
 * Command validation result.
 */
export interface CommandValidationResult {
  isAllowed: boolean;
  category?: AllowedCommandCategory;
  needsExtraValidation: boolean;
  command: string;
  args: string[];
}
```

#### Acceptance Criteria

- [ ] Allowed commands defined for all categories
- [ ] Extra validation list includes dangerous commands
- [ ] Validation result type supports policy decisions

---

### OBS-212: Create Index Export File

**File:** `server/types/observability/index.ts`

**Purpose:** Provide clean exports for all observability types.

#### Implementation

```typescript
// server/types/observability/index.ts

// Core types
export * from "./observability";

// API types
export * from "./observability-api";

// WebSocket types
export * from "./observability-websocket";

// Re-export commonly used types at top level
export type {
  // Transcript
  TranscriptEntry,
  TranscriptEntryType,
  EntryCategory,
  TranscriptEntryInput,

  // Tool Use
  ToolUse,
  ToolResultStatus,
  ToolName,
  ToolCategory,
  ToolInput,
  ToolOutput,
  ToolCall,

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
  LogSeverity,
  MessageBusCategory,

  // Cross-Reference
  DeepLinkPattern,
  CrossRefEntityType,
  EntityCrossRefs,
  RelatedEntitiesResult,

  // Security
  SecurityHookResult,
  CommandValidationResult,
} from "./observability";

export type {
  // API Query Types
  ToolUseQuery,
  TranscriptQuery,
  MessageBusQuery,
  AssertionQuery,

  // API Response Types
  PaginatedResponse,
  ApiError,
  ExecutionResponse,
  ToolUsageSummaryResponse,
  AssertionSummaryResponse,
} from "./observability-api";

export type {
  // WebSocket Events
  ObservabilityEvent,
  ObservabilityEventType,
  TranscriptStreamEvent,
  ToolUseStartEvent,
  ToolUseEndEvent,
  AssertionStreamEvent,
  SkillStartEvent,
  SkillEndEvent,
  MessageBusStreamEvent,

  // WebSocket Connection
  ObservabilitySubscription,
  ObservabilityConnectionState,
} from "./observability-websocket";

// Constants
export {
  DEEP_LINK_PATTERNS,
  ALLOWED_BASH_COMMANDS,
  COMMANDS_NEEDING_EXTRA_VALIDATION,
} from "./observability";
```

#### Acceptance Criteria

- [ ] All types exported from index
- [ ] Commonly used types re-exported at top level
- [ ] Constants exported for use in validators
- [ ] Clean import paths (e.g., `import { ToolUse } from '../types/observability'`)

---

## Phase 4 Test Validation Script

**File:** `tests/e2e/test-obs-phase4-types.ts`

```typescript
#!/usr/bin/env npx tsx
/**
 * Phase 4 TypeScript Types Validation Tests
 *
 * Validates that all observability types compile and are usable.
 */

import type {
  // Transcript types
  TranscriptEntry,
  TranscriptEntryType,
  EntryCategory,
  TranscriptEntryInput,

  // Tool use types
  ToolUse,
  ToolResultStatus,
  ToolName,
  ToolCategory,
  ToolInput,
  ToolOutput,
  ReadInput,
  WriteInput,
  BashInput,

  // Skill types
  SkillReference,
  SkillTrace,
  SkillsUsageSummary,

  // Assertion types
  AssertionResult,
  AssertionCategory,
  AssertionEvidence,
  AssertionChain,
  AssertionsSummary,

  // Message bus types
  MessageBusLogEntry,
  LogSeverity,

  // Cross-reference types
  DeepLinkPattern,
  EntityCrossRefs,
  RelatedEntitiesResult,

  // API types
  ToolUseQuery,
  TranscriptQuery,
  PaginatedResponse,
  ExecutionResponse,

  // WebSocket types
  ObservabilityEvent,
  TranscriptStreamEvent,
  ToolUseStartEvent,

  // Security types
  SecurityHookResult,
  CommandValidationResult,
} from "../server/types/observability";

// ============================================================================
// TEST 1: Transcript Entry Types
// ============================================================================
function testTranscriptTypes(): void {
  console.log("\n" + "=".repeat(70));
  console.log("TEST 1: Transcript Entry Types");
  console.log("=".repeat(70));

  // Create a valid transcript entry
  const entry: TranscriptEntry = {
    id: "test-entry-1",
    timestamp: new Date().toISOString(),
    sequence: 1,
    executionId: "exec-123",
    instanceId: "instance-456",
    entryType: "phase_start",
    category: "lifecycle",
    summary: "Starting prime phase",
    details: { phase: "prime" },
  };

  // Verify entry type narrowing
  const entryType: TranscriptEntryType = entry.entryType;
  const category: EntryCategory = entry.category;

  // Verify input type
  const input: TranscriptEntryInput = {
    entryType: "task_start",
    category: "lifecycle",
    summary: "Starting task",
    taskId: "task-001",
  };

  console.log("✓ TranscriptEntry type validates correctly");
  console.log("✓ TranscriptEntryType enum works");
  console.log("✓ EntryCategory enum works");
  console.log("✓ TranscriptEntryInput type works");
  console.log("✓ TEST 1 PASSED\n");
}

// ============================================================================
// TEST 2: Tool Use Types
// ============================================================================
function testToolUseTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 2: Tool Use Types");
  console.log("=".repeat(70));

  // Create a valid tool use
  const toolUse: ToolUse = {
    id: "tool-1",
    executionId: "exec-123",
    transcriptEntryId: "entry-1",
    tool: "Read",
    toolCategory: "file_read",
    input: { file_path: "/test/path.ts" } as ReadInput,
    inputSummary: "Read /test/path.ts",
    resultStatus: "done",
    output: { success: true, content: "..." },
    outputSummary: "Read 100 lines",
    isError: false,
    isBlocked: false,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    durationMs: 50,
  };

  // Verify result status narrowing
  const status: ToolResultStatus = toolUse.resultStatus;

  // Verify tool category
  const category: ToolCategory = toolUse.toolCategory;

  // Verify input types
  const readInput: ReadInput = { file_path: "/test.ts" };
  const writeInput: WriteInput = { file_path: "/test.ts", content: "test" };
  const bashInput: BashInput = { command: "npm test" };

  console.log("✓ ToolUse type validates correctly");
  console.log("✓ ToolResultStatus enum works");
  console.log("✓ ToolCategory enum works");
  console.log("✓ Tool input types work");
  console.log("✓ TEST 2 PASSED\n");
}

// ============================================================================
// TEST 3: Skill Trace Types
// ============================================================================
function testSkillTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 3: Skill Trace Types");
  console.log("=".repeat(70));

  // Create a skill reference
  const skillRef: SkillReference = {
    skillName: "code-generation",
    skillFile: "skills/code-gen.md",
    lineNumber: 42,
    sectionTitle: "TypeScript Generation",
    inputSummary: "Generate user model",
    outputSummary: "Created user.ts with 50 lines",
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    tokenEstimate: 1500,
    status: "success",
  };

  // Create a skill trace
  const skillTrace: SkillTrace = {
    id: "trace-1",
    executionId: "exec-123",
    taskId: "task-001",
    skill: skillRef,
    toolCalls: [],
    subSkills: [],
    entries: [],
    assertions: [],
  };

  console.log("✓ SkillReference type validates correctly");
  console.log("✓ SkillTrace type validates correctly");
  console.log("✓ Nested skill traces work");
  console.log("✓ TEST 3 PASSED\n");
}

// ============================================================================
// TEST 4: Assertion Types
// ============================================================================
function testAssertionTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 4: Assertion Types");
  console.log("=".repeat(70));

  // Create assertion evidence
  const evidence: AssertionEvidence = {
    command: "npx tsc --noEmit",
    exitCode: 0,
    stdout: "Compilation successful",
    stderr: "",
    filePath: "src/user.ts",
    fileExists: true,
  };

  // Create an assertion result
  const assertion: AssertionResult = {
    id: "assert-1",
    taskId: "task-001",
    executionId: "exec-123",
    category: "typescript_compiles",
    description: "TypeScript compilation passes",
    result: "pass",
    evidence,
    timestamp: new Date().toISOString(),
    durationMs: 2500,
  };

  // Create an assertion chain
  const chain: AssertionChain = {
    id: "chain-1",
    taskId: "task-001",
    executionId: "exec-123",
    description: "Task validation chain",
    assertions: [assertion],
    overallResult: "pass",
    passCount: 1,
    failCount: 0,
    skipCount: 0,
  };

  // Verify category narrowing
  const category: AssertionCategory = assertion.category;

  console.log("✓ AssertionEvidence type validates correctly");
  console.log("✓ AssertionResult type validates correctly");
  console.log("✓ AssertionChain type validates correctly");
  console.log("✓ AssertionCategory enum works");
  console.log("✓ TEST 4 PASSED\n");
}

// ============================================================================
// TEST 5: Message Bus Types
// ============================================================================
function testMessageBusTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 5: Message Bus Types");
  console.log("=".repeat(70));

  // Create a message bus entry
  const entry: MessageBusLogEntry = {
    eventId: "event-1",
    timestamp: new Date().toISOString(),
    source: "loop-1",
    eventType: "task_completed",
    humanSummary: "Task completed successfully",
    severity: "info",
    category: "lifecycle",
    executionId: "exec-123",
    taskId: "task-001",
    payload: { status: "success" },
  };

  // Verify severity narrowing
  const severity: LogSeverity = entry.severity;

  console.log("✓ MessageBusLogEntry type validates correctly");
  console.log("✓ LogSeverity enum works");
  console.log("✓ TEST 5 PASSED\n");
}

// ============================================================================
// TEST 6: API Types
// ============================================================================
function testApiTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 6: API Request/Response Types");
  console.log("=".repeat(70));

  // Create a query
  const query: ToolUseQuery = {
    tools: ["Read", "Write"],
    categories: ["file_read", "file_write"],
    status: ["done", "error"],
    limit: 100,
  };

  // Create a transcript query
  const transcriptQuery: TranscriptQuery = {
    entryTypes: ["phase_start", "phase_end"],
    limit: 500,
  };

  // Create a paginated response
  const response: PaginatedResponse<ToolUse> = {
    data: [],
    total: 0,
    hasMore: false,
  };

  // Create an execution response
  const execution: ExecutionResponse = {
    id: "exec-123",
    startTime: new Date().toISOString(),
    status: "running",
    taskCount: 5,
    agentCount: 2,
    waveCount: 3,
    stats: {
      totalToolUses: 50,
      totalAssertions: 25,
      passRate: 0.92,
      errorCount: 2,
    },
  };

  console.log("✓ ToolUseQuery type validates correctly");
  console.log("✓ TranscriptQuery type validates correctly");
  console.log("✓ PaginatedResponse type validates correctly");
  console.log("✓ ExecutionResponse type validates correctly");
  console.log("✓ TEST 6 PASSED\n");
}

// ============================================================================
// TEST 7: WebSocket Types
// ============================================================================
function testWebSocketTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 7: WebSocket Event Types");
  console.log("=".repeat(70));

  // Create a transcript stream event
  const transcriptEvent: TranscriptStreamEvent = {
    type: "transcript:entry",
    timestamp: new Date().toISOString(),
    executionId: "exec-123",
    entry: {
      id: "entry-1",
      timestamp: new Date().toISOString(),
      sequence: 1,
      executionId: "exec-123",
      instanceId: "instance-1",
      entryType: "phase_start",
      category: "lifecycle",
      summary: "Starting phase",
      details: {},
    },
    isLatest: true,
  };

  // Create a tool use start event
  const toolStartEvent: ToolUseStartEvent = {
    type: "tooluse:start",
    timestamp: new Date().toISOString(),
    executionId: "exec-123",
    toolUseId: "tool-1",
    tool: "Read",
    inputSummary: "Reading file",
  };

  // Verify event union
  const events: ObservabilityEvent[] = [transcriptEvent, toolStartEvent];

  // Type narrowing test
  for (const event of events) {
    if (event.type === "transcript:entry") {
      const entry = event.entry; // Should be TranscriptEntry
    } else if (event.type === "tooluse:start") {
      const tool = event.tool; // Should be ToolName
    }
  }

  console.log("✓ TranscriptStreamEvent type validates correctly");
  console.log("✓ ToolUseStartEvent type validates correctly");
  console.log("✓ ObservabilityEvent union works");
  console.log("✓ Event type narrowing works");
  console.log("✓ TEST 7 PASSED\n");
}

// ============================================================================
// TEST 8: Cross-Reference Types
// ============================================================================
function testCrossRefTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 8: Cross-Reference Types");
  console.log("=".repeat(70));

  // Create cross-references
  const toolCrossRefs: EntityCrossRefs = {
    type: "toolUse",
    refs: {
      transcriptEntry: "entry-1",
      task: "task-001",
      childToolUses: [],
      relatedAssertions: ["assert-1"],
    },
  };

  // Verify discriminated union narrowing
  if (toolCrossRefs.type === "toolUse") {
    const transcript = toolCrossRefs.refs.transcriptEntry; // Should work
  }

  // Create related entities
  const related: RelatedEntitiesResult = {
    transcriptEntries: [],
    toolUses: [],
    assertions: [],
    skillTraces: [],
  };

  console.log("✓ EntityCrossRefs discriminated union works");
  console.log("✓ Type narrowing works correctly");
  console.log("✓ RelatedEntitiesResult type validates correctly");
  console.log("✓ TEST 8 PASSED\n");
}

// ============================================================================
// TEST 9: Security Types
// ============================================================================
function testSecurityTypes(): void {
  console.log("=".repeat(70));
  console.log("TEST 9: Security Types");
  console.log("=".repeat(70));

  // Create security hook result
  const allowed: SecurityHookResult = {
    decision: "allow",
  };

  const blocked: SecurityHookResult = {
    decision: "block",
    reason: "Command not in allowlist",
  };

  // Create command validation result
  const validation: CommandValidationResult = {
    isAllowed: true,
    category: "node",
    needsExtraValidation: false,
    command: "npm",
    args: ["test"],
  };

  console.log("✓ SecurityHookResult type validates correctly");
  console.log("✓ CommandValidationResult type validates correctly");
  console.log("✓ TEST 9 PASSED\n");
}

// ============================================================================
// Main
// ============================================================================
function main(): void {
  console.log("\n" + "=".repeat(70));
  console.log("OBSERVABILITY PHASE 4 TYPESCRIPT TYPES TESTS");
  console.log("=".repeat(70));

  try {
    testTranscriptTypes();
    testToolUseTypes();
    testSkillTypes();
    testAssertionTypes();
    testMessageBusTypes();
    testApiTypes();
    testWebSocketTypes();
    testCrossRefTypes();
    testSecurityTypes();

    console.log("=".repeat(70));
    console.log("ALL PHASE 4 TESTS PASSED");
    console.log("=".repeat(70));
  } catch (error) {
    console.log("\n" + "=".repeat(70));
    console.log(`PHASE 4 TEST FAILURE: ${error}`);
    console.log("=".repeat(70));
    process.exit(1);
  }
}

main();
```

---

## Task Summary

| Task ID | Title                      | File                                      | Priority | Dependencies |
| ------- | -------------------------- | ----------------------------------------- | -------- | ------------ |
| OBS-200 | Core Transcript Types      | `server/types/observability.ts`           | P1       | OBS-001      |
| OBS-201 | Tool Use Types             | `server/types/observability.ts`           | P1       | OBS-200      |
| OBS-202 | Tool Input/Output Types    | `server/types/observability.ts`           | P1       | OBS-201      |
| OBS-203 | Skill Trace Types          | `server/types/observability.ts`           | P1       | OBS-200      |
| OBS-204 | Assertion Types            | `server/types/observability.ts`           | P1       | OBS-200      |
| OBS-205 | Message Bus Types          | `server/types/observability.ts`           | P1       | OBS-200      |
| OBS-206 | WebSocket Event Types      | `server/types/observability-websocket.ts` | P1       | OBS-200-205  |
| OBS-207 | API Request/Response Types | `server/types/observability-api.ts`       | P1       | OBS-200-205  |
| OBS-208 | Cross-Reference Types      | `server/types/observability.ts`           | P1       | OBS-200-205  |
| OBS-209 | UI Component Prop Types    | `frontend/src/types/observability.ts`     | P1       | OBS-200-208  |
| OBS-210 | React Hook Types           | `frontend/src/types/observability.ts`     | P1       | OBS-209      |
| OBS-211 | Security Types             | `server/types/observability.ts`           | P1       | OBS-200      |
| OBS-212 | Index Export File          | `server/types/observability/index.ts`     | P1       | OBS-200-211  |

### Test Validation Tasks

| Task ID     | Title                    | File                                 | Priority | Dependencies       |
| ----------- | ------------------------ | ------------------------------------ | -------- | ------------------ |
| OBS-TEST-04 | Phase 4 types validation | `tests/e2e/test-obs-phase4-types.ts` | P1       | OBS-200 to OBS-212 |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRE-REQUISITES                                                          │
│  ─────────────                                                          │
│  ✓ Database schema defined (Phase 1)                                    │
│  ✓ TYPES.md appendix reviewed                                           │
│                                                                          │
│  PHASE 4a: Core Types (server/types/observability.ts)                   │
│  ─────────────────────────────────────────────────────                  │
│  1. OBS-200: TranscriptEntry, TranscriptEntryType, EntryCategory        │
│  2. OBS-201: ToolUse, ToolResultStatus, ToolName, ToolCategory          │
│  3. OBS-202: ToolInput, ToolOutput, specific input/output types         │
│  4. OBS-203: SkillReference, SkillTrace, SkillsUsageSummary             │
│  5. OBS-204: AssertionResult, AssertionEvidence, AssertionChain         │
│  6. OBS-205: MessageBusLogEntry, LogSeverity, MessageBusCategory        │
│  7. OBS-211: SecurityHookResult, CommandValidationResult                │
│  8. OBS-208: DeepLinkPattern, EntityCrossRefs                           │
│                                                                          │
│  PHASE 4b: Specialized Types                                             │
│  ──────────────────────────                                             │
│  9. OBS-206: WebSocket event types (observability-websocket.ts)         │
│  10. OBS-207: API request/response types (observability-api.ts)         │
│                                                                          │
│  PHASE 4c: Frontend Types                                                │
│  ────────────────────────                                               │
│  11. OBS-209: UI component prop types                                   │
│  12. OBS-210: React hook return types                                   │
│                                                                          │
│  PHASE 4d: Export Organization                                           │
│  ────────────────────────────                                           │
│  13. OBS-212: Create index.ts with clean exports                        │
│                                                                          │
│  VALIDATION                                                              │
│  ──────────                                                             │
│  14. Run: npx tsc --noEmit                                              │
│      └─ Verify: No TypeScript errors                                    │
│  15. Run: npx tsx tests/e2e/test-obs-phase4-types.ts                    │
│      └─ Verify: ALL PHASE 4 TESTS PASSED                                │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All types compile without errors                                     │
│  ✓ Types match database schema                                          │
│  ✓ Types match API specification                                        │
│  ✓ All types exportable from index                                      │
│  ✓ Frontend types are subset of server types                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 4 tasks

# Step 1: Verify TypeScript compilation
npx tsc --noEmit

# Step 2: Run type validation tests
npx tsx tests/e2e/test-obs-phase4-types.ts
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 4 TYPESCRIPT TYPES TESTS
======================================================================

======================================================================
TEST 1: Transcript Entry Types
======================================================================
✓ TranscriptEntry type validates correctly
✓ TranscriptEntryType enum works
✓ EntryCategory enum works
✓ TranscriptEntryInput type works
✓ TEST 1 PASSED

[... all 9 tests pass ...]

======================================================================
ALL PHASE 4 TESTS PASSED
======================================================================
```

---

## Related Documents

| Document                                                           | Purpose                     |
| ------------------------------------------------------------------ | --------------------------- |
| [appendices/TYPES.md](./appendices/TYPES.md)                       | Source type definitions     |
| [api/README.md](./api/README.md)                                   | API specification           |
| [implementation-plan-phase-3.md](./implementation-plan-phase-3.md) | Agent integration (Phase 3) |
| [implementation-plan-phase-5.md](./implementation-plan-phase-5.md) | API routes (Phase 5)        |

---

_Phase 4 Implementation Plan: TypeScript Types_
