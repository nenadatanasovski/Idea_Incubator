/**
 * OBS-200: Core Transcript Types
 *
 * Foundational types for the unified transcript system.
 * All other observability types depend on these definitions.
 */

// =============================================================================
// ENTRY TYPE ENUMS
// =============================================================================

/**
 * All possible transcript entry types (15 total).
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
  | "rollback" // Rollback occurred
  | "lock_acquire" // File lock acquired
  | "lock_release"; // File lock released

/**
 * Categories for grouping transcript entries.
 */
export type EntryCategory =
  | "lifecycle" // Execution flow events (phase_start, phase_end, task_start, task_end)
  | "execution" // Alias for lifecycle
  | "tool_use" // Tool operations (tool_use)
  | "tool" // Alias for tool_use
  | "assertion" // Tests and validations (validation, assertion)
  | "decision" // Agent decisions (decision)
  | "discovery" // Learning and discoveries (discovery)
  | "coordination" // Locks, waves, handoffs (checkpoint, lock_acquire, lock_release)
  | "skill" // Skill-related events
  | "error"; // Error events

// =============================================================================
// CORE TRANSCRIPT ENTRY
// =============================================================================

/**
 * A single entry in the unified transcript.
 * Matches the database schema for obs_transcript_entries.
 */
export interface TranscriptEntry {
  // === IDENTITY ===
  id: string; // UUID for this entry
  timestamp: string; // ISO8601 with milliseconds
  sequence: number; // Monotonic sequence within execution

  // === CONTEXT ===
  executionId: string; // Execution run ID
  taskId: string | null; // Current task (if applicable)
  instanceId: string; // Build Agent instance ID
  waveNumber: number | null; // Parallel execution wave

  // === EVENT ===
  entryType: TranscriptEntryType;
  category: EntryCategory;

  // === CONTENT ===
  summary: string; // Human-readable summary (max 200 chars)
  details: Record<string, unknown> | null; // Structured details (type-specific)

  // === TRACEABILITY ===
  skillRef: SkillRef | null; // If skill was invoked
  toolCalls: ToolCallRef[] | null; // Tools used in this entry
  assertions: AssertionRef[] | null; // Test assertions (if validation)

  // === METRICS ===
  durationMs: number | null; // Time taken for this operation
  tokenEstimate: number | null; // Estimated tokens used

  // === METADATA ===
  createdAt: string; // Database creation timestamp
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
  skillRef?: SkillRef;
  durationMs?: number;
  tokenEstimate?: number;
}

// =============================================================================
// REFERENCE TYPES (Lightweight references for cross-linking)
// =============================================================================

/**
 * Lightweight reference to a skill invocation.
 */
export interface SkillRef {
  skillName: string;
  skillFile: string;
  lineNumber?: number;
  sectionTitle?: string;
}

/**
 * Lightweight reference to a tool call within a transcript entry.
 */
export interface ToolCallRef {
  toolUseId: string;
  tool: string;
  status: "done" | "error" | "blocked";
  durationMs: number;
}

/**
 * Lightweight reference to an assertion result.
 */
export interface AssertionRef {
  assertionId: string;
  category: string;
  result: "pass" | "fail" | "skip" | "warn";
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Generic paginated response wrapper.
 * Used for all list API responses.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Execution run status.
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Execution run summary.
 */
export interface ExecutionRun {
  id: string;
  taskListId: string;
  runNumber: number;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string | null;
  sessionId: string | null;
  waveCount: number;
  taskCount: number;
  completedCount: number;
  failedCount: number;
}
