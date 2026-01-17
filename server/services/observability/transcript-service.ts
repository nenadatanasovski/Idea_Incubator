/**
 * OBS-301: Transcript Service
 *
 * Query transcript entries with filtering and pagination.
 */

import Database from "better-sqlite3";
import type {
  TranscriptQuery,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type { TranscriptEntry } from "../../../frontend/src/types/observability/transcript.js";

export class TranscriptService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get transcript entries for an execution with filtering.
   */
  getTranscript(
    executionId: string,
    query: TranscriptQuery = {},
  ): PaginatedResponse<TranscriptEntry> {
    const limit = query.limit || 500;
    const offset = query.offset || 0;
    const conditions: string[] = ["execution_id = ?"];
    const params: (string | number)[] = [executionId];

    // Filter by entry types
    if (query.entryTypes?.length) {
      const placeholders = query.entryTypes.map(() => "?").join(",");
      conditions.push(`entry_type IN (${placeholders})`);
      params.push(...query.entryTypes);
    }

    // Filter by categories
    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.categories);
    }

    // Filter by task
    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    // Filter by time range
    if (query.fromTimestamp) {
      conditions.push("timestamp >= ?");
      params.push(query.fromTimestamp);
    }

    if (query.toTimestamp) {
      conditions.push("timestamp <= ?");
      params.push(query.toTimestamp);
    }

    // Search in summary
    if (query.search) {
      conditions.push("summary LIKE ?");
      params.push(`%${query.search}%`);
    }

    // Cursor-based pagination
    if (query.cursor) {
      conditions.push("sequence > ?");
      params.push(parseInt(query.cursor, 10));
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT
        id,
        timestamp,
        sequence,
        execution_id,
        task_id,
        instance_id,
        wave_number,
        entry_type,
        category,
        summary,
        details,
        skill_ref,
        tool_calls,
        assertions,
        duration_ms,
        token_estimate,
        created_at
      FROM transcript_entries
      WHERE ${whereClause}
      ORDER BY sequence ASC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(sql)
      .all(...params, limit, offset) as TranscriptRow[];

    // Get total count
    const countParams = params.slice(); // Copy without limit/offset
    const countSql = `
      SELECT COUNT(*) as count
      FROM transcript_entries
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countSql).get(...countParams) as {
      count: number;
    };
    const total = countResult?.count || 0;

    const data = rows.map((row) => this.mapRow(row));
    const hasMore = offset + data.length < total;

    return {
      data,
      total,
      limit,
      offset,
      hasMore,
      nextCursor:
        hasMore && data.length > 0
          ? String(data[data.length - 1].sequence)
          : undefined,
    };
  }

  /**
   * Get a single transcript entry by ID.
   */
  getEntry(entryId: string): TranscriptEntry | null {
    const sql = `
      SELECT
        id,
        timestamp,
        sequence,
        execution_id,
        task_id,
        instance_id,
        wave_number,
        entry_type,
        category,
        summary,
        details,
        skill_ref,
        tool_calls,
        assertions,
        duration_ms,
        token_estimate,
        created_at
      FROM transcript_entries
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(entryId) as TranscriptRow | undefined;
    if (!row) return null;

    return this.mapRow(row);
  }

  /**
   * Map database row to TranscriptEntry.
   */
  private mapRow(row: TranscriptRow): TranscriptEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sequence: row.sequence,
      executionId: row.execution_id,
      taskId: row.task_id,
      instanceId: row.instance_id,
      waveNumber: row.wave_number,
      entryType: row.entry_type as TranscriptEntry["entryType"],
      category: row.category as TranscriptEntry["category"],
      summary: row.summary,
      details: this.parseJson(row.details),
      skillRef: this.parseJson(row.skill_ref),
      toolCalls: this.parseJson(row.tool_calls),
      assertions: this.parseJson(row.assertions),
      durationMs: row.duration_ms,
      tokenEstimate: row.token_estimate,
      createdAt: row.created_at,
    };
  }

  /**
   * Safely parse JSON string.
   */
  private parseJson<T>(json: string | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }

  close(): void {
    this.db.close();
  }
}

// Internal row type
interface TranscriptRow {
  id: string;
  timestamp: string;
  sequence: number;
  execution_id: string;
  task_id: string | null;
  instance_id: string;
  wave_number: number | null;
  entry_type: string;
  category: string;
  summary: string;
  details: string | null;
  skill_ref: string | null;
  tool_calls: string | null;
  assertions: string | null;
  duration_ms: number | null;
  token_estimate: number | null;
  created_at: string;
}
