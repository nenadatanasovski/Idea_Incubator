/**
 * Agent Activities - Activity log for agents
 */

import { query, getOne, run } from "./index.js";
import { v4 as uuidv4 } from "uuid";

export type ActivityType =
  | "task_assigned"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "file_read"
  | "file_write"
  | "command_executed"
  | "error_occurred"
  | "heartbeat"
  | "idle"
  | "spawned"
  | "terminated";

export interface AgentActivity {
  id: string;
  agent_id: string;
  activity_type: ActivityType;
  task_id: string | null;
  session_id: string | null;
  details: string | null; // JSON
  created_at: string;
}

export interface CreateActivityInput {
  agent_id: string;
  activity_type: ActivityType;
  task_id?: string;
  session_id?: string;
  details?: Record<string, unknown>;
}

/**
 * Log an agent activity
 */
export function logActivity(input: CreateActivityInput): AgentActivity {
  const id = uuidv4();
  const details = input.details ? JSON.stringify(input.details) : null;

  run(
    `
    INSERT INTO agent_activities (
      id, agent_id, activity_type, task_id, session_id, details
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      input.agent_id,
      input.activity_type,
      input.task_id ?? null,
      input.session_id ?? null,
      details,
    ],
  );

  return getActivity(id)!;
}

/**
 * Get a single activity by ID
 */
export function getActivity(id: string): AgentActivity | undefined {
  return getOne<AgentActivity>("SELECT * FROM agent_activities WHERE id = ?", [
    id,
  ]);
}

/**
 * Get activities for an agent
 */
export function getAgentActivities(
  agentId: string,
  options?: {
    limit?: number;
    offset?: number;
    activityType?: ActivityType;
    since?: string; // ISO datetime
  },
): AgentActivity[] {
  let sql = "SELECT * FROM agent_activities WHERE agent_id = ?";
  const params: unknown[] = [agentId];

  if (options?.activityType) {
    sql += " AND activity_type = ?";
    params.push(options.activityType);
  }

  if (options?.since) {
    sql += " AND created_at >= ?";
    params.push(options.since);
  }

  sql += " ORDER BY created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += " OFFSET ?";
    params.push(options.offset);
  }

  return query<AgentActivity>(sql, params);
}

/**
 * Get activities for a task
 */
export function getTaskActivities(
  taskId: string,
  options?: { limit?: number },
): AgentActivity[] {
  let sql =
    "SELECT * FROM agent_activities WHERE task_id = ? ORDER BY created_at DESC";
  const params: unknown[] = [taskId];

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  return query<AgentActivity>(sql, params);
}

/**
 * Get activities for a session
 */
export function getSessionActivities(
  sessionId: string,
  options?: { limit?: number },
): AgentActivity[] {
  let sql =
    "SELECT * FROM agent_activities WHERE session_id = ? ORDER BY created_at DESC";
  const params: unknown[] = [sessionId];

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  return query<AgentActivity>(sql, params);
}

/**
 * Get recent activities across all agents
 */
export function getRecentActivities(options?: {
  limit?: number;
  activityTypes?: ActivityType[];
  since?: string;
}): AgentActivity[] {
  let sql = "SELECT * FROM agent_activities WHERE 1=1";
  const params: unknown[] = [];

  if (options?.activityTypes && options.activityTypes.length > 0) {
    sql += ` AND activity_type IN (${options.activityTypes.map(() => "?").join(",")})`;
    params.push(...options.activityTypes);
  }

  if (options?.since) {
    sql += " AND created_at >= ?";
    params.push(options.since);
  }

  sql += " ORDER BY created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  return query<AgentActivity>(sql, params);
}

/**
 * Get the latest activity for an agent
 */
export function getLatestActivity(agentId: string): AgentActivity | undefined {
  return getOne<AgentActivity>(
    "SELECT * FROM agent_activities WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1",
    [agentId],
  );
}

/**
 * Count activities by type for an agent
 */
export function countActivitiesByType(
  agentId: string,
): Record<ActivityType, number> {
  const results = query<{ activity_type: ActivityType; count: number }>(
    "SELECT activity_type, COUNT(*) as count FROM agent_activities WHERE agent_id = ? GROUP BY activity_type",
    [agentId],
  );

  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.activity_type] = r.count;
  }
  return counts as Record<ActivityType, number>;
}

/**
 * Convenience: Log task assignment
 */
export function logTaskAssigned(
  agentId: string,
  taskId: string,
  sessionId?: string,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "task_assigned",
    task_id: taskId,
    session_id: sessionId,
  });
}

/**
 * Convenience: Log task started
 */
export function logTaskStarted(
  agentId: string,
  taskId: string,
  sessionId: string,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "task_started",
    task_id: taskId,
    session_id: sessionId,
  });
}

/**
 * Convenience: Log task completed
 */
export function logTaskCompleted(
  agentId: string,
  taskId: string,
  sessionId: string,
  details?: Record<string, unknown>,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "task_completed",
    task_id: taskId,
    session_id: sessionId,
    details,
  });
}

/**
 * Convenience: Log task failed
 */
export function logTaskFailed(
  agentId: string,
  taskId: string,
  sessionId: string,
  error: string,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "task_failed",
    task_id: taskId,
    session_id: sessionId,
    details: { error },
  });
}

/**
 * Convenience: Log agent spawned
 */
export function logAgentSpawned(
  agentId: string,
  taskId: string,
  sessionId: string,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "spawned",
    task_id: taskId,
    session_id: sessionId,
  });
}

/**
 * Convenience: Log agent terminated
 */
export function logAgentTerminated(
  agentId: string,
  sessionId: string,
  reason?: string,
): AgentActivity {
  return logActivity({
    agent_id: agentId,
    activity_type: "terminated",
    session_id: sessionId,
    details: reason ? { reason } : undefined,
  });
}

export default {
  logActivity,
  getActivity,
  getAgentActivities,
  getTaskActivities,
  getSessionActivities,
  getRecentActivities,
  getLatestActivity,
  countActivitiesByType,
  logTaskAssigned,
  logTaskStarted,
  logTaskCompleted,
  logTaskFailed,
  logAgentSpawned,
  logAgentTerminated,
};
