/**
 * ARTIFACT STORE
 *
 * Persists session artifacts (research results, diagrams, etc.) to the database
 * so they can be restored when resuming a session.
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, saveDb } from '../../database/db.js';

export interface StoredArtifact {
  id: string;
  sessionId: string;
  type: 'research' | 'mermaid' | 'markdown' | 'code' | 'analysis' | 'comparison' | 'idea-summary';
  title: string;
  content: string | object;
  language?: string;
  queries?: string[];
  identifier?: string;
  status: 'pending' | 'loading' | 'ready' | 'error';
  error?: string;
  createdAt: string;
  updatedAt?: string;
}

interface ArtifactRow {
  id: string;
  session_id: string;
  type: string;
  title: string;
  content: string;
  language: string | null;
  queries: string | null;
  identifier: string | null;
  status: string;
  error: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Save an artifact to the database
 */
export async function saveArtifact(artifact: {
  id: string;
  sessionId: string;
  type: string;
  title: string;
  content: string | object;
  language?: string;
  queries?: string[];
  identifier?: string;
  status?: string;
  error?: string;
}): Promise<void> {
  const contentStr = typeof artifact.content === 'string'
    ? artifact.content
    : JSON.stringify(artifact.content);

  const queriesStr = artifact.queries ? JSON.stringify(artifact.queries) : null;

  console.log(`[ArtifactStore] Saving artifact ${artifact.id}, content length: ${contentStr.length}`);

  await run(
    `INSERT OR REPLACE INTO ideation_artifacts
     (id, session_id, type, title, content, language, queries, identifier, status, error, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      artifact.id,
      artifact.sessionId,
      artifact.type,
      artifact.title,
      contentStr,
      artifact.language || null,
      queriesStr,
      artifact.identifier || null,
      artifact.status || 'ready',
      artifact.error || null,
    ]
  );

  console.log(`[ArtifactStore] SQL executed, calling saveDb()`);
  await saveDb();
  console.log(`[ArtifactStore] saveDb() completed`);
}

/**
 * Get all artifacts for a session
 */
export async function getArtifactsBySession(sessionId: string): Promise<StoredArtifact[]> {
  const rows = await query<ArtifactRow>(
    `SELECT * FROM ideation_artifacts WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId]
  );

  return rows.map(row => ({
    id: row.id,
    sessionId: row.session_id,
    type: row.type as StoredArtifact['type'],
    title: row.title,
    content: tryParseJson(row.content),
    language: row.language || undefined,
    queries: row.queries ? JSON.parse(row.queries) : undefined,
    identifier: row.identifier || undefined,
    status: row.status as StoredArtifact['status'],
    error: row.error || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
}

/**
 * Delete all artifacts for a session
 */
export async function deleteArtifactsBySession(sessionId: string): Promise<void> {
  await run('DELETE FROM ideation_artifacts WHERE session_id = ?', [sessionId]);
  await saveDb();
}

/**
 * Update an artifact's status
 */
export async function updateArtifactStatus(
  artifactId: string,
  status: 'pending' | 'loading' | 'ready' | 'error',
  error?: string
): Promise<void> {
  await run(
    `UPDATE ideation_artifacts SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, error || null, artifactId]
  );
  await saveDb();
}

/**
 * Try to parse JSON, return string if parsing fails
 */
function tryParseJson(str: string): string | object {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export const artifactStore = {
  save: saveArtifact,
  getBySession: getArtifactsBySession,
  deleteBySession: deleteArtifactsBySession,
  updateStatus: updateArtifactStatus,
};
