/**
 * Pipeline Dashboard Types
 *
 * Type definitions for the parallelization-centric UI.
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

export interface LaneTask {
  id: string;
  taskId: string;
  displayId?: string;
  title: string;
  waveNumber: number;
  positionInWave: number;
  status: "pending" | "running" | "complete" | "failed" | "blocked" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  blockReason?: string;
  blockingTaskId?: string;
  agentId?: string;
  agentName?: string;
}

export interface Lane {
  id: string;
  sessionId: string;
  name: string;
  category: LaneCategory;
  filePatterns: string[];
  status: "idle" | "active" | "blocked" | "complete";
  blockReason?: string;
  currentAgentId?: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasks: LaneTask[];
}

export type LaneCategory =
  | "database"
  | "types"
  | "api"
  | "ui"
  | "tests"
  | "infrastructure";

/**
 * Test scopes - what part of the system is being tested
 */
export type TestScope = "codebase" | "api" | "ui" | "database" | "integration";

/**
 * Test scope configuration for UI display
 */
export const TEST_SCOPE_CONFIG: Record<
  TestScope,
  { label: string; description: string; color: string; bgColor: string }
> = {
  codebase: {
    label: "Codebase",
    description: "File existence, compilation, structure",
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  },
  database: {
    label: "Database",
    description: "Schema validation, migrations",
    color: "text-indigo-600",
    bgColor: "bg-indigo-100",
  },
  api: {
    label: "API",
    description: "Endpoint tests, contracts",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  ui: {
    label: "UI",
    description: "Component tests, rendering",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  integration: {
    label: "Integration",
    description: "Cross-system, E2E flows",
    color: "text-purple-600",
    bgColor: "bg-purple-100",
  },
};

/**
 * Ordered list of scopes for consistent display
 */
export const TEST_SCOPE_ORDER: TestScope[] = [
  "codebase",
  "database",
  "api",
  "ui",
  "integration",
];

export interface Wave {
  id: string;
  sessionId: string;
  waveNumber: number;
  status: "pending" | "active" | "complete";
  tasksTotal: number;
  tasksCompleted: number;
  tasksRunning: number;
  tasksFailed: number;
  tasksBlocked: number;
  maxParallelism: number;
  actualParallelism: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface Conflict {
  id: string;
  sessionId: string;
  taskAId: string;
  taskADisplayId?: string;
  taskATitle?: string;
  taskBId: string;
  taskBDisplayId?: string;
  taskBTitle?: string;
  conflictType: "file_conflict" | "dependency" | "resource_lock";
  details: string;
  filePath?: string;
  operationA?: string;
  operationB?: string;
  resolvedAt?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "idle" | "working" | "error";
  currentTaskId?: string;
  currentTaskTitle?: string;
  laneId?: string;
  heartbeatAt?: string;
  heartbeatAgeSeconds: number;
}

export interface PipelineStatus {
  sessionId: string;
  status: "idle" | "running" | "paused" | "complete";
  lanes: Lane[];
  waves: Wave[];
  activeWaveNumber: number;
  agents: AgentStatus[];
  conflicts: Conflict[];
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
}

export interface PipelineEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  eventType: PipelineEventType;
  payload: Record<string, unknown>;
}

export type PipelineEventType =
  | "wave:started"
  | "wave:completed"
  | "task:started"
  | "task:completed"
  | "task:failed"
  | "task:blocked"
  | "task:unblocked"
  | "agent:assigned"
  | "agent:idle"
  | "agent:error"
  | "conflict:detected"
  | "dependency:resolved";

// Category configuration for visual styling (light theme)
export const LANE_CATEGORY_CONFIG: Record<
  LaneCategory,
  { color: string; bgColor: string; icon: string; label: string }
> = {
  database: {
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    icon: "Database",
    label: "Database",
  },
  types: {
    color: "text-teal-600",
    bgColor: "bg-teal-50",
    icon: "Code2",
    label: "Types",
  },
  api: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    icon: "Server",
    label: "API",
  },
  ui: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    icon: "Layout",
    label: "UI",
  },
  tests: {
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    icon: "TestTube2",
    label: "Tests",
  },
  infrastructure: {
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    icon: "Settings",
    label: "Infra",
  },
};

// Status colors (light theme)
export const TASK_STATUS_CONFIG: Record<
  LaneTask["status"],
  { color: string; bgColor: string; borderColor: string; label: string }
> = {
  pending: {
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-300",
    label: "Pending",
  },
  running: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-400",
    label: "Running",
  },
  complete: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-400",
    label: "Complete",
  },
  failed: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-400",
    label: "Failed",
  },
  blocked: {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-400",
    label: "Blocked",
  },
  skipped: {
    color: "text-gray-500",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-300",
    label: "Skipped",
  },
};

export const WAVE_STATUS_CONFIG: Record<
  Wave["status"],
  { color: string; bgColor: string; label: string }
> = {
  pending: {
    color: "text-gray-500",
    bgColor: "bg-gray-300",
    label: "Pending",
  },
  active: {
    color: "text-blue-600",
    bgColor: "bg-blue-500",
    label: "Active",
  },
  complete: {
    color: "text-green-600",
    bgColor: "bg-green-500",
    label: "Complete",
  },
};

// ================================
// Task Detail Types
// ================================

export interface TaskRelation {
  taskId: string;
  displayId?: string;
  title: string;
  status: string;
  relationshipType: string;
}

export interface TaskDetailInfo {
  // Core task data
  id: string;
  displayId?: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  priority?: string;
  effort?: string;
  phase?: number;
  position?: number;
  owner?: string;
  assignedAgentId?: string;
  queue?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;

  // Task list info
  taskList?: {
    id: string;
    name: string;
    description?: string;
    status: string;
    projectId?: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    createdAt: string;
    updatedAt: string;
  };

  // Dependencies (11 relationship types per task-data-model-diagram.md)
  dependencies: {
    // Original 6 types
    dependsOn: TaskRelation[];
    blocks: TaskRelation[];
    relatedTo: TaskRelation[];
    duplicateOf: TaskRelation[];
    parentOf: TaskRelation[];
    childOf: TaskRelation[];
    // Additional 6 types
    supersedes: TaskRelation[];
    implements: TaskRelation[];
    conflictsWith: TaskRelation[];
    enables: TaskRelation[];
    inspiredBy: TaskRelation[];
    tests: TaskRelation[];
  };

  // File impacts
  fileImpacts: {
    id: string;
    filePath: string;
    operation: string;
    confidence: number;
    source: string;
    wasAccurate?: boolean;
    createdAt: string;
  }[];

  // File changes (actual changes after execution)
  fileChanges: {
    id: string;
    filePath: string;
    operation: string;
    linesAdded?: number;
    linesRemoved?: number;
    recordedAt: string;
  }[];

  // Test results
  testResults: {
    id: string;
    testLevel: number;
    testScope?: TestScope;
    testName?: string;
    command: string;
    exitCode: number;
    stdout?: string;
    stderr?: string;
    durationMs: number;
    passed: boolean;
    agentId?: string;
    createdAt: string;
  }[];

  // State history
  stateHistory: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedBy: string;
    actorType: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }[];

  // Versions
  versions: {
    id: string;
    version: number;
    changedFields: string[];
    changeReason?: string;
    isCheckpoint: boolean;
    checkpointName?: string;
    createdBy: string;
    createdAt: string;
  }[];

  // Appendices
  appendices: {
    id: string;
    appendixType: string;
    contentType: string;
    content?: string;
    referenceId?: string;
    referenceTable?: string;
    metadata?: { scope?: TestScope; priority?: string };
    position: number;
    createdAt: string;
  }[];

  // PRD connections
  prds: {
    id: string;
    slug: string;
    title: string;
    status: string;
    linkType: string;
    requirementRef?: string;
  }[];
}

// ================================
// Filter Options for Pipeline Dashboard
// ================================

export interface ProjectOption {
  projectId: string;
  projectName: string;
  projectCode: string;
  taskCount: number;
}

export interface TaskListOption {
  id: string;
  name: string;
  projectId: string | null;
  taskCount: number;
  status: string;
}

export interface PipelineFilters {
  projectId: string | null;
  taskListId: string | null;
}
