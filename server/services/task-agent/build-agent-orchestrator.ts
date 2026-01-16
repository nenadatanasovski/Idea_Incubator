/**
 * Build Agent Orchestrator
 *
 * Manages multiple Build Agent instances for parallel task execution.
 * Key principle: 1 Build Agent = 1 Task, unlimited agents per task list.
 *
 * Part of: PTE-062 to PTE-067
 */

import { v4 as uuidv4 } from "uuid";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { query, run, getOne, saveDb } from "../../../database/db.js";

/**
 * Orchestrator event emitter for execution events
 */
export const orchestratorEvents = new EventEmitter();
import {
  BuildAgentInstance,
  BuildAgentStatus,
  AgentHeartbeat,
  TaskIdentity,
  Task,
} from "../../../types/task-agent.js";
import {
  calculateWaves,
  getTaskListParallelism,
} from "./parallelism-calculator.js";
import { updateTaskStatus } from "./task-creation-service.js";

/**
 * Database row for Build Agent instance
 */
interface BuildAgentRow {
  id: string;
  task_id: string | null;
  task_list_id: string | null;
  process_id: string | null;
  hostname: string | null;
  status: string;
  last_heartbeat_at: string | null;
  heartbeat_count: number;
  consecutive_missed_heartbeats: number;
  tasks_completed: number;
  tasks_failed: number;
  total_duration_ms: number;
  spawned_at: string;
  terminated_at: string | null;
  termination_reason: string | null;
  error_message: string | null;
}

/**
 * Map database row to BuildAgentInstance object
 */
function mapAgentRow(row: BuildAgentRow): BuildAgentInstance {
  return {
    id: row.id,
    taskId: row.task_id || undefined,
    taskListId: row.task_list_id || undefined,
    processId: row.process_id || undefined,
    hostname: row.hostname || undefined,
    status: row.status as BuildAgentStatus,
    lastHeartbeatAt: row.last_heartbeat_at || undefined,
    heartbeatCount: row.heartbeat_count,
    consecutiveMissedHeartbeats: row.consecutive_missed_heartbeats,
    tasksCompleted: row.tasks_completed,
    tasksFailed: row.tasks_failed,
    totalDurationMs: row.total_duration_ms,
    spawnedAt: row.spawned_at,
    terminatedAt: row.terminated_at || undefined,
    terminationReason: row.termination_reason || undefined,
    errorMessage: row.error_message || undefined,
  };
}

/**
 * Active agent processes (in-memory tracking)
 */
const activeProcesses: Map<string, ChildProcess> = new Map();

/**
 * Heartbeat check interval
 */
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 90000; // 90 seconds

/**
 * Spawn a new Build Agent for a specific task
 *
 * @param taskId Task to execute
 * @param taskListId Task list containing the task
 * @returns Agent instance info
 */
export async function spawnBuildAgent(
  taskId: string,
  taskListId: string,
): Promise<BuildAgentInstance> {
  const id = uuidv4();

  // Create agent record
  await run(
    `INSERT INTO build_agent_instances (
      id, task_id, task_list_id, status, spawned_at
    ) VALUES (?, ?, ?, 'spawning', datetime('now'))`,
    [id, taskId, taskListId],
  );

  // Update task status
  await updateTaskStatus(taskId, "in_progress");

  // Spawn the Python Build Agent process
  try {
    const agentProcess = spawn(
      "python3",
      [
        "coding-loops/agents/build_agent_worker.py",
        "--agent-id",
        id,
        "--task-id",
        taskId,
        "--task-list-id",
        taskListId,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AGENT_ID: id,
          TASK_ID: taskId,
          TASK_LIST_ID: taskListId,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    // Track the process
    activeProcesses.set(id, agentProcess);

    // Update with process info
    await run(
      `UPDATE build_agent_instances
       SET status = 'running',
           process_id = ?,
           hostname = ?,
           last_heartbeat_at = datetime('now')
       WHERE id = ?`,
      [agentProcess.pid?.toString() || null, require("os").hostname(), id],
    );

    // Handle process events
    agentProcess.on("exit", async (code, signal) => {
      await handleAgentExit(id, taskId, code, signal);
    });

    agentProcess.on("error", async (error) => {
      await handleAgentError(id, taskId, error);
    });

    // Log stdout/stderr
    agentProcess.stdout?.on("data", (data) => {
      console.log(`[BuildAgent ${id}] stdout: ${data}`);
    });

    agentProcess.stderr?.on("data", (data) => {
      console.error(`[BuildAgent ${id}] stderr: ${data}`);
    });
  } catch (error) {
    // Failed to spawn
    await run(
      `UPDATE build_agent_instances
       SET status = 'terminated',
           terminated_at = datetime('now'),
           termination_reason = 'spawn_failed',
           error_message = ?
       WHERE id = ?`,
      [(error as Error).message, id],
    );

    await updateTaskStatus(taskId, "failed");
    throw error;
  }

  await saveDb();

  // Return the agent instance
  const row = await getOne<BuildAgentRow>(
    "SELECT * FROM build_agent_instances WHERE id = ?",
    [id],
  );

  return mapAgentRow(row!);
}

/**
 * Handle Build Agent process exit
 */
async function handleAgentExit(
  agentId: string,
  taskId: string,
  code: number | null,
  signal: NodeJS.Signals | null,
): Promise<void> {
  activeProcesses.delete(agentId);

  const success = code === 0;
  const status = success ? "completed" : "failed";
  const taskStatus = success ? "completed" : "failed";

  await run(
    `UPDATE build_agent_instances
     SET status = 'terminated',
         terminated_at = datetime('now'),
         termination_reason = ?,
         tasks_completed = tasks_completed + ?,
         tasks_failed = tasks_failed + ?
     WHERE id = ?`,
    [
      success ? "success" : `exit_code_${code || signal}`,
      success ? 1 : 0,
      success ? 0 : 1,
      agentId,
    ],
  );

  await updateTaskStatus(taskId, taskStatus);
  await saveDb();

  // Trigger next wave if successful
  if (success) {
    const agent = await getOne<BuildAgentRow>(
      "SELECT * FROM build_agent_instances WHERE id = ?",
      [agentId],
    );
    if (agent?.task_list_id) {
      await handleAgentCompletion(agentId, agent.task_list_id);
    }
  } else {
    // Handle failure
    const agent = await getOne<BuildAgentRow>(
      "SELECT * FROM build_agent_instances WHERE id = ?",
      [agentId],
    );
    if (agent?.task_list_id) {
      await handleAgentFailure(agentId, taskId, agent.task_list_id);
    }
  }
}

/**
 * Handle Build Agent process error
 */
async function handleAgentError(
  agentId: string,
  taskId: string,
  error: Error,
): Promise<void> {
  activeProcesses.delete(agentId);

  await run(
    `UPDATE build_agent_instances
     SET status = 'terminated',
         terminated_at = datetime('now'),
         termination_reason = 'process_error',
         error_message = ?,
         tasks_failed = tasks_failed + 1
     WHERE id = ?`,
    [error.message, agentId],
  );

  await updateTaskStatus(taskId, "failed");
  await saveDb();
}

/**
 * Assign a task to an existing idle agent
 *
 * @param agentId Agent ID
 * @param taskId Task ID
 */
export async function assignTaskToAgent(
  agentId: string,
  taskId: string,
): Promise<void> {
  // Verify agent is idle
  const agent = await getOne<BuildAgentRow>(
    "SELECT * FROM build_agent_instances WHERE id = ?",
    [agentId],
  );

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (agent.status !== "idle") {
    throw new Error(`Agent ${agentId} is not idle (status: ${agent.status})`);
  }

  if (agent.task_id) {
    throw new Error(`Agent ${agentId} already has task ${agent.task_id}`);
  }

  await run(
    `UPDATE build_agent_instances
     SET task_id = ?,
         status = 'running',
         last_heartbeat_at = datetime('now')
     WHERE id = ?`,
    [taskId, agentId],
  );

  await updateTaskStatus(taskId, "in_progress");
  await saveDb();
}

/**
 * Monitor agent health via heartbeats
 */
export async function monitorAgents(): Promise<{
  healthy: number;
  unhealthy: number;
  terminated: string[];
}> {
  const agents = await query<BuildAgentRow>(
    `SELECT * FROM build_agent_instances
     WHERE status NOT IN ('terminated')`,
  );

  let healthy = 0;
  let unhealthy = 0;
  const terminated: string[] = [];

  for (const agent of agents) {
    if (!agent.last_heartbeat_at) {
      unhealthy++;
      continue;
    }

    const lastHeartbeat = new Date(agent.last_heartbeat_at).getTime();
    const now = Date.now();
    const timeSinceHeartbeat = now - lastHeartbeat;

    if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT_MS) {
      // Agent is unhealthy
      unhealthy++;
      await run(
        `UPDATE build_agent_instances
         SET consecutive_missed_heartbeats = consecutive_missed_heartbeats + 1
         WHERE id = ?`,
        [agent.id],
      );

      // Terminate if too many missed heartbeats
      if (agent.consecutive_missed_heartbeats >= 3) {
        await terminateAgent(agent.id, "heartbeat_timeout");
        terminated.push(agent.id);
      }
    } else {
      healthy++;
      // Reset missed heartbeat counter
      if (agent.consecutive_missed_heartbeats > 0) {
        await run(
          `UPDATE build_agent_instances
           SET consecutive_missed_heartbeats = 0
           WHERE id = ?`,
          [agent.id],
        );
      }
    }
  }

  await saveDb();

  return { healthy, unhealthy, terminated };
}

/**
 * Terminate a Build Agent
 *
 * @param agentId Agent to terminate
 * @param reason Termination reason
 */
export async function terminateAgent(
  agentId: string,
  reason: string,
): Promise<void> {
  // Kill the process if still running
  const process = activeProcesses.get(agentId);
  if (process) {
    process.kill("SIGTERM");
    activeProcesses.delete(agentId);
  }

  // Get agent info
  const agent = await getOne<BuildAgentRow>(
    "SELECT * FROM build_agent_instances WHERE id = ?",
    [agentId],
  );

  // Update database
  await run(
    `UPDATE build_agent_instances
     SET status = 'terminated',
         terminated_at = datetime('now'),
         termination_reason = ?
     WHERE id = ?`,
    [reason, agentId],
  );

  // If agent had a task, mark it as failed or blocked
  if (agent?.task_id) {
    await updateTaskStatus(agent.task_id, "failed");
  }

  await saveDb();
}

/**
 * Handle successful agent completion - spawn next wave
 *
 * @param agentId Completed agent ID
 * @param taskListId Task list ID
 */
export async function handleAgentCompletion(
  agentId: string,
  taskListId: string,
): Promise<void> {
  console.log(
    `[BuildAgentOrchestrator] Agent ${agentId} completed, checking for next tasks`,
  );

  // Get tasks that are now ready to execute
  const readyTasks = await query<{ id: string; display_id: string }>(
    `SELECT t.id, t.display_id
     FROM tasks t
     WHERE t.task_list_id = ?
       AND t.status = 'pending'
       AND NOT EXISTS (
         SELECT 1 FROM task_relationships tr
         JOIN tasks dep ON tr.target_task_id = dep.id
         WHERE tr.source_task_id = t.id
           AND tr.relationship_type = 'depends_on'
           AND dep.status NOT IN ('completed', 'skipped')
       )
       AND NOT EXISTS (
         SELECT 1 FROM build_agent_instances ba
         WHERE ba.task_id = t.id
           AND ba.status NOT IN ('terminated')
       )
     ORDER BY t.position
     LIMIT 10`,
    [taskListId],
  );

  // Spawn agents for ready tasks
  for (const task of readyTasks) {
    try {
      await spawnBuildAgent(task.id, taskListId);
      console.log(
        `[BuildAgentOrchestrator] Spawned agent for task ${task.display_id}`,
      );
    } catch (error) {
      console.error(
        `[BuildAgentOrchestrator] Failed to spawn agent for task ${task.display_id}:`,
        error,
      );
    }
  }

  // Check if task list is complete
  const remaining = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM tasks
     WHERE task_list_id = ?
       AND status IN ('pending', 'in_progress', 'blocked')`,
    [taskListId],
  );

  if (remaining?.count === 0) {
    // All tasks complete
    await run(
      `UPDATE task_lists_v2
       SET status = 'completed',
           completed_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [taskListId],
    );
    await saveDb();
    console.log(`[BuildAgentOrchestrator] Task list ${taskListId} completed`);
  }
}

/**
 * Handle agent failure - stop dependent tasks only
 *
 * @param agentId Failed agent ID
 * @param failedTaskId Failed task ID
 * @param taskListId Task list ID
 */
export async function handleAgentFailure(
  agentId: string,
  failedTaskId: string,
  taskListId: string,
): Promise<void> {
  console.log(
    `[BuildAgentOrchestrator] Agent ${agentId} failed on task ${failedTaskId}`,
  );

  // Get tasks that depend on the failed task (direct and transitive)
  const dependentTasks = await query<{ id: string; display_id: string }>(
    `WITH RECURSIVE dependent_chain AS (
      SELECT source_task_id AS task_id
      FROM task_relationships
      WHERE target_task_id = ?
        AND relationship_type = 'depends_on'

      UNION ALL

      SELECT tr.source_task_id
      FROM task_relationships tr
      JOIN dependent_chain dc ON tr.target_task_id = dc.task_id
      WHERE tr.relationship_type = 'depends_on'
    )
    SELECT t.id, t.display_id
    FROM tasks t
    JOIN dependent_chain dc ON t.id = dc.task_id
    WHERE t.task_list_id = ?
      AND t.status = 'pending'`,
    [failedTaskId, taskListId],
  );

  // Mark dependent tasks as blocked
  for (const task of dependentTasks) {
    await run(
      `UPDATE tasks SET status = 'blocked', updated_at = datetime('now') WHERE id = ?`,
      [task.id],
    );
    console.log(
      `[BuildAgentOrchestrator] Blocked task ${task.display_id} (depends on failed task)`,
    );
  }

  await saveDb();

  // Continue with tasks that don't depend on the failed task
  await handleAgentCompletion(agentId, taskListId);
}

/**
 * Record a heartbeat from a Build Agent
 */
export async function recordHeartbeat(
  heartbeat: AgentHeartbeat,
): Promise<void> {
  // Update agent record
  await run(
    `UPDATE build_agent_instances
     SET last_heartbeat_at = datetime('now'),
         heartbeat_count = heartbeat_count + 1,
         consecutive_missed_heartbeats = 0,
         status = ?
     WHERE id = ?`,
    [heartbeat.status, heartbeat.agentId],
  );

  // Record detailed heartbeat
  await run(
    `INSERT INTO agent_heartbeats (id, agent_id, task_id, status, progress_percent, current_step, memory_mb, cpu_percent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      heartbeat.agentId,
      heartbeat.taskId || null,
      heartbeat.status,
      heartbeat.progressPercent || null,
      heartbeat.currentStep || null,
      heartbeat.memoryMb || null,
      heartbeat.cpuPercent || null,
    ],
  );

  await saveDb();
}

/**
 * Get all active Build Agents
 */
export async function getActiveAgents(
  taskListId?: string,
): Promise<BuildAgentInstance[]> {
  let sql = `SELECT * FROM build_agent_instances WHERE status NOT IN ('terminated')`;
  const params: string[] = [];

  if (taskListId) {
    sql += " AND task_list_id = ?";
    params.push(taskListId);
  }

  sql += " ORDER BY spawned_at DESC";

  const rows = await query<BuildAgentRow>(sql, params);
  return rows.map(mapAgentRow);
}

/**
 * Get Build Agent by ID
 */
export async function getAgent(
  agentId: string,
): Promise<BuildAgentInstance | null> {
  const row = await getOne<BuildAgentRow>(
    "SELECT * FROM build_agent_instances WHERE id = ?",
    [agentId],
  );

  if (!row) {
    return null;
  }

  return mapAgentRow(row);
}

/**
 * Start parallel execution of a task list
 *
 * @param taskListId Task list to execute
 * @param maxAgents Maximum concurrent agents (optional)
 */
export async function startExecution(
  taskListId: string,
  maxAgents?: number,
): Promise<{
  started: boolean;
  agentsSpawned: number;
  firstWaveTasks: TaskIdentity[];
}> {
  // Get task list config
  const taskList = await getOne<{
    max_parallel_agents: number;
    status: string;
  }>("SELECT max_parallel_agents, status FROM task_lists_v2 WHERE id = ?", [
    taskListId,
  ]);

  if (!taskList) {
    throw new Error(`Task list ${taskListId} not found`);
  }

  if (taskList.status === "in_progress") {
    throw new Error(`Task list ${taskListId} is already in progress`);
  }

  // Calculate waves
  const waves = await calculateWaves(taskListId);

  if (waves.length === 0) {
    return { started: false, agentsSpawned: 0, firstWaveTasks: [] };
  }

  // Update task list status
  await run(
    `UPDATE task_lists_v2
     SET status = 'in_progress',
         started_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskListId],
  );

  // Spawn agents for first wave
  const firstWave = waves[0];
  const limit = maxAgents || taskList.max_parallel_agents;
  const tasksToStart = firstWave.tasks.slice(0, limit);

  let agentsSpawned = 0;
  for (const task of tasksToStart) {
    try {
      await spawnBuildAgent(task.id, taskListId);
      agentsSpawned++;
    } catch (error) {
      console.error(
        `[BuildAgentOrchestrator] Failed to spawn agent for ${task.displayId}:`,
        error,
      );
    }
  }

  await saveDb();

  return {
    started: true,
    agentsSpawned,
    firstWaveTasks: tasksToStart,
  };
}

/**
 * Pause execution of a task list
 */
export async function pauseExecution(taskListId: string): Promise<void> {
  // Don't terminate running agents, just prevent new ones from starting
  await run(
    `UPDATE task_lists_v2
     SET status = 'paused',
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskListId],
  );
  await saveDb();
}

/**
 * Resume execution of a task list
 */
export async function resumeExecution(taskListId: string): Promise<void> {
  await run(
    `UPDATE task_lists_v2
     SET status = 'in_progress',
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskListId],
  );
  await saveDb();

  // Spawn agents for any ready tasks
  await handleAgentCompletion("resume", taskListId);
}

/**
 * Get tasks that are blocked by a specific failed task
 *
 * @param failedTaskId The failed task ID
 * @returns List of blocked tasks
 */
export async function getBlockedTasks(
  failedTaskId: string,
): Promise<Array<{ id: string; displayId: string }>> {
  const tasks = await query<{ id: string; display_id: string }>(
    `WITH RECURSIVE dependent_chain AS (
      SELECT source_task_id AS task_id
      FROM task_relationships
      WHERE target_task_id = ?
        AND relationship_type = 'depends_on'

      UNION ALL

      SELECT tr.source_task_id
      FROM task_relationships tr
      JOIN dependent_chain dc ON tr.target_task_id = dc.task_id
      WHERE tr.relationship_type = 'depends_on'
    )
    SELECT t.id, t.display_id
    FROM tasks t
    JOIN dependent_chain dc ON t.id = dc.task_id`,
    [failedTaskId],
  );

  return tasks.map((t) => ({ id: t.id, displayId: t.display_id }));
}

/**
 * Get orchestrator status
 *
 * @returns Orchestrator status with agent counts and task metrics
 */
export async function getOrchestratorStatus(): Promise<{
  activeListCount: number;
  runningAgentCount: number;
  totalTasksToday: number;
  completedToday: number;
  failedToday: number;
}> {
  // Get active task lists
  const activeLists = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM task_lists_v2 WHERE status = 'in_progress'`,
  );

  // Get running agents
  const runningAgents = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM build_agent_instances WHERE status = 'running'`,
  );

  // Get tasks from today
  const today = new Date().toISOString().split("T")[0];
  const tasksToday = await getOne<{
    total: number;
    completed: number;
    failed: number;
  }>(
    `SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM tasks
     WHERE date(updated_at) = date(?)`,
    [today],
  );

  return {
    activeListCount: activeLists?.count || 0,
    runningAgentCount: runningAgents?.count || 0,
    totalTasksToday: tasksToday?.total || 0,
    completedToday: tasksToday?.completed || 0,
    failedToday: tasksToday?.failed || 0,
  };
}

export default {
  spawnBuildAgent,
  assignTaskToAgent,
  monitorAgents,
  terminateAgent,
  handleAgentCompletion,
  handleAgentFailure,
  recordHeartbeat,
  getActiveAgents,
  getAgent,
  startExecution,
  pauseExecution,
  resumeExecution,
  getBlockedTasks,
  getOrchestratorStatus,
};
