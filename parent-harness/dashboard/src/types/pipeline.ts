/**
 * Pipeline types for waves, lanes, and task visualization
 * Ported from Vibe Platform with adaptations for parent-harness
 */

export type WaveStatus = 'pending' | 'active' | 'complete';
export type TaskStatus = 'pending' | 'running' | 'complete' | 'failed' | 'blocked' | 'skipped';
export type LaneCategory = 'database' | 'types' | 'api' | 'ui' | 'tests' | 'infrastructure';

export interface Wave {
  id: string;
  waveNumber: number;
  status: WaveStatus;
  tasksTotal: number;
  tasksCompleted: number;
  tasksRunning: number;
  tasksBlocked: number;
  actualParallelism: number;
}

export interface LaneTask {
  taskId: string;
  displayId: string;
  title: string;
  waveNumber: number;
  status: TaskStatus;
  durationMs?: number;
  agentId?: string;
  agentName?: string;
  blockReason?: string;
  blockingTaskId?: string;
}

export interface Lane {
  id: string;
  name: string;
  category: LaneCategory;
  status: 'pending' | 'active' | 'complete' | 'blocked';
  tasksTotal: number;
  tasksCompleted: number;
  tasks: LaneTask[];
}

export interface TaskDetailInfo {
  id: string;
  displayId: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
  priority?: string;
  phase?: number;
  owner?: string;
  queue?: string;
  effort?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  passCriteria?: string;
  testPlan?: string;
  acceptanceCriteria?: string[];
  dependencies: {
    dependsOn: TaskRelation[];
    blocks: TaskRelation[];
    relatedTo: TaskRelation[];
    duplicateOf: TaskRelation[];
    parentOf: TaskRelation[];
    childOf: TaskRelation[];
  };
  testResults: TestResult[];
  stateHistory: StateHistoryItem[];
}

export interface TaskRelation {
  id: string;
  displayId: string;
  title: string;
  status: string;
}

export interface TestResult {
  id: string;
  testName?: string;
  command: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  stdout?: string;
  stderr?: string;
  testLevel: number;
  testScope?: string;
}

export interface StateHistoryItem {
  id: string;
  fromStatus?: string;
  toStatus: string;
  changedBy: string;
  actorType: string;
  createdAt: string;
}

// Config objects
export const WAVE_STATUS_CONFIG: Record<WaveStatus, { color: string; bgColor: string }> = {
  pending: { color: 'text-gray-500', bgColor: 'bg-gray-300' },
  active: { color: 'text-blue-600', bgColor: 'bg-blue-500' },
  complete: { color: 'text-green-600', bgColor: 'bg-green-500' },
};

export const TASK_STATUS_CONFIG: Record<TaskStatus, { color: string; bgColor: string; borderColor: string }> = {
  pending: { color: 'text-gray-500', bgColor: 'bg-gray-100', borderColor: 'border-gray-200' },
  running: { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
  complete: { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
  failed: { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-300' },
  blocked: { color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-300' },
  skipped: { color: 'text-gray-400', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
};

export const LANE_CATEGORY_CONFIG: Record<LaneCategory, { color: string; bgColor: string }> = {
  database: { color: 'text-purple-600', bgColor: 'bg-purple-50' },
  types: { color: 'text-blue-600', bgColor: 'bg-blue-50' },
  api: { color: 'text-green-600', bgColor: 'bg-green-50' },
  ui: { color: 'text-pink-600', bgColor: 'bg-pink-50' },
  tests: { color: 'text-orange-600', bgColor: 'bg-orange-50' },
  infrastructure: { color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

// Session types for agent observability
export type AgentSessionStatus = 'running' | 'completed' | 'failed' | 'paused' | 'cancelled';

export interface LoopIteration {
  iteration: number;
  startedAt: string;
  completedAt?: string;
  status: AgentSessionStatus;
  tasksCompleted: number;
  tasksFailed: number;
  duration?: number;
  logFileId: string;
  logFilePreview?: string;
  errors?: string[];
  checkpoints?: {
    id: string;
    name: string;
    timestamp: string;
  }[];
}

export interface AgentSessionDetail {
  id: string;
  agentId: string;
  agentName: string;
  agentType: string;
  projectId?: string;
  projectName?: string;
  taskListId?: string;
  taskListName?: string;
  status: AgentSessionStatus;
  startedAt: string;
  completedAt?: string;
  parentSessionId?: string;
  childSessionIds?: string[];
  loopCount: number;
  currentIteration: number;
  iterations: LoopIteration[];
  totalTasksCompleted: number;
  totalTasksFailed: number;
  metadata?: Record<string, unknown>;
}
