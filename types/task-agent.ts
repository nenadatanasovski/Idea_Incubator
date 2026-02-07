/**
 * Task Agent Types
 *
 * TypeScript interfaces for the Parallel Task Execution system.
 * Part of: PTE-019 to PTE-024
 */

import type { Project } from "./project.js";

// ============================================
// Task Identity Types
// ============================================

/**
 * Task identity with both UUID and human-readable display ID
 */
export interface TaskIdentity {
  /** UUID primary key */
  id: string;
  /** Human-readable ID like TU-PROJ-FEA-042 */
  displayId: string;
}

/**
 * Task category enum matching database constraint
 */
export type TaskCategory =
  | "feature"
  | "bug"
  | "task"
  | "story"
  | "epic"
  | "spike"
  | "improvement"
  | "documentation"
  | "test"
  | "devops"
  | "design"
  | "research"
  | "infrastructure"
  | "security"
  | "performance"
  | "other";

/**
 * Task status enum
 */
export type TaskStatus =
  | "draft"
  | "evaluating"
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped";

/**
 * Task priority levels
 */
export type TaskPriority = "P1" | "P2" | "P3" | "P4";

/**
 * Task effort estimation
 */
export type TaskEffort = "trivial" | "small" | "medium" | "large" | "epic";

/**
 * Task owner type
 */
export type TaskOwner = "build_agent" | "human" | "task_agent";

/**
 * Queue type for listless tasks
 */
export type TaskQueue = "evaluation" | null;

/**
 * Complete Task interface
 */
export interface Task extends TaskIdentity {
  title: string;
  description?: string;
  category: TaskCategory;
  status: TaskStatus;
  queue: TaskQueue;
  taskListId?: string;
  projectId?: string;
  /** Populated project relation (when loaded with relations) */
  project?: Project;
  priority: TaskPriority;
  effort: TaskEffort;
  phase: number;
  position: number;
  owner: TaskOwner;
  assignedAgentId?: string;

  // Decomposition tracking
  /** Parent task ID if this is a subtask created via decomposition */
  parentTaskId?: string;
  /** True if this task has been decomposed into subtasks */
  isDecomposed?: boolean;
  /** Groups sibling subtasks from the same decomposition event */
  decompositionId?: string;

  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Task creation input
 */
export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  effort?: TaskEffort;
  projectId?: string;
  taskListId?: string;
  phase?: number;
  /** Parent task ID when creating via decomposition */
  parentTaskId?: string;
  /** Decomposition group ID when creating via decomposition */
  decompositionId?: string;
}

/**
 * Task update input
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string;
  category?: TaskCategory;
  status?: TaskStatus;
  priority?: TaskPriority;
  effort?: TaskEffort;
  phase?: number;
  position?: number;
  owner?: TaskOwner;
  assignedAgentId?: string;
  /** Mark task as decomposed */
  isDecomposed?: boolean;
}

// ============================================
// Evaluation Queue Types
// ============================================

/**
 * Task in the Evaluation Queue (listless task)
 */
export interface EvaluationQueueTask extends Task {
  queue: "evaluation";
  taskListId: undefined;
  /** Days in queue */
  daysInQueue: number;
  /** Task is > 3 days old */
  isStale: boolean;
  /** Related tasks found during analysis */
  relatedTasks?: TaskIdentity[];
  /** Duplicate candidates found */
  duplicateCandidates?: { taskId: string; similarity: number }[];
}

/**
 * Evaluation Queue statistics
 */
export interface EvaluationQueueStats {
  totalQueued: number;
  staleCount: number;
  newToday: number;
  avgDaysInQueue: number;
}

// ============================================
// File Impact Types
// ============================================

/**
 * File operation types
 */
export type FileOperation = "CREATE" | "UPDATE" | "DELETE" | "READ";

/**
 * Source of file impact estimation
 */
export type FileImpactSource =
  | "ai_estimate"
  | "pattern_match"
  | "user_declared"
  | "validated";

/**
 * File impact for a task
 */
export interface FileImpact {
  id: string;
  taskId: string;
  filePath: string;
  operation: FileOperation;
  confidence: number;
  source: FileImpactSource;
  wasAccurate?: boolean;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string;
}

/**
 * Input for creating/updating file impact
 */
export interface FileImpactInput {
  filePath: string;
  operation: FileOperation;
  confidence?: number;
  source?: FileImpactSource;
}

/**
 * Conflict type between two tasks
 */
export type ConflictType =
  | "create_create"
  | "write_write"
  | "create_delete"
  | "read_delete"
  | "no_conflict";

/**
 * File conflict details
 */
export interface FileConflict {
  filePath: string;
  taskAId: string;
  taskBId: string;
  operationA: FileOperation;
  operationB: FileOperation;
  conflictType: ConflictType;
  confidenceA: number;
  confidenceB: number;
}

// ============================================
// Parallelism Analysis Types
// ============================================

/**
 * Analysis result for a task pair
 */
export interface ParallelismAnalysis {
  id: string;
  taskAId: string;
  taskBId: string;
  canParallel: boolean;
  conflictType?: "dependency" | "file_conflict" | "resource_conflict";
  conflictDetails?: {
    dependencyChain?: string[];
    conflictingFiles?: FileConflict[];
    otherReason?: string;
  };
  analyzedAt: string;
  invalidatedAt?: string;
}

/**
 * Execution wave for a task list
 */
export interface ExecutionWave {
  id: string;
  taskListId: string;
  waveNumber: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  taskCount: number;
  completedCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
  tasks: TaskIdentity[];
}

/**
 * Parallelism analysis for a task list
 */
export interface TaskListParallelism {
  taskListId: string;
  totalTasks: number;
  totalWaves: number;
  maxWave: number;
  maxParallelism: number;
  parallelOpportunities: number;
  waves: ExecutionWave[];
}

// ============================================
// Build Agent Types
// ============================================

/**
 * Build Agent instance status
 */
export type BuildAgentStatus =
  | "spawning"
  | "idle"
  | "running"
  | "completing"
  | "terminated";

/**
 * Build Agent instance
 */
export interface BuildAgentInstance {
  id: string;
  taskId?: string;
  taskListId?: string;
  processId?: string;
  hostname?: string;
  status: BuildAgentStatus;
  lastHeartbeatAt?: string;
  heartbeatCount: number;
  consecutiveMissedHeartbeats: number;
  tasksCompleted: number;
  tasksFailed: number;
  totalDurationMs: number;
  spawnedAt: string;
  terminatedAt?: string;
  terminationReason?: string;
  errorMessage?: string;
}

/**
 * Agent heartbeat data
 */
export interface AgentHeartbeat {
  agentId: string;
  taskId?: string;
  status: BuildAgentStatus;
  progressPercent?: number;
  currentStep?: string;
  memoryMb?: number;
  cpuPercent?: number;
  recordedAt: string;
}

// ============================================
// Grouping Suggestion Types
// ============================================

/**
 * Grouping suggestion status
 */
export type GroupingSuggestionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "modified";

/**
 * Grouping trigger events
 */
export type GroupingTrigger = "task_created" | "dependency_changed" | "manual";

/**
 * Grouping suggestion
 */
export interface GroupingSuggestion {
  id: string;
  status: GroupingSuggestionStatus;
  suggestedName: string;
  suggestedTasks: string[]; // Task IDs
  groupingReason: string;
  similarityScore?: number;
  projectId?: string;
  triggeredBy?: GroupingTrigger;
  triggerTaskId?: string;
  createdTaskListId?: string;
  resolvedBy?: "user" | "system";
  resolvedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

/**
 * Task included in a suggestion
 */
export interface SuggestionTask {
  suggestionId: string;
  taskId: string;
  inclusionReason?: string;
  contributionScore?: number;
  wasIncluded: boolean;
}

/**
 * Grouping criteria weights (user configurable)
 */
export interface GroupingCriteriaWeights {
  projectId: string;
  fileOverlapWeight: number;
  dependencyWeight: number;
  semanticWeight: number;
  categoryWeight: number;
  componentWeight: number;
  minGroupSize: number;
  maxGroupSize: number;
  similarityThreshold: number;
}

// ============================================
// Task Relationship Types
// ============================================

/**
 * Relationship types between tasks
 * See: task-data-model-diagram.md for full specification
 */
export type RelationshipType =
  // Original 6 types
  | "depends_on" // Source depends on target (target must complete first)
  | "blocks" // Source blocks target
  | "related_to" // Thematic connection
  | "duplicate_of" // Source is duplicate of target
  | "parent_of" // Hierarchical parent
  | "child_of" // Hierarchical child
  // Additional 6 types (from spec)
  | "supersedes" // Source supersedes/replaces target
  | "implements" // Source implements target (task-to-task level)
  | "conflicts_with" // Source conflicts with target (cannot run together)
  | "enables" // Source enables target to proceed
  | "inspired_by" // Source was inspired by target
  | "tests"; // Source tests/validates target

/**
 * Task relationship
 */
export interface TaskRelationship {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationshipType: RelationshipType;
  createdAt: string;
}

/**
 * Dependency chain for a task
 */
export interface DependencyChain {
  taskId: string;
  dependencies: Array<{
    taskId: string;
    depth: number;
    displayId?: string;
    title?: string;
    status?: TaskStatus;
  }>;
  hasCircularDependency: boolean;
  circularPath?: string[];
}

// ============================================
// Task List Types
// ============================================

/**
 * Task list status
 */
export type TaskListStatus =
  | "draft"
  | "ready"
  | "in_progress"
  | "paused"
  | "completed"
  | "archived";

/**
 * Task list (v2)
 */
export interface TaskListV2 {
  id: string;
  name: string;
  description?: string;
  projectId?: string;
  /** Populated project relation (when loaded with relations) */
  project?: Project;
  status: TaskListStatus;
  maxParallelAgents: number;
  autoExecute: boolean;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Task list creation input
 */
export interface CreateTaskListInput {
  name: string;
  description?: string;
  projectId?: string;
  maxParallelAgents?: number;
  autoExecute?: boolean;
}

/**
 * Task list with summary statistics
 */
export interface TaskListWithSummary extends TaskListV2 {
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  failedCount: number;
  blockedCount: number;
}

// ============================================
// Task Agent Instance Types
// ============================================

/**
 * Task Agent instance status
 */
export type TaskAgentStatus = "active" | "paused" | "terminated";

/**
 * Task Agent instance
 */
export interface TaskAgentInstance {
  id: string;
  taskListId?: string;
  isEvaluationQueue: boolean;
  telegramChannelId?: string;
  telegramBotToken?: string;
  status: TaskAgentStatus;
  projectId: string;
  lastHeartbeatAt?: string;
  errorCount: number;
  lastError?: string;
  tasksProcessed: number;
  suggestionsMade: number;
  questionsAsked: number;
  createdAt: string;
  updatedAt: string;
  terminatedAt?: string;
}

/**
 * Task Agent activity types
 */
export type TaskAgentActivityType =
  | "task_created"
  | "task_analyzed"
  | "suggestion_created"
  | "suggestion_accepted"
  | "suggestion_rejected"
  | "wave_calculated"
  | "agent_spawned"
  | "agent_completed"
  | "agent_failed"
  | "question_sent"
  | "question_answered"
  | "error_occurred";

/**
 * Task Agent activity log entry
 */
export interface TaskAgentActivity {
  id: string;
  taskAgentId: string;
  activityType: TaskAgentActivityType;
  details?: Record<string, unknown>;
  taskId?: string;
  suggestionId?: string;
  buildAgentId?: string;
  createdAt: string;
}

// ============================================
// Component Types
// ============================================

/**
 * Component types for task classification
 */
export type ComponentType =
  | "database"
  | "types"
  | "api"
  | "service"
  | "ui"
  | "test"
  | "config"
  | "documentation"
  | "infrastructure"
  | "other";

/**
 * Task component assignment
 */
export interface TaskComponent {
  taskId: string;
  componentType: ComponentType;
  confidence: number;
  source: "inferred" | "user" | "validated";
}

// ============================================
// Display ID Generation Types
// ============================================

/**
 * Display ID format: TU-{PROJECT}-{CATEGORY}-{SEQUENCE}
 * Example: TU-PROJ-FEA-042
 */
export interface DisplayIdConfig {
  prefix: string; // Default: 'TU'
  projectCode: string; // 2-4 letter project code
  categoryCode: string; // 3 letter category code
  sequence: number; // Auto-incrementing sequence
}

/**
 * Category to 3-letter code mapping
 */
export const CATEGORY_CODES: Record<TaskCategory, string> = {
  feature: "FEA",
  bug: "BUG",
  task: "TSK",
  story: "STY",
  epic: "EPC",
  spike: "SPK",
  improvement: "IMP",
  documentation: "DOC",
  test: "TST",
  devops: "OPS",
  design: "DSN",
  research: "RSH",
  infrastructure: "INF",
  security: "SEC",
  performance: "PRF",
  other: "OTH",
};

// ============================================
// API Response Types
// ============================================

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Task creation response
 */
export interface CreateTaskResponse {
  task: Task;
  inEvaluationQueue: boolean;
  analysisTriggered: boolean;
}

/**
 * Grouping suggestion response with task details
 */
export interface GroupingSuggestionWithTasks extends GroupingSuggestion {
  tasks: Array<{
    task: TaskIdentity & { title: string };
    inclusionReason?: string;
    contributionScore?: number;
  }>;
}

// ============================================
// WebSocket Event Types
// ============================================

/**
 * Task event types for WebSocket
 */
export type TaskEventType =
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "task.ready"
  | "task.started"
  | "task.progress"
  | "task.completed"
  | "task.failed";

/**
 * Build Agent event types
 */
export type AgentEventType =
  | "agent.spawned"
  | "agent.heartbeat"
  | "agent.completed"
  | "agent.failed"
  | "agent.terminated";

/**
 * Execution event types
 */
export type ExecutionEventType =
  | "execution.started"
  | "execution.wave_started"
  | "execution.wave_completed"
  | "execution.completed"
  | "execution.paused"
  | "execution.resumed";

/**
 * Grouping event types
 */
export type GroupingEventType =
  | "grouping.suggested"
  | "grouping.accepted"
  | "grouping.rejected"
  | "grouping.expired";

/**
 * All WebSocket event types
 */
export type WebSocketEventType =
  | TaskEventType
  | AgentEventType
  | ExecutionEventType
  | GroupingEventType;

/**
 * Generic WebSocket event
 */
export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

// ============================================
// Task System V2 Types (IMPL-2.7)
// ============================================

// Re-export types from Task System V2
import type { TaskImpact } from "./task-impact.js";
import type { TaskAppendix } from "./task-appendix.js";
import type { TaskTestResult } from "./task-test.js";
import type { TaskStateHistoryEntry, TaskVersion } from "./task-version.js";

/**
 * Task with all related entities loaded
 */
export interface TaskWithRelations extends Task {
  impacts: TaskImpact[];
  appendices: TaskAppendix[];
  testResults: TaskTestResult[];
  stateHistory: TaskStateHistoryEntry[];
  versions: TaskVersion[];

  // PRD linkage (if any)
  linkedPrds: {
    prdId: string;
    prdTitle: string;
    requirementRef?: string;
  }[];
}

// Re-export for convenience
export type {
  TaskImpact,
  TaskAppendix,
  TaskTestResult,
  TaskStateHistoryEntry,
  TaskVersion,
};

// Re-export Project type
export type { Project } from "./project.js";
