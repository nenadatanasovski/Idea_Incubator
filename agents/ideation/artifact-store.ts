/**
 * ARTIFACT STORE
 *
 * Persists session artifacts (research results, diagrams, etc.) to the database
 * so they can be restored when resuming a session.
 *
 * @deprecated This module is deprecated. Use `unified-artifact-store.ts` for new code.
 * The functions in this module continue to work but will log deprecation warnings.
 * Migration path: Import from `./unified-artifact-store.js` instead.
 */

import { query, run, saveDb } from "../../database/db.js";

/**
 * Convert SQLite CURRENT_TIMESTAMP format to ISO 8601 with UTC indicator.
 * SQLite stores UTC time as "2026-01-19 04:36:54" but JavaScript interprets
 * this as local time without the Z suffix. This function adds the Z suffix
 * to ensure correct timezone handling.
 */
function sqliteDateToISO(sqliteDate: string | null | undefined): string {
  if (!sqliteDate) {
    return new Date().toISOString();
  }
  // SQLite format: "2026-01-19 04:36:54"
  // ISO 8601 format: "2026-01-19T04:36:54.000Z"
  // Replace space with T, add .000Z suffix
  const isoDate = sqliteDate.replace(" ", "T") + ".000Z";
  return isoDate;
}

// Track if deprecation warnings have been logged (to avoid spam)
const deprecationWarningsLogged: Record<string, boolean> = {};

/**
 * Log a deprecation warning (only once per function)
 */
function logDeprecation(functionName: string, alternative: string): void {
  if (!deprecationWarningsLogged[functionName]) {
    console.warn(
      `[DEPRECATED] ${functionName} from artifact-store.ts is deprecated. ` +
        `Use ${alternative} from unified-artifact-store.ts instead.`,
    );
    deprecationWarningsLogged[functionName] = true;
  }
}

export interface StoredArtifact {
  id: string;
  sessionId: string;
  type:
    | "research"
    | "mermaid"
    | "markdown"
    | "code"
    | "analysis"
    | "comparison"
    | "idea-summary";
  title: string;
  content: string | object;
  language?: string;
  queries?: string[];
  identifier?: string;
  status: "pending" | "loading" | "ready" | "error";
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
  [key: string]: unknown;
}

/**
 * Save an artifact to the database
 *
 * @deprecated Use `saveArtifact` from `unified-artifact-store.ts` instead.
 * This function continues to work for backward compatibility.
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
  logDeprecation("saveArtifact", "saveArtifact");

  const contentStr =
    typeof artifact.content === "string"
      ? artifact.content
      : JSON.stringify(artifact.content);

  const queriesStr = artifact.queries ? JSON.stringify(artifact.queries) : null;

  console.log(
    `[ArtifactStore] Saving artifact ${artifact.id}, content length: ${contentStr.length}`,
  );

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
      artifact.status || "ready",
      artifact.error || null,
    ],
  );

  console.log(`[ArtifactStore] SQL executed, calling saveDb()`);
  await saveDb();
  console.log(`[ArtifactStore] saveDb() completed`);
}

/**
 * Get all artifacts for a session
 *
 * @deprecated Use `listArtifacts` from `unified-artifact-store.ts` filtered by sessionId instead.
 * This function continues to work for backward compatibility.
 */
export async function getArtifactsBySession(
  sessionId: string,
): Promise<StoredArtifact[]> {
  logDeprecation(
    "getArtifactsBySession",
    "listArtifacts (with sessionId filter)",
  );

  const rows = await query<ArtifactRow>(
    `SELECT * FROM ideation_artifacts WHERE session_id = ? ORDER BY created_at ASC`,
    [sessionId],
  );

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    type: row.type as StoredArtifact["type"],
    title: row.title,
    content: tryParseJson(row.content),
    language: row.language || undefined,
    queries: row.queries ? JSON.parse(row.queries) : undefined,
    identifier: row.identifier || undefined,
    status: row.status as StoredArtifact["status"],
    error: row.error || undefined,
    createdAt: sqliteDateToISO(row.created_at),
    updatedAt: row.updated_at ? sqliteDateToISO(row.updated_at) : undefined,
  }));
}

/**
 * Delete all artifacts for a session
 *
 * @deprecated Use `deleteSessionArtifacts` from `unified-artifact-store.ts` instead.
 * This function continues to work for backward compatibility.
 */
export async function deleteArtifactsBySession(
  sessionId: string,
): Promise<void> {
  logDeprecation("deleteArtifactsBySession", "deleteSessionArtifacts");

  await run("DELETE FROM ideation_artifacts WHERE session_id = ?", [sessionId]);
  await saveDb();
}

/**
 * Update an artifact's status
 *
 * @deprecated Use file-based artifacts with `unified-artifact-store.ts` instead.
 * This function continues to work for backward compatibility.
 */
export async function updateArtifactStatus(
  artifactId: string,
  status: "pending" | "loading" | "ready" | "error",
  error?: string,
): Promise<void> {
  logDeprecation("updateArtifactStatus", "saveArtifact (file-based update)");

  await run(
    `UPDATE ideation_artifacts SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [status, error || null, artifactId],
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

/**
 * Legacy artifact store object for backward compatibility.
 *
 * @deprecated Import functions directly from `unified-artifact-store.ts` instead.
 * All methods continue to work but will log deprecation warnings.
 *
 * Migration guide:
 * - `artifactStore.save()` -> Use `saveArtifact()` from unified-artifact-store.ts
 * - `artifactStore.getBySession()` -> Use `listArtifacts()` filtered by sessionId
 * - `artifactStore.deleteBySession()` -> Use `deleteSessionArtifacts()`
 * - `artifactStore.updateStatus()` -> Update artifact via `saveArtifact()` with new content
 */
export const artifactStore = {
  save: saveArtifact,
  getBySession: getArtifactsBySession,
  deleteBySession: deleteArtifactsBySession,
  updateStatus: updateArtifactStatus,
};
