/**
 * Observability Types - Frontend type definitions for observability UI
 * Mirrors server/types/observability.ts
 */

// === Entry Types ===

export type TranscriptEntryType =
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "tool_use"
  | "skill_invoke"
  | "skill_complete"
  | "assertion"
  | "validation"
  | "discovery"
  | "error"
  | "decision"
  | "checkpoint"
  | "rollback"
  | "lock_acquire"
  | "lock_release";

export type EntryCategory =
  | "lifecycle"
  | "execution"
  | "coordination"
  | "failure"
  | "decision"
  | "system"
  | "tool_use"
  | "tool"
  | "assertion"
  | "discovery"
  | "skill"
  | "error";

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
  category: EntryCategory;
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
  // Command evidence
  command?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;

  // File evidence
  filePath?: string;
  fileExists?: boolean;
  fileSizeBefore?: number;
  fileSizeAfter?: number;
  diffPath?: string;
  fileDiff?: string;

  // Expectation evidence
  expected?: string;
  actual?: string;
  diff?: string;

  // API evidence
  endpoint?: string;
  statusCode?: number;
  responseTime?: number;
  responseBodySample?: string;

  // Timing evidence
  durationMs?: number;

  // Relationship evidence
  relatedEntities?: Array<{
    type: string;
    id: string;
    summary?: string;
  }>;

  // Custom evidence
  custom?: Record<string, unknown>;
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
  byTool: Partial<Record<ToolName, number>>;
  byCategory: Partial<Record<ToolCategory, number>>;
  byStatus: Partial<Record<ToolResultStatus, number>>;
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
  byCategory: Partial<
    Record<AssertionCategory, { total: number; passed: number }>
  >;
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
  category?: EntryCategory[];
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

// === WebSocket Event Types ===

export type ObservabilityEventType =
  | "transcript:entry"
  | "tooluse:start"
  | "tooluse:end"
  | "tooluse:output"
  | "assertion:result"
  | "skill:start"
  | "skill:end"
  | "messagebus:event";

export interface ObservabilityEvent {
  type: ObservabilityEventType;
  timestamp: string;
  executionId?: string;
  taskId?: string;
  data:
    | TranscriptEntry
    | ToolUse
    | AssertionResultEntry
    | SkillTrace
    | MessageBusLogEntry;
}

// === Component Prop Types ===

export interface QuickStatsProps {
  executionId?: string;
  refreshInterval?: number;
}

export interface ViewSelectorProps {
  currentView: ObservabilityView;
  onViewChange: (view: ObservabilityView) => void;
}

export type ObservabilityView =
  | "timeline"
  | "tool-uses"
  | "assertions"
  | "skills"
  | "logs"
  | "summary"
  | "heatmap"
  | "unified"
  | "messages"
  | "events";

export interface StatusBadgeProps {
  status: ToolResultStatus | AssertionResult | ExecutionRun["status"];
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export interface BreadcrumbProps {
  segments: Array<{
    label: string;
    href?: string;
  }>;
}

// === Status Color Configurations ===

export type StatusType =
  | "success"
  | "error"
  | "blocked"
  | "skipped"
  | "warning"
  | "in-progress"
  | "pending";

export const statusConfig: Record<
  StatusType,
  { color: string; bg: string; label: string }
> = {
  success: { color: "text-green-600", bg: "bg-green-100", label: "Success" },
  error: { color: "text-red-600", bg: "bg-red-100", label: "Error" },
  blocked: { color: "text-orange-600", bg: "bg-orange-100", label: "Blocked" },
  skipped: { color: "text-gray-500", bg: "bg-gray-100", label: "Skipped" },
  warning: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Warning" },
  "in-progress": {
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "In Progress",
  },
  pending: { color: "text-gray-400", bg: "bg-gray-50", label: "Pending" },
};

export const severityConfig: Record<
  Severity,
  { color: string; bg: string; borderColor: string }
> = {
  info: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  warning: {
    color: "text-yellow-600",
    bg: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  error: {
    color: "text-red-600",
    bg: "bg-red-50",
    borderColor: "border-red-200",
  },
  critical: {
    color: "text-red-800",
    bg: "bg-red-100",
    borderColor: "border-red-400",
  },
};

export const toolCategoryConfig: Record<
  ToolCategory,
  { color: string; icon: string }
> = {
  file_read: { color: "text-blue-500", icon: "📖" },
  file_write: { color: "text-green-500", icon: "✏️" },
  file_edit: { color: "text-yellow-500", icon: "📝" },
  search: { color: "text-purple-500", icon: "🔍" },
  shell: { color: "text-gray-600", icon: "💻" },
  agent: { color: "text-indigo-500", icon: "🤖" },
  web: { color: "text-cyan-500", icon: "🌐" },
  interaction: { color: "text-pink-500", icon: "💬" },
  other: { color: "text-gray-400", icon: "⚙️" },
};

export const executionStatusConfig: Record<
  ExecutionRun["status"],
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
  running: { color: "text-blue-600", bg: "bg-blue-100", label: "Running" },
  completed: {
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Completed",
  },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  cancelled: {
    color: "text-orange-600",
    bg: "bg-orange-100",
    label: "Cancelled",
  },
};
