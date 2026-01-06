/**
 * SUBAGENT STORE
 *
 * Persists sub-agent state to the database so it can be restored when resuming a session.
 */

import { query, run, saveDb } from '../../database/db.js';

console.log('[SubAgentStore] Module loaded');

export interface StoredSubAgent {
  id: string;
  sessionId: string;
  type: string;
  name: string;
  status: 'pending' | 'spawning' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

interface SubAgentRow {
  id: string;
  session_id: string;
  type: string;
  name: string;
  status: string;
  result: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  [key: string]: unknown;
}

/**
 * Save or update a sub-agent in the database
 */
export async function saveSubAgent(subagent: {
  id: string;
  sessionId: string;
  type: string;
  name: string;
  status: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}): Promise<void> {
  console.log(`[SubAgentStore] Saving sub-agent ${subagent.id}, status: ${subagent.status}`);

  await run(
    `INSERT OR REPLACE INTO ideation_subagents
     (id, session_id, type, name, status, result, error, started_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      subagent.id,
      subagent.sessionId,
      subagent.type,
      subagent.name,
      subagent.status,
      subagent.result || null,
      subagent.error || null,
      subagent.startedAt || new Date().toISOString(),
      subagent.completedAt || null,
    ]
  );

  await saveDb();
}

/**
 * Update a sub-agent's status
 */
export async function updateSubAgentStatus(
  id: string,
  status: StoredSubAgent['status'],
  updates?: { result?: string; error?: string }
): Promise<void> {
  console.log(`[SubAgentStore] Updating sub-agent ${id} status to: ${status}`);

  const completedAt = (status === 'completed' || status === 'failed')
    ? new Date().toISOString()
    : null;

  await run(
    `UPDATE ideation_subagents
     SET status = ?, result = COALESCE(?, result), error = COALESCE(?, error), completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [status, updates?.result || null, updates?.error || null, completedAt, id]
  );

  await saveDb();
}

/**
 * Get all sub-agents for a session
 */
export async function getSubAgentsBySession(sessionId: string): Promise<StoredSubAgent[]> {
  const rows = await query<SubAgentRow>(
    `SELECT * FROM ideation_subagents WHERE session_id = ? ORDER BY started_at ASC`,
    [sessionId]
  );

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    name: row.name,
    status: row.status as StoredSubAgent['status'],
    result: row.result || undefined,
    error: row.error || undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
  }));
}

/**
 * Delete all sub-agents for a session
 */
export async function deleteSubAgentsBySession(sessionId: string): Promise<void> {
  await run('DELETE FROM ideation_subagents WHERE session_id = ?', [sessionId]);
  await saveDb();
}

/**
 * Clear completed sub-agents for a session (before spawning new ones)
 */
export async function clearCompletedSubAgents(sessionId: string): Promise<void> {
  await run(
    `DELETE FROM ideation_subagents WHERE session_id = ? AND status IN ('completed', 'failed')`,
    [sessionId]
  );
  await saveDb();
}

export const subAgentStore = {
  save: saveSubAgent,
  updateStatus: updateSubAgentStatus,
  getBySession: getSubAgentsBySession,
  deleteBySession: deleteSubAgentsBySession,
  clearCompleted: clearCompletedSubAgents,
};
