/**
 * Observability Types - Backend type definitions for observability UI
 * Based on database schema (migrations 087, 088)
 */

// === Entry Types ===

export type TranscriptEntryType =
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "tool_use"
  | "skill_invoke"
  | "assertion"
  | "discovery"
  | "error"
  | "decision"
  | "checkpoint"
  | "rollback";

export type EntryCategory =
  | "lifecycle"
  | "coordination"
  | "failure"
  | "decision"
  | "system";

// === Tool Use Types ===

export type ToolName =
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  | "Bash"
  | "Task"
  | "WebFetch"
  | "WebSearch"
  | "TodoWrite"
  | "AskUserQuestion"
  | "Skill"
  | "NotebookEdit";

export type ToolCategory =
  | "file_read"
  | "file_write"
  | "file_edit"
  | "search"
  | "shell"
  | "agent"
  | "web"
  | "interaction"
  | "other";

export type ToolResultStatus = "done" | "error" | "blocked";

// === Assertion Types ===

export type AssertionResult = "pass" | "fail" | "skip" | "warn";

export type AssertionCategory =
  | "file_created"
  | "file_modified"
  | "tsc_compiles"
  | "test_passes"
  | "lint_passes"
  | "build_succeeds"
  | "custom";

// === Severity Types ===

export type Severity = "info" | "warning" | "error" | "critical";

// === Message Bus Category (subset of EntryCategory, aligned with frontend) ===

export type MessageBusCategory =
  | "lifecycle"
  | "coordination"
  | "failure"
  | "decision";

// === Core Entities ===

export interface TranscriptEntry {
  id: string;
  timestamp: string;
  sequence: number;
  executionId: string;
  taskId: string | null;
  instanceId: string;
  waveNumber: number | null;
  entryType: TranscriptEntryType;
  category: EntryCategory;
  summary: string;
  details: Record<string, unknown> | null;
  skillRef: SkillReference | null;
  toolCalls: ToolCall[] | null;
  assertions: AssertionResultEntry[] | null;
  durationMs: number | null;
  tokenEstimate: number | null;
  createdAt: string;
}

export interface ToolUse {
  id: string;
  executionId: string;
  taskId: string | null;
  transcriptEntryId: string;
  tool: ToolName;
  toolCategory: ToolCategory;
  input: Record<string, unknown>;
  inputSummary: string;
  resultStatus: ToolResultStatus;
  output: Record<string, unknown> | null;
  outputSummary: string;
  isError: boolean;
  isBlocked: boolean;
  errorMessage: string | null;
  blockReason: string | null;
  startTime: string;
  endTime: string;
  durationMs: number;
  withinSkill: string | null;
  parentToolUseId: string | null;
  createdAt: string;
}

export interface SkillTrace {
  id: string;
  executionId: string;
  taskId: string;
  skillName: string;
  skillFile: string;
  lineNumber: number | null;
  sectionTitle: string | null;
  inputSummary: string | null;
  outputSummary: string | null;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  tokenEstimate: number | null;
  status: "success" | "partial" | "failed";
  errorMessage: string | null;
  toolCalls: string[] | null;
  subSkills: string[] | null;
  createdAt: string;
}

export interface AssertionResultEntry {
  id: string;
  taskId: string;
  executionId: string;
  category: AssertionCategory;
  description: string;
  result: AssertionResult;
  evidence: AssertionEvidence;
  chainId: string | null;
  chainPosition: number | null;
  timestamp: string;
  durationMs: number | null;
  transcriptEntryId: string | null;
  createdAt: string;
}

export interface AssertionChain {
  id: string;
  taskId: string;
  executionId: string;
  description: string;
  overallResult: "pass" | "fail" | "partial";
  passCount: number;
  failCount: number;
  skipCount: number;
  firstFailureId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface MessageBusLogEntry {
  id: string;
  eventId: string;
  timestamp: string;
  source: string;
  eventType: string;
  correlationId: string | null;
  humanSummary: string;
  severity: Severity;
  category: MessageBusCategory;
  transcriptEntryId: string | null;
  taskId: string | null;
  executionId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

// === Supporting Types ===

export interface SkillReference {
  skillName: string;
  skillFile: string;
  lineNumber?: number;
  sectionTitle?: string;
}

export interface ToolCall {
  toolUseId: string;
  tool: ToolName;
  status: ToolResultStatus;
  durationMs: number;
}

export interface AssertionEvidence {
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  filePath?: string;
  expected?: string;
  actual?: string;
  diff?: string;
}

// === Execution Types ===

export interface ExecutionRun {
  id: string;
  taskListId: string;
  runNumber: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  sessionId: string | null;
  waveCount: number;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}

export interface ExecutionSummary {
  execution: ExecutionRun;
  toolStats: ToolSummary;
  assertionStats: AssertionSummary;
  duration: number | null;
  errorCount: number;
  blockedCount: number;
}

// === Aggregation Types ===

export interface ToolSummary {
  total: number;
  byTool: Record<ToolName, number>;
  byCategory: Record<ToolCategory, number>;
  byStatus: Record<ToolResultStatus, number>;
  avgDurationMs: number;
  errorRate: number;
  blockRate: number;
}

export interface AssertionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  warned: number;
  passRate: number;
  byCategory: Record<AssertionCategory, { total: number; passed: number }>;
  chains: {
    total: number;
    passed: number;
    failed: number;
    partial: number;
  };
}

// === Query/Filter Types ===

export interface TranscriptFilters {
  executionId?: string;
  taskId?: string;
  entryType?: TranscriptEntryType[];
  category?: EntryCategory[];
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

export interface ToolUseFilters {
  executionId?: string;
  taskId?: string;
  tool?: ToolName[];
  category?: ToolCategory[];
  status?: ToolResultStatus[];
  isError?: boolean;
  isBlocked?: boolean;
  fromTime?: string;
  toTime?: string;
  limit?: number;
  offset?: number;
}

export interface AssertionFilters {
  executionId?: string;
  taskId?: string;
  result?: AssertionResult[];
  category?: AssertionCategory[];
  chainId?: string;
  limit?: number;
  offset?: number;
}

export interface MessageBusFilters {
  executionId?: string;
  taskId?: string;
  severity?: Severity[];
  category?: MessageBusCategory[];
  source?: string;
  eventType?: string;
  correlationId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
  offset?: number;
}

// === Cross-Reference Types ===

export type EntityType =
  | "execution"
  | "task"
  | "transcript"
  | "tool_use"
  | "skill_trace"
  | "assertion"
  | "assertion_chain"
  | "message_bus";

export interface CrossReference {
  entityType: EntityType;
  entityId: string;
  relatedTo: Array<{
    type: EntityType;
    id: string;
    summary?: string;
  }>;
}

// === API Response Types ===

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ExecutionsResponse extends PaginatedResponse<ExecutionRun> {}
export interface TranscriptResponse extends PaginatedResponse<TranscriptEntry> {}
export interface ToolUsesResponse extends PaginatedResponse<ToolUse> {}
export interface AssertionsResponse extends PaginatedResponse<AssertionResultEntry> {}
export interface SkillTracesResponse extends PaginatedResponse<SkillTrace> {}
export interface MessageBusResponse extends PaginatedResponse<MessageBusLogEntry> {}
