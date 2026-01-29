import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../../database/db.js";
import {
  IdeationSession,
  IdeationSessionRow,
  SessionStatus,
  SessionPhase,
  IdeaCandidate,
  IdeaCandidateRow,
} from "../../types/ideation.js";
import {
  mapSessionRowToSession,
  mapCandidateRowToCandidate,
} from "../../utils/ideation-mappers.js";

/**
 * SESSION MANAGER
 *
 * Handles session lifecycle: create, load, update, complete, abandon.
 */

export interface CreateSessionParams {
  profileId: string;
}

export interface UpdateSessionParams {
  status?: SessionStatus;
  currentPhase?: SessionPhase;
  tokenCount?: number;
  messageCount?: number;
  handoffCount?: number;
  title?: string;
}

/**
 * Helper to convert db result row to object
 */
function rowToObject(result: {
  columns: string[];
  values: unknown[][];
}): Record<string, unknown> {
  if (result.values.length === 0) {
    return {};
  }
  const columns = result.columns;
  const values = result.values[0];
  return columns.reduce(
    (obj, col, i) => {
      obj[col] = values[i];
      return obj;
    },
    {} as Record<string, unknown>,
  );
}

export class SessionManager {
  /**
   * Create a new ideation session.
   */
  async create(params: CreateSessionParams): Promise<IdeationSession> {
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `
      INSERT INTO ideation_sessions (
        id, profile_id, status, current_phase, entry_mode,
        started_at, last_activity_at,
        handoff_count, token_count, message_count
      )
      VALUES (?, ?, 'active', 'exploring', 'discover', ?, ?, 0, 0, 0)
    `,
      [id, params.profileId, now, now],
    );

    await saveDb();

    return this.load(id) as Promise<IdeationSession>;
  }

  /**
   * Load a session by ID.
   */
  async load(sessionId: string): Promise<IdeationSession | null> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT * FROM ideation_sessions WHERE id = ?
    `,
      [sessionId],
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as IdeationSessionRow;
    return mapSessionRowToSession(row);
  }

  /**
   * Update session fields.
   */
  async update(
    sessionId: string,
    params: UpdateSessionParams,
  ): Promise<IdeationSession | null> {
    const db = await getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.status !== undefined) {
      updates.push("status = ?");
      values.push(params.status);
    }
    if (params.currentPhase !== undefined) {
      updates.push("current_phase = ?");
      values.push(params.currentPhase);
    }
    if (params.tokenCount !== undefined) {
      updates.push("token_count = ?");
      values.push(params.tokenCount);
    }
    if (params.messageCount !== undefined) {
      updates.push("message_count = ?");
      values.push(params.messageCount);
    }
    if (params.handoffCount !== undefined) {
      updates.push("handoff_count = ?");
      values.push(params.handoffCount);
    }
    if (params.title !== undefined) {
      updates.push("title = ?");
      values.push(params.title);
    }

    updates.push("last_activity_at = ?");
    values.push(new Date().toISOString());

    values.push(sessionId);

    db.run(
      `
      UPDATE ideation_sessions
      SET ${updates.join(", ")}
      WHERE id = ?
    `,
      values as (string | number | null)[],
    );

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Mark session as completed.
   */
  async complete(sessionId: string): Promise<IdeationSession | null> {
    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `
      UPDATE ideation_sessions
      SET status = 'completed', completed_at = ?, last_activity_at = ?
      WHERE id = ?
    `,
      [now, now, sessionId],
    );

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Mark session as abandoned.
   */
  async abandon(sessionId: string): Promise<IdeationSession | null> {
    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `
      UPDATE ideation_sessions
      SET status = 'abandoned', completed_at = ?, last_activity_at = ?
      WHERE id = ?
    `,
      [now, now, sessionId],
    );

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Get active sessions for a profile.
   */
  async getActiveByProfile(profileId: string): Promise<IdeationSession[]> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT * FROM ideation_sessions
      WHERE profile_id = ? AND status = 'active'
      ORDER BY last_activity_at DESC
    `,
      [profileId],
    );

    if (results.length === 0) return [];

    const columns = results[0].columns;
    return results[0].values.map((values: unknown[]) => {
      const row = columns.reduce(
        (obj: Record<string, unknown>, col: string, i: number) => {
          obj[col] = values[i];
          return obj;
        },
        {} as Record<string, unknown>,
      ) as IdeationSessionRow;
      return mapSessionRowToSession(row);
    });
  }

  /**
   * Gets the active session for a profile, if one exists.
   * Used to enforce "one idea at a time" constraint.
   */
  async getActiveSessionByProfile(
    profileId: string,
  ): Promise<IdeationSession | null> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT *
      FROM ideation_sessions
      WHERE profile_id = ?
        AND status = 'active'
      ORDER BY last_activity_at DESC
      LIMIT 1
    `,
      [profileId],
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as IdeationSessionRow;
    return mapSessionRowToSession(row);
  }

  /**
   * Checks if a profile has an active session with an idea candidate.
   * Returns the candidate if one exists.
   */
  async getActiveSessionWithCandidate(profileId: string): Promise<{
    session: IdeationSession;
    candidate: IdeaCandidate;
  } | null> {
    const activeSession = await this.getActiveSessionByProfile(profileId);
    if (!activeSession) return null;

    const db = await getDb();
    const candidateResults = db.exec(
      `
      SELECT *
      FROM ideation_candidates
      WHERE session_id = ?
        AND status IN ('forming', 'active')
      ORDER BY updated_at DESC
      LIMIT 1
    `,
      [activeSession.id],
    );

    if (
      candidateResults.length === 0 ||
      candidateResults[0].values.length === 0
    ) {
      return null;
    }

    const candidateRow = rowToObject(candidateResults[0]) as IdeaCandidateRow;
    const candidate = mapCandidateRowToCandidate(candidateRow);

    return { session: activeSession, candidate };
  }

  /**
   * Update session title.
   * This is the primary method for setting/changing the session name.
   */
  async updateTitle(
    sessionId: string,
    title: string,
  ): Promise<IdeationSession | null> {
    const db = await getDb();
    const now = new Date().toISOString();

    db.run(
      `
      UPDATE ideation_sessions
      SET title = ?, last_activity_at = ?
      WHERE id = ?
    `,
      [title, now, sessionId],
    );

    await saveDb();

    return this.load(sessionId);
  }

  /**
   * Increment handoff count for session.
   */
  async incrementHandoff(sessionId: string): Promise<void> {
    const db = await getDb();

    db.run(
      `
      UPDATE ideation_sessions
      SET handoff_count = handoff_count + 1, last_activity_at = ?
      WHERE id = ?
    `,
      [new Date().toISOString(), sessionId],
    );

    await saveDb();
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
