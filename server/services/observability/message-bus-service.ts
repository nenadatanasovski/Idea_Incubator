/**
 * OBS-306: Message Bus Service
 *
 * Query message bus logs and correlated events.
 */

import Database from "better-sqlite3";
import type {
  MessageBusQuery,
  MessageBusSummaryResponse,
  PaginatedResponse,
} from "../../../frontend/src/types/observability/api.js";
import type {
  MessageBusLogEntry,
  MessageBusSeverity,
  MessageBusCategory,
  CorrelatedEvents,
} from "../../../frontend/src/types/observability/message-bus.js";

export class MessageBusService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get message bus logs with filtering.
   */
  getLogs(query: MessageBusQuery = {}): PaginatedResponse<MessageBusLogEntry> {
    const limit = query.limit || 100;
    const offset = query.offset || 0;
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    // Filter by execution
    if (query.executionId) {
      conditions.push("execution_id = ?");
      params.push(query.executionId);
    }

    // Filter by task
    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    // Filter by severity
    if (query.severity?.length) {
      const placeholders = query.severity.map(() => "?").join(",");
      conditions.push(`severity IN (${placeholders})`);
      params.push(...query.severity);
    }

    // Filter by category
    if (query.category?.length) {
      const placeholders = query.category.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.category);
    }

    // Filter by source
    if (query.source) {
      conditions.push("source = ?");
      params.push(query.source);
    }

    // Filter by event type
    if (query.eventType) {
      conditions.push("event_type = ?");
      params.push(query.eventType);
    }

    // Filter by correlation ID
    if (query.correlationId) {
      conditions.push("correlation_id = ?");
      params.push(query.correlationId);
    }

    // Time filters
    if (query.fromTimestamp) {
      conditions.push("timestamp >= ?");
      params.push(query.fromTimestamp);
    }

    if (query.toTimestamp) {
      conditions.push("timestamp <= ?");
      params.push(query.toTimestamp);
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT
        id,
        event_id,
        timestamp,
        source,
        event_type,
        correlation_id,
        human_summary,
        severity,
        category,
        transcript_entry_id,
        task_id,
        execution_id,
        payload,
        created_at
      FROM message_bus_log
      WHERE ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.db
      .prepare(sql)
      .all(...params, limit, offset) as MessageBusRow[];

    // Get total count
    const countParams = params.slice();
    const countSql = `
      SELECT COUNT(*) as count
      FROM message_bus_log
      WHERE ${whereClause}
    `;
    const countResult = this.db.prepare(countSql).get(...countParams) as {
      count: number;
    };
    const total = countResult?.count || 0;

    const data = rows.map((row) => this.mapRow(row));

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    };
  }

  /**
   * Get correlated events by correlation ID.
   */
  getCorrelatedEvents(correlationId: string): CorrelatedEvents | null {
    const sql = `
      SELECT
        id,
        event_id,
        timestamp,
        source,
        event_type,
        correlation_id,
        human_summary,
        severity,
        category,
        transcript_entry_id,
        task_id,
        execution_id,
        payload,
        created_at
      FROM message_bus_log
      WHERE correlation_id = ?
      ORDER BY timestamp ASC
    `;

    const rows = this.db.prepare(sql).all(correlationId) as MessageBusRow[];

    if (rows.length === 0) return null;

    const events = rows.map((row) => this.mapRow(row));
    const sources = [...new Set(events.map((e) => e.source))];

    const firstTimestamp = events[0].timestamp;
    const lastTimestamp = events[events.length - 1].timestamp;
    const durationMs =
      new Date(lastTimestamp).getTime() - new Date(firstTimestamp).getTime();

    // Generate summary from first event
    const summary = events[0].humanSummary;

    return {
      correlationId,
      events,
      timeline: {
        first: firstTimestamp,
        last: lastTimestamp,
        durationMs,
      },
      sources,
      summary,
    };
  }

  /**
   * Get message bus summary for an execution.
   */
  getSummary(executionId?: string): MessageBusSummaryResponse {
    const baseCondition = executionId ? "WHERE execution_id = ?" : "WHERE 1=1";
    const params = executionId ? [executionId] : [];

    // Get total
    const total = this.db
      .prepare(`SELECT COUNT(*) as count FROM message_bus_log ${baseCondition}`)
      .get(...params) as { count: number } | undefined;

    // Get by severity
    const bySeverityRows = this.db
      .prepare(
        `
        SELECT severity, COUNT(*) as count
        FROM message_bus_log
        ${baseCondition}
        GROUP BY severity
      `,
      )
      .all(...params) as { severity: string; count: number }[];

    const bySeverity: Record<MessageBusSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    for (const row of bySeverityRows) {
      if (row.severity in bySeverity) {
        bySeverity[row.severity as MessageBusSeverity] = row.count;
      }
    }

    // Get by category
    const byCategoryRows = this.db
      .prepare(
        `
        SELECT category, COUNT(*) as count
        FROM message_bus_log
        ${baseCondition}
        GROUP BY category
      `,
      )
      .all(...params) as { category: string; count: number }[];

    const byCategory: Record<MessageBusCategory, number> = {
      lifecycle: 0,
      coordination: 0,
      failure: 0,
      decision: 0,
    };

    for (const row of byCategoryRows) {
      if (row.category in byCategory) {
        byCategory[row.category as MessageBusCategory] = row.count;
      }
    }

    // Get by source
    const bySourceRows = this.db
      .prepare(
        `
        SELECT source, COUNT(*) as count
        FROM message_bus_log
        ${baseCondition}
        GROUP BY source
      `,
      )
      .all(...params) as { source: string; count: number }[];

    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.source] = row.count;
    }

    // Get recent critical
    const recentCritical = this.db
      .prepare(
        `
        SELECT
          id, event_id, timestamp, source, event_type, correlation_id,
          human_summary, severity, category, transcript_entry_id,
          task_id, execution_id, payload, created_at
        FROM message_bus_log
        ${baseCondition} ${executionId ? "AND" : "WHERE"} severity = 'critical'
        ORDER BY timestamp DESC
        LIMIT 10
      `,
      )
      .all(...params) as MessageBusRow[];

    // Get recent errors
    const recentErrors = this.db
      .prepare(
        `
        SELECT
          id, event_id, timestamp, source, event_type, correlation_id,
          human_summary, severity, category, transcript_entry_id,
          task_id, execution_id, payload, created_at
        FROM message_bus_log
        ${baseCondition} ${executionId ? "AND" : "WHERE"} severity = 'error'
        ORDER BY timestamp DESC
        LIMIT 10
      `,
      )
      .all(...params) as MessageBusRow[];

    return {
      executionId,
      total: total?.count || 0,
      bySeverity,
      byCategory,
      bySource,
      recentCritical: recentCritical.map((row) => this.mapRow(row)),
      recentErrors: recentErrors.map((row) => this.mapRow(row)),
    };
  }

  /**
   * Map database row to MessageBusLogEntry.
   */
  private mapRow(row: MessageBusRow): MessageBusLogEntry {
    return {
      id: row.id,
      eventId: row.event_id,
      timestamp: row.timestamp,
      source: row.source,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      humanSummary: row.human_summary,
      severity: row.severity as MessageBusSeverity,
      category: row.category as MessageBusCategory,
      transcriptEntryId: row.transcript_entry_id,
      taskId: row.task_id,
      executionId: row.execution_id,
      payload: this.parseJson(row.payload),
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
interface MessageBusRow {
  id: string;
  event_id: string;
  timestamp: string;
  source: string;
  event_type: string;
  correlation_id: string | null;
  human_summary: string;
  severity: string;
  category: string;
  transcript_entry_id: string | null;
  task_id: string | null;
  execution_id: string | null;
  payload: string | null;
  created_at: string;
}
