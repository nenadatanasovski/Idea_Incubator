/**
 * Status Lifecycle Management
 *
 * Manages idea status transitions with validation and history tracking.
 */

import { run, query, getOne } from '../database/db.js';
import { logInfo, logWarning } from '../utils/logger.js';
import { createVersionSnapshot } from './versioning.js';
import {
  IdeaStatus,
  StatusHistoryEntry,
  VALID_STATUS_TRANSITIONS
} from '../types/incubation.js';

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: IdeaStatus, to: IdeaStatus): boolean {
  const validTargets = VALID_STATUS_TRANSITIONS[from] || [];
  return validTargets.includes(to);
}

/**
 * Update idea status with validation
 */
export async function updateIdeaStatus(
  ideaId: string,
  newStatus: IdeaStatus,
  reason?: string
): Promise<void> {
  // Get current status
  const idea = await getOne<{
    id: string;
    slug: string;
    status: string;
  }>(
    'SELECT id, slug, status FROM ideas WHERE id = ?',
    [ideaId]
  );

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const currentStatus = idea.status as IdeaStatus;

  // Validate transition
  if (currentStatus === newStatus) {
    logWarning(`Idea ${idea.slug} is already ${newStatus}`);
    return;
  }

  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid status transition: ${currentStatus} → ${newStatus}. ` +
      `Valid transitions from ${currentStatus}: ${VALID_STATUS_TRANSITIONS[currentStatus].join(', ')}`
    );
  }

  // Insert status history record
  await run(
    `INSERT INTO idea_status_history (idea_id, from_status, to_status, reason, changed_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [ideaId, currentStatus, newStatus, reason ?? null]
  );

  // Update idea
  await run(
    `UPDATE ideas
     SET status = ?, status_reason = ?, status_changed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
    [newStatus, reason ?? null, ideaId]
  );

  logInfo(`Status changed for ${idea.slug}: ${currentStatus} → ${newStatus}${reason ? ` (${reason})` : ''}`);
}

/**
 * Pause an active idea
 */
export async function pauseIdea(ideaId: string, reason: string): Promise<void> {
  await updateIdeaStatus(ideaId, 'paused', reason);
}

/**
 * Resume a paused idea
 */
export async function resumeIdea(ideaId: string): Promise<void> {
  await updateIdeaStatus(ideaId, 'active', 'Resumed');
}

/**
 * Abandon an idea (from active or paused)
 */
export async function abandonIdea(ideaId: string, reason: string): Promise<void> {
  await updateIdeaStatus(ideaId, 'abandoned', reason);
}

/**
 * Resurrect an abandoned or archived idea
 * Creates a new version snapshot to mark the resurrection
 */
export async function resurrectIdea(ideaId: string, reason: string): Promise<void> {
  // Get current status
  const idea = await getOne<{
    id: string;
    slug: string;
    status: string;
  }>(
    'SELECT id, slug, status FROM ideas WHERE id = ?',
    [ideaId]
  );

  if (!idea) {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const currentStatus = idea.status as IdeaStatus;

  if (currentStatus !== 'abandoned' && currentStatus !== 'archived') {
    throw new Error(
      `Can only resurrect abandoned or archived ideas. Current status: ${currentStatus}`
    );
  }

  // Create version snapshot before resurrection
  await createVersionSnapshot(ideaId, 'manual', `Resurrected: ${reason}`);

  // Update status
  await updateIdeaStatus(ideaId, 'active', `Resurrected: ${reason}`);

  logInfo(`Resurrected idea ${idea.slug}`);
}

/**
 * Archive an idea (from paused, abandoned, or completed)
 */
export async function archiveIdea(ideaId: string): Promise<void> {
  await updateIdeaStatus(ideaId, 'archived', 'Archived for long-term storage');
}

/**
 * Complete an active idea
 */
export async function completeIdea(ideaId: string): Promise<void> {
  await updateIdeaStatus(ideaId, 'completed', 'Idea ready to move forward');
}

/**
 * Get status history for an idea
 */
export async function getStatusHistory(ideaId: string): Promise<StatusHistoryEntry[]> {
  const rows = await query<{
    id: number;
    idea_id: string;
    from_status: string | null;
    to_status: string;
    reason: string | null;
    changed_at: string;
  }>(
    'SELECT * FROM idea_status_history WHERE idea_id = ? ORDER BY changed_at DESC',
    [ideaId]
  );

  return rows.map(row => ({
    id: row.id,
    ideaId: row.idea_id,
    fromStatus: row.from_status as IdeaStatus | null,
    toStatus: row.to_status as IdeaStatus,
    reason: row.reason || undefined,
    changedAt: new Date(row.changed_at)
  }));
}

/**
 * Get current status of an idea
 */
export async function getIdeaStatus(ideaId: string): Promise<{
  status: IdeaStatus;
  reason?: string;
  changedAt?: Date;
} | null> {
  const row = await getOne<{
    status: string;
    status_reason: string | null;
    status_changed_at: string | null;
  }>(
    'SELECT status, status_reason, status_changed_at FROM ideas WHERE id = ?',
    [ideaId]
  );

  if (!row) {
    return null;
  }

  return {
    status: row.status as IdeaStatus,
    reason: row.status_reason || undefined,
    changedAt: row.status_changed_at ? new Date(row.status_changed_at) : undefined
  };
}

/**
 * Get ideas by status
 */
export async function getIdeasByStatus(status: IdeaStatus): Promise<Array<{
  id: string;
  slug: string;
  title: string;
  status: IdeaStatus;
  statusReason?: string;
}>> {
  const rows = await query<{
    id: string;
    slug: string;
    title: string;
    status: string;
    status_reason: string | null;
  }>(
    'SELECT id, slug, title, status, status_reason FROM ideas WHERE status = ?',
    [status]
  );

  return rows.map(row => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status as IdeaStatus,
    statusReason: row.status_reason || undefined
  }));
}

/**
 * Format status history for display
 */
export function formatStatusHistory(history: StatusHistoryEntry[]): string {
  if (history.length === 0) {
    return 'No status history available.';
  }

  let output = `
## Status History

`;

  for (const entry of history) {
    const date = entry.changedAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const transition = entry.fromStatus
      ? `${entry.fromStatus} → ${entry.toStatus}`
      : entry.toStatus;

    output += `- **${date}**: ${transition}`;
    if (entry.reason) {
      output += `\n  Reason: ${entry.reason}`;
    }
    output += '\n';
  }

  return output;
}

/**
 * Get status badge color
 */
export function getStatusColor(status: IdeaStatus): string {
  const colors: Record<IdeaStatus, string> = {
    active: 'green',
    paused: 'yellow',
    abandoned: 'red',
    completed: 'blue',
    archived: 'gray'
  };
  return colors[status] || 'gray';
}

/**
 * Get status icon
 */
export function getStatusIcon(status: IdeaStatus): string {
  const icons: Record<IdeaStatus, string> = {
    active: '🟢',
    paused: '🟡',
    abandoned: '🔴',
    completed: '🔵',
    archived: '⚫'
  };
  return icons[status] || '⚪';
}
