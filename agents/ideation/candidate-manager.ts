import { v4 as uuidv4 } from "uuid";
import { getDb, saveDb } from "../../database/db.js";
import {
  IdeaCandidate,
  IdeaCandidateRow,
  CandidateStatus,
} from "../../types/ideation.js";
import { mapCandidateRowToCandidate } from "../../utils/ideation-mappers.js";

/**
 * CANDIDATE MANAGER
 *
 * Manages idea candidates during ideation sessions.
 */

export interface CreateCandidateParams {
  sessionId: string;
  title: string;
  summary?: string;
  confidence?: number;
  viability?: number;
  userSuggested?: boolean;
}

export interface UpdateCandidateParams {
  title?: string;
  summary?: string;
  confidence?: number;
  viability?: number;
  status?: CandidateStatus;
  capturedIdeaId?: string;
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

export class CandidateManager {
  /**
   * Create a new candidate.
   */
  async create(params: CreateCandidateParams): Promise<IdeaCandidate> {
    const db = await getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.run(
      `
      INSERT INTO ideation_candidates (
        id, session_id, title, summary, confidence, viability,
        user_suggested, status, version, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'forming', 1, ?, ?)
    `,
      [
        id,
        params.sessionId,
        params.title,
        params.summary || null,
        params.confidence || 0,
        params.viability || 100,
        params.userSuggested ? 1 : 0,
        now,
        now,
      ],
    );

    await saveDb();

    return this.getById(id) as Promise<IdeaCandidate>;
  }

  /**
   * Get candidate by ID.
   */
  async getById(candidateId: string): Promise<IdeaCandidate | null> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT * FROM ideation_candidates WHERE id = ?
    `,
      [candidateId],
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as IdeaCandidateRow;
    return mapCandidateRowToCandidate(row);
  }

  /**
   * Get active candidate for session.
   */
  async getActiveForSession(sessionId: string): Promise<IdeaCandidate | null> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT * FROM ideation_candidates
      WHERE session_id = ? AND status IN ('forming', 'active')
      ORDER BY updated_at DESC
      LIMIT 1
    `,
      [sessionId],
    );

    if (results.length === 0 || results[0].values.length === 0) {
      return null;
    }

    const row = rowToObject(results[0]) as IdeaCandidateRow;
    return mapCandidateRowToCandidate(row);
  }

  /**
   * Alias for getActiveForSession for consistency with spec.
   */
  async getActiveBySession(sessionId: string): Promise<IdeaCandidate | null> {
    return this.getActiveForSession(sessionId);
  }

  /**
   * Get or create candidate for session.
   */
  async getOrCreateForSession(
    sessionId: string,
    params: {
      title: string;
      summary?: string;
      confidence: number;
      viability: number;
    },
  ): Promise<IdeaCandidate> {
    const existing = await this.getActiveForSession(sessionId);

    if (existing) {
      // Update existing
      return this.update(existing.id, {
        title: params.title,
        summary: params.summary,
        confidence: params.confidence,
        viability: params.viability,
        status: params.confidence >= 50 ? "active" : "forming",
      }) as Promise<IdeaCandidate>;
    }

    // Create new
    return this.create({
      sessionId,
      title: params.title,
      summary: params.summary,
      confidence: params.confidence,
      viability: params.viability,
    });
  }

  /**
   * Update candidate.
   */
  async update(
    candidateId: string,
    params: UpdateCandidateParams,
  ): Promise<IdeaCandidate | null> {
    const db = await getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (params.title !== undefined) {
      updates.push("title = ?");
      values.push(params.title);
    }
    if (params.summary !== undefined) {
      updates.push("summary = ?");
      values.push(params.summary);
    }
    if (params.confidence !== undefined) {
      updates.push("confidence = ?");
      values.push(params.confidence);
    }
    if (params.viability !== undefined) {
      updates.push("viability = ?");
      values.push(params.viability);
    }
    if (params.status !== undefined) {
      updates.push("status = ?");
      values.push(params.status);
    }
    if (params.capturedIdeaId !== undefined) {
      updates.push("captured_idea_id = ?");
      values.push(params.capturedIdeaId);
    }

    // Increment version
    updates.push("version = version + 1");
    updates.push("updated_at = ?");
    values.push(new Date().toISOString());

    values.push(candidateId);

    if (updates.length > 0) {
      db.run(
        `
        UPDATE ideation_candidates
        SET ${updates.join(", ")}
        WHERE id = ?
      `,
        values as (string | number | null)[],
      );

      await saveDb();
    }

    return this.getById(candidateId);
  }

  /**
   * Discard a candidate.
   */
  async discard(candidateId: string): Promise<void> {
    await this.update(candidateId, { status: "discarded" });
  }

  /**
   * Save a candidate (for later).
   */
  async save(candidateId: string): Promise<void> {
    await this.update(candidateId, { status: "saved" });
  }

  /**
   * Get all candidates for a session.
   */
  async getAllForSession(sessionId: string): Promise<IdeaCandidate[]> {
    const db = await getDb();
    const results = db.exec(
      `
      SELECT * FROM ideation_candidates
      WHERE session_id = ?
      ORDER BY created_at DESC
    `,
      [sessionId],
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
      ) as IdeaCandidateRow;
      return mapCandidateRowToCandidate(row);
    });
  }
}

// Singleton
export const candidateManager = new CandidateManager();
