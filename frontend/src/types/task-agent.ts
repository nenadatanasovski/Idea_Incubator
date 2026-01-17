/**
 * Task Agent Frontend Types
 *
 * Types for the Parallel Task Execution system UI components.
 * Part of: PTE-082 to PTE-095
 */

// Task statuses
export type TaskStatus =
  | "pending"
  | "evaluating"
  | "in_progress"
  | "completed"
  | "failed"
  | "blocked"
  | "skipped";

// Task queue types
export type TaskQueue = "evaluation" | null;

// File operation types
export type FileOperation = "CREATE" | "UPDATE" | "DELETE" | "READ";

// Task identity with UUID + display_id
export interface TaskIdentity {
  id: string;
  displayId: string;
}

// Evaluation Queue task
export interface EvaluationQueueTask {
  id: string;
  displayId: string;
  title: string;
  description?: string;
  category?: string;
  status: TaskStatus;
  createdAt: string;
  projectId?: string;
  projectName?: string;
  relatedTaskCount: number;
  groupingSuggestionId?: string;
  daysInQueue: number;
  isStale: boolean;
}

// File impact for a task
export interface FileImpact {
  id: string;
  taskId: string;
  filePath: string;
  operation: FileOperation;
  confidence: number;
  source: "ai" | "pattern" | "user" | "validated";
}

// File conflict between tasks
export interface FileConflict {
  filePath: string;
  operationA: FileOperation;
  operationB: FileOperation;
  conflictType:
    | "write_write"
    | "write_delete"
    | "create_create"
    | "delete_read";
}

// Parallelism analysis result
export interface ParallelismAnalysis {
  id: string;
  taskAId: string;
  taskADisplayId: string;
  taskBId: string;
  taskBDisplayId: string;
  canParallel: boolean;
  conflictType?: "dependency" | "file_conflict" | null;
  conflictDetails?: {
    dependencyChain?: string[];
    conflictingFiles?: FileConflict[];
  };
  analyzedAt: string;
}

// Execution wave
export interface ExecutionWave {
  id: string;
  taskListId: string;
  waveNumber: number;
  status: "pending" | "executing" | "completed" | "failed";
  tasks: TaskIdentity[];
  taskCount: number;
  completedCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
}

// Build Agent instance
export interface BuildAgentInstance {
  id: string;
  taskListId: string;
  taskId: string;
  taskDisplayId: string;
  status: "spawning" | "running" | "completed" | "failed" | "terminated";
  waveId?: string;
  spawnedAt: string;
  lastHeartbeat?: string;
  completedAt?: string;
  error?: string;
}

// Grouping suggestion
export interface GroupingSuggestion {
  id: string;
  suggestedListName: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  tasks: TaskIdentity[];
  taskCount: number;
  score: number;
  reasoning: string;
  createdAt: string;
  expiresAt: string;
}

// Task list parallelism summary
export interface TaskListParallelism {
  taskListId: string;
  taskListName: string;
  totalTasks: number;
  totalWaves: number;
  maxParallelism: number;
  parallelOpportunities: number;
  waves: ExecutionWave[];
  activeAgents: BuildAgentInstance[];
}

// Evaluation Queue statistics
export interface EvaluationQueueStats {
  totalQueued: number;
  staleCount: number;
  newToday: number;
  avgDaysInQueue: number;
  pendingSuggestions: number;
}

// Quick add task input
export interface QuickAddTaskInput {
  title: string;
  description?: string;
  projectId?: string;
  category?: string;
  targetTaskListId?: string;
}

// Task relationship type
// See: task-data-model-diagram.md for full specification (11 types)
export type RelationshipType =
  // Original 6 types
  | "depends_on" // Source depends on target (target must complete first)
  | "blocks" // Source blocks target
  | "related_to" // Thematic connection
  | "parent_of" // Hierarchical parent
  | "child_of" // Hierarchical child
  | "duplicate_of" // Source is duplicate of target
  // Additional 6 types (from spec)
  | "supersedes" // Source supersedes/replaces target
  | "implements" // Source implements target (task-to-task level)
  | "conflicts_with" // Source conflicts with target (cannot run together)
  | "enables" // Source enables target to proceed
  | "inspired_by" // Source was inspired by target
  | "tests"; // Source tests/validates target

// Task relationship
export interface TaskRelationship {
  id: string;
  sourceTaskId: string;
  sourceDisplayId: string;
  targetTaskId: string;
  targetDisplayId: string;
  relationshipType: RelationshipType;
  metadata?: {
    similarity?: number;
    reason?: string;
  };
}

// Circular dependency detection result
export interface CircularDependencyResult {
  hasCycle: boolean;
  cyclePath?: string[];
  cycleDisplayIds?: string[];
  recommendation?: {
    action: "remove_dependency";
    sourceTaskId: string;
    targetTaskId: string;
    reason: string;
  };
}

// Wave execution status
export type WaveStatus = "pending" | "executing" | "completed" | "failed";

// Agent status
export type AgentStatus =
  | "spawning"
  | "running"
  | "completed"
  | "failed"
  | "terminated";

// Status configuration for consistent styling
export const taskStatusConfig: Record<
  TaskStatus,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
  evaluating: {
    color: "text-blue-500",
    bg: "bg-blue-100",
    label: "Evaluating",
  },
  in_progress: {
    color: "text-amber-600",
    bg: "bg-amber-100",
    label: "In Progress",
  },
  completed: {
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Completed",
  },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  blocked: { color: "text-orange-600", bg: "bg-orange-100", label: "Blocked" },
  skipped: { color: "text-gray-400", bg: "bg-gray-50", label: "Skipped" },
};

export const waveStatusConfig: Record<
  WaveStatus,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "text-gray-500", bg: "bg-gray-100", label: "Pending" },
  executing: { color: "text-blue-600", bg: "bg-blue-100", label: "Executing" },
  completed: {
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Completed",
  },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "Failed" },
};

export const agentStatusConfig: Record<
  AgentStatus,
  { color: string; bg: string; label: string }
> = {
  spawning: {
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    label: "Spawning",
  },
  running: { color: "text-green-600", bg: "bg-green-100", label: "Running" },
  completed: { color: "text-blue-600", bg: "bg-blue-100", label: "Completed" },
  failed: { color: "text-red-600", bg: "bg-red-100", label: "Failed" },
  terminated: {
    color: "text-gray-600",
    bg: "bg-gray-100",
    label: "Terminated",
  },
};

// Category codes for display IDs
export const CATEGORY_CODES: Record<string, string> = {
  feature: "FEA",
  bug: "BUG",
  enhancement: "ENH",
  refactor: "REF",
  documentation: "DOC",
  test: "TST",
  infrastructure: "INF",
  design: "DES",
  research: "RES",
  planning: "PLN",
  review: "REV",
  deployment: "DEP",
  security: "SEC",
  performance: "PRF",
  maintenance: "MNT",
  other: "OTH",
};
