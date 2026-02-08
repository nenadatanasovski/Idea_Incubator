/**
 * Task List Orchestrator
 *
 * Manages multiple concurrent task lists, handles cross-list file conflict
 * detection, and manages a global Build Agent pool.
 *
 * Part of: PTE-125 to PTE-128
 */

import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  TaskListV2,
  FileOperation,
} from "../../../types/task-agent.js";
import {
  getActiveAgents,
  startExecution,
  pauseExecution,
} from "./build-agent-orchestrator.js";

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  maxConcurrentLists: number;
  maxGlobalAgents: number;
  enableCrossListConflictDetection: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OrchestratorConfig = {
  maxConcurrentLists: 3,
  maxGlobalAgents: 10,
  enableCrossListConflictDetection: true,
};

/**
 * Cross-list conflict details
 */
export interface CrossListConflict {
  listAId: string;
  listAName: string;
  listBId: string;
  listBName: string;
  taskAId: string;
  taskADisplayId: string;
  taskBId: string;
  taskBDisplayId: string;
  filePath: string;
  operationA: FileOperation;
  operationB: FileOperation;
  conflictType: string;
}

/**
 * Orchestrator state
 */
interface OrchestratorState {
  activeLists: Set<string>;
  globalAgentCount: number;
  lastConflictCheck: Date | null;
}

let state: OrchestratorState = {
  activeLists: new Set(),
  globalAgentCount: 0,
  lastConflictCheck: null,
};

/**
 * Get current orchestrator configuration
 */
export async function getConfig(): Promise<OrchestratorConfig> {
  const row = await getOne<{
    max_concurrent_lists: number;
    max_global_agents: number;
    enable_cross_list_conflict_detection: number;
  }>("SELECT * FROM orchestrator_config LIMIT 1");

  if (!row) {
    return DEFAULT_CONFIG;
  }

  return {
    maxConcurrentLists: row.max_concurrent_lists,
    maxGlobalAgents: row.max_global_agents,
    enableCrossListConflictDetection:
      row.enable_cross_list_conflict_detection === 1,
  };
}

/**
 * Update orchestrator configuration
 *
 * Part of: PTE-128
 */
export async function updateConfig(
  updates: Partial<OrchestratorConfig>,
): Promise<OrchestratorConfig> {
  const current = await getConfig();
  const updated = { ...current, ...updates };

  await run(
    `INSERT INTO orchestrator_config (
      id, max_concurrent_lists, max_global_agents, enable_cross_list_conflict_detection
    ) VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      max_concurrent_lists = excluded.max_concurrent_lists,
      max_global_agents = excluded.max_global_agents,
      enable_cross_list_conflict_detection = excluded.enable_cross_list_conflict_detection,
      updated_at = datetime('now')`,
    [
      "default",
      updated.maxConcurrentLists,
      updated.maxGlobalAgents,
      updated.enableCrossListConflictDetection ? 1 : 0,
    ],
  );

  await saveDb();
  return updated;
}

/**
 * Get currently active task lists (in_progress status)
 */
export async function getActiveTaskLists(): Promise<TaskListV2[]> {
  const rows = await query<{
    id: string;
    name: string;
    description: string | null;
    project_id: string | null;
    status: string;
    max_parallel_agents: number;
    auto_execute: number;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    created_at: string;
    updated_at: string;
    started_at: string | null;
    completed_at: string | null;
  }>(
    `SELECT * FROM task_lists_v2
     WHERE status = 'in_progress'
     ORDER BY started_at ASC`,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    projectId: row.project_id || undefined,
    status: row.status as TaskListV2["status"],
    maxParallelAgents: row.max_parallel_agents,
    autoExecute: row.auto_execute === 1,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    failedTasks: row.failed_tasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  }));
}

/**
 * Check if a new task list can start execution
 */
export async function canStartExecution(taskListId: string): Promise<{
  canStart: boolean;
  reason?: string;
  crossListConflicts?: CrossListConflict[];
}> {
  const config = await getConfig();

  // Check concurrent list limit
  const activeLists = await getActiveTaskLists();
  if (activeLists.length >= config.maxConcurrentLists) {
    return {
      canStart: false,
      reason: `Maximum concurrent lists reached (${config.maxConcurrentLists})`,
    };
  }

  // Check global agent limit
  const allAgents = await getActiveAgents();
  if (allAgents.length >= config.maxGlobalAgents) {
    return {
      canStart: false,
      reason: `Maximum global agents reached (${config.maxGlobalAgents})`,
    };
  }

  // Check for cross-list file conflicts
  if (config.enableCrossListConflictDetection) {
    const conflicts = await detectCrossListConflicts(taskListId);
    if (conflicts.length > 0) {
      return {
        canStart: false,
        reason: `Cross-list file conflicts detected (${conflicts.length})`,
        crossListConflicts: conflicts,
      };
    }
  }

  return { canStart: true };
}

/**
 * Detect file conflicts between a task list and all currently executing lists
 *
 * Part of: PTE-126
 */
export async function detectCrossListConflicts(
  taskListId: string,
): Promise<CrossListConflict[]> {
  // Get file impacts for the new task list
  const newListImpacts = await query<{
    task_id: string;
    task_display_id: string;
    file_path: string;
    operation: string;
    list_id: string;
    list_name: string;
  }>(
    `SELECT
      tfi.task_id,
      t.display_id AS task_display_id,
      tfi.file_path,
      tfi.operation,
      tl.id AS list_id,
      tl.name AS list_name
    FROM task_file_impacts tfi
    JOIN tasks t ON tfi.task_id = t.id
    JOIN task_lists_v2 tl ON t.task_list_id = tl.id
    WHERE t.task_list_id = ?
      AND t.status IN ('pending', 'in_progress')`,
    [taskListId],
  );

  if (newListImpacts.length === 0) {
    return [];
  }

  // Get file impacts for all active lists
  const activeListImpacts = await query<{
    task_id: string;
    task_display_id: string;
    file_path: string;
    operation: string;
    list_id: string;
    list_name: string;
  }>(
    `SELECT
      tfi.task_id,
      t.display_id AS task_display_id,
      tfi.file_path,
      tfi.operation,
      tl.id AS list_id,
      tl.name AS list_name
    FROM task_file_impacts tfi
    JOIN tasks t ON tfi.task_id = t.id
    JOIN task_lists_v2 tl ON t.task_list_id = tl.id
    WHERE tl.status = 'in_progress'
      AND t.status IN ('pending', 'in_progress')`,
  );

  const conflicts: CrossListConflict[] = [];

  // Check for conflicts
  for (const newImpact of newListImpacts) {
    for (const activeImpact of activeListImpacts) {
      // Skip same file in same task
      if (newImpact.task_id === activeImpact.task_id) {
        continue;
      }

      // Check if same file
      if (
        normalizeFilePath(newImpact.file_path) !==
        normalizeFilePath(activeImpact.file_path)
      ) {
        continue;
      }

      // Check for conflict based on operation types
      const conflictType = getConflictType(
        newImpact.operation as FileOperation,
        activeImpact.operation as FileOperation,
      );

      if (conflictType !== "no_conflict") {
        conflicts.push({
          listAId: newImpact.list_id,
          listAName: newImpact.list_name,
          listBId: activeImpact.list_id,
          listBName: activeImpact.list_name,
          taskAId: newImpact.task_id,
          taskADisplayId: newImpact.task_display_id,
          taskBId: activeImpact.task_id,
          taskBDisplayId: activeImpact.task_display_id,
          filePath: newImpact.file_path,
          operationA: newImpact.operation as FileOperation,
          operationB: activeImpact.operation as FileOperation,
          conflictType,
        });
      }
    }
  }

  return conflicts;
}

/**
 * Normalize file path for comparison
 */
function normalizeFilePath(path: string): string {
  return path
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "")
    .toLowerCase();
}

/**
 * Get conflict type between two operations
 */
function getConflictType(opA: FileOperation, opB: FileOperation): string {
  // Conflict matrix
  const conflicts: Record<string, Record<string, string>> = {
    CREATE: {
      CREATE: "create_create",
      UPDATE: "no_conflict",
      DELETE: "create_delete",
      READ: "no_conflict",
    },
    UPDATE: {
      CREATE: "no_conflict",
      UPDATE: "write_write",
      DELETE: "write_delete",
      READ: "no_conflict",
    },
    DELETE: {
      CREATE: "create_delete",
      UPDATE: "write_delete",
      DELETE: "delete_delete",
      READ: "read_delete",
    },
    READ: {
      CREATE: "no_conflict",
      UPDATE: "no_conflict",
      DELETE: "read_delete",
      READ: "no_conflict",
    },
  };

  return conflicts[opA]?.[opB] || "no_conflict";
}

/**
 * Get global Build Agent pool status
 *
 * Part of: PTE-127
 */
export async function getGlobalAgentPool(): Promise<{
  totalActive: number;
  byTaskList: Array<{
    taskListId: string;
    taskListName: string;
    agentCount: number;
  }>;
  availableSlots: number;
}> {
  const config = await getConfig();

  // Get all active agents grouped by task list
  const agentsByList = await query<{
    task_list_id: string;
    list_name: string;
    agent_count: number;
  }>(
    `SELECT
      ba.task_list_id,
      tl.name AS list_name,
      COUNT(*) AS agent_count
    FROM build_agent_instances ba
    LEFT JOIN task_lists_v2 tl ON ba.task_list_id = tl.id
    WHERE ba.status NOT IN ('terminated')
    GROUP BY ba.task_list_id`,
  );

  const totalActive = agentsByList.reduce(
    (sum, row) => sum + row.agent_count,
    0,
  );

  return {
    totalActive,
    byTaskList: agentsByList.map((row) => ({
      taskListId: row.task_list_id,
      taskListName: row.list_name,
      agentCount: row.agent_count,
    })),
    availableSlots: Math.max(0, config.maxGlobalAgents - totalActive),
  };
}

/**
 * Calculate how many agents can be allocated to a task list
 */
export async function calculateAgentAllocation(
  taskListId: string,
): Promise<number> {
  const pool = await getGlobalAgentPool();

  // Get the task list's configured max
  const taskList = await getOne<{ max_parallel_agents: number }>(
    "SELECT max_parallel_agents FROM task_lists_v2 WHERE id = ?",
    [taskListId],
  );

  if (!taskList) {
    return 0;
  }

  // Return the minimum of: available global slots, task list max, remaining tasks
  const remainingTasks = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'evaluating')`,
    [taskListId],
  );

  return Math.min(
    pool.availableSlots,
    taskList.max_parallel_agents,
    remainingTasks?.count || 0,
  );
}

/**
 * Start execution of a task list with orchestrator checks
 */
export async function orchestratedStart(
  taskListId: string,
  maxAgents?: number,
): Promise<{
  started: boolean;
  reason?: string;
  agentsAllocated?: number;
  crossListConflicts?: CrossListConflict[];
}> {
  // Check if we can start
  const canStart = await canStartExecution(taskListId);

  if (!canStart.canStart) {
    return {
      started: false,
      reason: canStart.reason,
      crossListConflicts: canStart.crossListConflicts,
    };
  }

  // Calculate agent allocation
  const allocation = await calculateAgentAllocation(taskListId);

  if (allocation === 0) {
    return {
      started: false,
      reason: "No agents available for allocation",
    };
  }

  // Start execution with allocated agents
  const effectiveMax = maxAgents ? Math.min(maxAgents, allocation) : allocation;
  await startExecution(taskListId, effectiveMax);

  // Track in state
  state.activeLists.add(taskListId);
  state.globalAgentCount = (await getGlobalAgentPool()).totalActive;

  return {
    started: true,
    agentsAllocated: effectiveMax,
  };
}

/**
 * Stop execution of a task list
 */
export async function orchestratedStop(taskListId: string): Promise<void> {
  await pauseExecution(taskListId);
  state.activeLists.delete(taskListId);
  state.globalAgentCount = (await getGlobalAgentPool()).totalActive;
}

/**
 * Get orchestrator status
 */
export async function getOrchestratorStatus(): Promise<{
  config: OrchestratorConfig;
  activeLists: TaskListV2[];
  globalAgentPool: Awaited<ReturnType<typeof getGlobalAgentPool>>;
  crossListConflictsDetected: boolean;
}> {
  const config = await getConfig();
  const activeLists = await getActiveTaskLists();
  const pool = await getGlobalAgentPool();

  // Quick check for any cross-list conflicts
  let hasConflicts = false;
  for (const list of activeLists) {
    const conflicts = await detectCrossListConflicts(list.id);
    if (conflicts.length > 0) {
      hasConflicts = true;
      break;
    }
  }

  return {
    config,
    activeLists,
    globalAgentPool: pool,
    crossListConflictsDetected: hasConflicts,
  };
}

/**
 * Rebalance agents across active task lists
 * Called when a task list completes or when agents become available
 */
export async function rebalanceAgents(): Promise<void> {
  const activeLists = await getActiveTaskLists();
  const pool = await getGlobalAgentPool();

  if (pool.availableSlots === 0 || activeLists.length === 0) {
    return;
  }

  // Find lists that could use more agents
  for (const list of activeLists) {
    const allocation = await calculateAgentAllocation(list.id);
    if (allocation > 0) {
      // This list can use more agents - startExecution will spawn them
      console.log(
        `[TaskListOrchestrator] Rebalancing: allocating ${allocation} agents to ${list.name}`,
      );
      // Trigger agent spawning by checking for ready tasks
      // The buildAgentOrchestrator.handleAgentCompletion will handle this
    }
  }
}

export default {
  getConfig,
  updateConfig,
  getActiveTaskLists,
  canStartExecution,
  detectCrossListConflicts,
  getGlobalAgentPool,
  calculateAgentAllocation,
  orchestratedStart,
  orchestratedStop,
  getOrchestratorStatus,
  rebalanceAgents,
};
