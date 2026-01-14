/**
 * Task Agent Instance Manager
 *
 * Manages Task Agent instances - one per Task List or Evaluation Queue.
 * Links agents to Telegram channels and enforces the constraint that
 * only one Task Agent can manage a given task list at a time.
 *
 * Part of: PTE-140 to PTE-143
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, getOne, saveDb } from '../../../database/db.js';
import {
  TaskAgentInstance,
  TaskAgentStatus,
  TaskAgentActivity,
  TaskAgentActivityType,
} from '../../../types/task-agent.js';

/**
 * Database row for Task Agent instance
 */
interface TaskAgentInstanceRow {
  id: string;
  task_list_id: string | null;
  is_evaluation_queue: number;
  telegram_channel_id: string | null;
  telegram_bot_token: string | null;
  status: string;
  project_id: string;
  last_heartbeat_at: string | null;
  error_count: number;
  last_error: string | null;
  tasks_processed: number;
  suggestions_made: number;
  questions_asked: number;
  created_at: string;
  updated_at: string;
  terminated_at: string | null;
}

/**
 * Map database row to TaskAgentInstance object
 */
function mapAgentRow(row: TaskAgentInstanceRow): TaskAgentInstance {
  return {
    id: row.id,
    taskListId: row.task_list_id || undefined,
    isEvaluationQueue: row.is_evaluation_queue === 1,
    telegramChannelId: row.telegram_channel_id || undefined,
    telegramBotToken: row.telegram_bot_token || undefined,
    status: row.status as TaskAgentStatus,
    projectId: row.project_id,
    lastHeartbeatAt: row.last_heartbeat_at || undefined,
    errorCount: row.error_count,
    lastError: row.last_error || undefined,
    tasksProcessed: row.tasks_processed,
    suggestionsMade: row.suggestions_made,
    questionsAsked: row.questions_asked,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    terminatedAt: row.terminated_at || undefined,
  };
}

/**
 * Spawn a new Task Agent for a task list
 *
 * Part of: PTE-142
 *
 * @param taskListId Task list to manage
 * @param projectId Project ID
 * @param telegramChannelId Optional Telegram channel to link
 * @param telegramBotToken Optional Telegram bot token
 */
export async function spawnTaskAgent(
  taskListId: string,
  projectId: string,
  telegramChannelId?: string,
  telegramBotToken?: string
): Promise<TaskAgentInstance> {
  // PTE-143: Check if a Task Agent already exists for this task list
  const existing = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE task_list_id = ?
       AND status IN ('active', 'paused')`,
    [taskListId]
  );

  if (existing) {
    throw new Error(
      `Task Agent ${existing.id} is already managing task list ${taskListId}`
    );
  }

  // PTE-141: Check if Telegram channel is already linked to another agent
  if (telegramChannelId) {
    const telegramLinked = await getOne<TaskAgentInstanceRow>(
      `SELECT * FROM task_agent_instances
       WHERE telegram_channel_id = ?
         AND status IN ('active', 'paused')`,
      [telegramChannelId]
    );

    if (telegramLinked) {
      throw new Error(
        `Telegram channel ${telegramChannelId} is already linked to Task Agent ${telegramLinked.id}`
      );
    }
  }

  const id = uuidv4();

  await run(
    `INSERT INTO task_agent_instances (
      id, task_list_id, is_evaluation_queue, telegram_channel_id,
      telegram_bot_token, status, project_id
    ) VALUES (?, ?, 0, ?, ?, 'active', ?)`,
    [id, taskListId, telegramChannelId || null, telegramBotToken || null, projectId]
  );

  // Log activity
  await logActivity(id, 'task_created', { action: 'agent_spawned', taskListId });

  await saveDb();

  const row = await getOne<TaskAgentInstanceRow>(
    'SELECT * FROM task_agent_instances WHERE id = ?',
    [id]
  );

  return mapAgentRow(row!);
}

/**
 * Spawn a Task Agent for the Evaluation Queue
 *
 * @param projectId Project ID
 * @param telegramChannelId Optional Telegram channel to link
 * @param telegramBotToken Optional Telegram bot token
 */
export async function spawnEvaluationQueueAgent(
  projectId: string,
  telegramChannelId?: string,
  telegramBotToken?: string
): Promise<TaskAgentInstance> {
  // Check if an Evaluation Queue agent already exists for this project
  const existing = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE project_id = ?
       AND is_evaluation_queue = 1
       AND status IN ('active', 'paused')`,
    [projectId]
  );

  if (existing) {
    throw new Error(
      `Task Agent ${existing.id} is already managing the Evaluation Queue for project ${projectId}`
    );
  }

  // Check if Telegram channel is already linked
  if (telegramChannelId) {
    const telegramLinked = await getOne<TaskAgentInstanceRow>(
      `SELECT * FROM task_agent_instances
       WHERE telegram_channel_id = ?
         AND status IN ('active', 'paused')`,
      [telegramChannelId]
    );

    if (telegramLinked) {
      throw new Error(
        `Telegram channel ${telegramChannelId} is already linked to Task Agent ${telegramLinked.id}`
      );
    }
  }

  const id = uuidv4();

  await run(
    `INSERT INTO task_agent_instances (
      id, task_list_id, is_evaluation_queue, telegram_channel_id,
      telegram_bot_token, status, project_id
    ) VALUES (?, NULL, 1, ?, ?, 'active', ?)`,
    [id, telegramChannelId || null, telegramBotToken || null, projectId]
  );

  await logActivity(id, 'task_created', { action: 'evaluation_queue_agent_spawned', projectId });

  await saveDb();

  const row = await getOne<TaskAgentInstanceRow>(
    'SELECT * FROM task_agent_instances WHERE id = ?',
    [id]
  );

  return mapAgentRow(row!);
}

/**
 * Get a Task Agent by ID
 */
export async function getTaskAgent(agentId: string): Promise<TaskAgentInstance | null> {
  const row = await getOne<TaskAgentInstanceRow>(
    'SELECT * FROM task_agent_instances WHERE id = ?',
    [agentId]
  );

  if (!row) {
    return null;
  }

  return mapAgentRow(row);
}

/**
 * Get Task Agent for a task list
 */
export async function getTaskAgentForList(
  taskListId: string
): Promise<TaskAgentInstance | null> {
  const row = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE task_list_id = ?
       AND status IN ('active', 'paused')`,
    [taskListId]
  );

  if (!row) {
    return null;
  }

  return mapAgentRow(row);
}

/**
 * Get Task Agent for Evaluation Queue
 */
export async function getEvaluationQueueAgent(
  projectId: string
): Promise<TaskAgentInstance | null> {
  const row = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE project_id = ?
       AND is_evaluation_queue = 1
       AND status IN ('active', 'paused')`,
    [projectId]
  );

  if (!row) {
    return null;
  }

  return mapAgentRow(row);
}

/**
 * Get all active Task Agents
 */
export async function getActiveTaskAgents(
  projectId?: string
): Promise<TaskAgentInstance[]> {
  let sql = `SELECT * FROM task_agent_instances WHERE status IN ('active', 'paused')`;
  const params: string[] = [];

  if (projectId) {
    sql += ' AND project_id = ?';
    params.push(projectId);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = await query<TaskAgentInstanceRow>(sql, params);
  return rows.map(mapAgentRow);
}

/**
 * Link a Task Agent to a Telegram channel
 *
 * Part of: PTE-141
 */
export async function linkToTelegram(
  agentId: string,
  telegramChannelId: string,
  telegramBotToken?: string
): Promise<TaskAgentInstance> {
  // Check if channel is already linked to another agent
  const linked = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE telegram_channel_id = ?
       AND id != ?
       AND status IN ('active', 'paused')`,
    [telegramChannelId, agentId]
  );

  if (linked) {
    throw new Error(
      `Telegram channel ${telegramChannelId} is already linked to Task Agent ${linked.id}`
    );
  }

  await run(
    `UPDATE task_agent_instances
     SET telegram_channel_id = ?,
         telegram_bot_token = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [telegramChannelId, telegramBotToken || null, agentId]
  );

  await logActivity(agentId, 'task_created', { action: 'telegram_linked', telegramChannelId });

  await saveDb();

  return (await getTaskAgent(agentId))!;
}

/**
 * Unlink a Task Agent from Telegram
 */
export async function unlinkFromTelegram(agentId: string): Promise<TaskAgentInstance> {
  await run(
    `UPDATE task_agent_instances
     SET telegram_channel_id = NULL,
         telegram_bot_token = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await logActivity(agentId, 'task_created', { action: 'telegram_unlinked' });

  await saveDb();

  return (await getTaskAgent(agentId))!;
}

/**
 * Pause a Task Agent
 *
 * Part of: PTE-142
 */
export async function pauseTaskAgent(agentId: string): Promise<TaskAgentInstance> {
  await run(
    `UPDATE task_agent_instances
     SET status = 'paused',
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await logActivity(agentId, 'task_created', { action: 'agent_paused' });

  await saveDb();

  return (await getTaskAgent(agentId))!;
}

/**
 * Resume a paused Task Agent
 */
export async function resumeTaskAgent(agentId: string): Promise<TaskAgentInstance> {
  await run(
    `UPDATE task_agent_instances
     SET status = 'active',
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await logActivity(agentId, 'task_created', { action: 'agent_resumed' });

  await saveDb();

  return (await getTaskAgent(agentId))!;
}

/**
 * Terminate a Task Agent
 *
 * Part of: PTE-142
 */
export async function terminateTaskAgent(
  agentId: string,
  reason?: string
): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET status = 'terminated',
         terminated_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await logActivity(agentId, 'task_created', { action: 'agent_terminated', reason });

  await saveDb();
}

/**
 * Record a heartbeat from a Task Agent
 */
export async function recordHeartbeat(agentId: string): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET last_heartbeat_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await saveDb();
}

/**
 * Record an error for a Task Agent
 */
export async function recordError(
  agentId: string,
  errorMessage: string
): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET error_count = error_count + 1,
         last_error = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [errorMessage, agentId]
  );

  await logActivity(agentId, 'error_occurred', { error: errorMessage });

  await saveDb();
}

/**
 * Increment task processed counter
 */
export async function incrementTasksProcessed(agentId: string): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET tasks_processed = tasks_processed + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await saveDb();
}

/**
 * Increment suggestions made counter
 */
export async function incrementSuggestionsMade(agentId: string): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET suggestions_made = suggestions_made + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await saveDb();
}

/**
 * Increment questions asked counter
 */
export async function incrementQuestionsAsked(agentId: string): Promise<void> {
  await run(
    `UPDATE task_agent_instances
     SET questions_asked = questions_asked + 1,
         updated_at = datetime('now')
     WHERE id = ?`,
    [agentId]
  );

  await saveDb();
}

/**
 * Log an activity for a Task Agent
 */
export async function logActivity(
  agentId: string,
  activityType: TaskAgentActivityType,
  details?: Record<string, unknown>,
  taskId?: string,
  suggestionId?: string,
  buildAgentId?: string
): Promise<void> {
  await run(
    `INSERT INTO task_agent_activities (
      id, task_agent_id, activity_type, details, task_id, suggestion_id, build_agent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      agentId,
      activityType,
      details ? JSON.stringify(details) : null,
      taskId || null,
      suggestionId || null,
      buildAgentId || null,
    ]
  );

  await saveDb();
}

/**
 * Get recent activities for a Task Agent
 */
export async function getAgentActivities(
  agentId: string,
  limit = 50
): Promise<TaskAgentActivity[]> {
  const rows = await query<{
    id: string;
    task_agent_id: string;
    activity_type: string;
    details: string | null;
    task_id: string | null;
    suggestion_id: string | null;
    build_agent_id: string | null;
    created_at: string;
  }>(
    `SELECT * FROM task_agent_activities
     WHERE task_agent_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [agentId, limit]
  );

  return rows.map((row) => ({
    id: row.id,
    taskAgentId: row.task_agent_id,
    activityType: row.activity_type as TaskAgentActivityType,
    details: row.details ? JSON.parse(row.details) : undefined,
    taskId: row.task_id || undefined,
    suggestionId: row.suggestion_id || undefined,
    buildAgentId: row.build_agent_id || undefined,
    createdAt: row.created_at,
  }));
}

/**
 * Get Task Agent by Telegram channel ID
 */
export async function getAgentByTelegramChannel(
  telegramChannelId: string
): Promise<TaskAgentInstance | null> {
  const row = await getOne<TaskAgentInstanceRow>(
    `SELECT * FROM task_agent_instances
     WHERE telegram_channel_id = ?
       AND status IN ('active', 'paused')`,
    [telegramChannelId]
  );

  if (!row) {
    return null;
  }

  return mapAgentRow(row);
}

/**
 * Check if a task list has an active Task Agent
 *
 * Part of: PTE-143
 */
export async function hasActiveTaskAgent(taskListId: string): Promise<boolean> {
  const agent = await getTaskAgentForList(taskListId);
  return agent !== null;
}

/**
 * Get agent statistics
 */
export async function getAgentStats(
  projectId?: string
): Promise<{
  totalActive: number;
  totalPaused: number;
  totalTerminated: number;
  totalTasksProcessed: number;
  totalSuggestionsMade: number;
  totalQuestionsAsked: number;
}> {
  let whereClause = '';
  const params: string[] = [];

  if (projectId) {
    whereClause = 'WHERE project_id = ?';
    params.push(projectId);
  }

  const stats = await getOne<{
    active_count: number;
    paused_count: number;
    terminated_count: number;
    total_tasks: number;
    total_suggestions: number;
    total_questions: number;
  }>(
    `SELECT
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_count,
      SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) AS paused_count,
      SUM(CASE WHEN status = 'terminated' THEN 1 ELSE 0 END) AS terminated_count,
      SUM(tasks_processed) AS total_tasks,
      SUM(suggestions_made) AS total_suggestions,
      SUM(questions_asked) AS total_questions
    FROM task_agent_instances
    ${whereClause}`,
    params
  );

  return {
    totalActive: stats?.active_count || 0,
    totalPaused: stats?.paused_count || 0,
    totalTerminated: stats?.terminated_count || 0,
    totalTasksProcessed: stats?.total_tasks || 0,
    totalSuggestionsMade: stats?.total_suggestions || 0,
    totalQuestionsAsked: stats?.total_questions || 0,
  };
}

export default {
  spawnTaskAgent,
  spawnEvaluationQueueAgent,
  getTaskAgent,
  getTaskAgentForList,
  getEvaluationQueueAgent,
  getActiveTaskAgents,
  linkToTelegram,
  unlinkFromTelegram,
  pauseTaskAgent,
  resumeTaskAgent,
  terminateTaskAgent,
  recordHeartbeat,
  recordError,
  incrementTasksProcessed,
  incrementSuggestionsMade,
  incrementQuestionsAsked,
  logActivity,
  getAgentActivities,
  getAgentByTelegramChannel,
  hasActiveTaskAgent,
  getAgentStats,
};
