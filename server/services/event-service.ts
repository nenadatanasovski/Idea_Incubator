/**
 * Platform Event Service
 *
 * Unified event emission for the entire platform. Writes to the `events` table
 * (which triggers auto-population of `message_bus_log` for specific event types)
 * and broadcasts via WebSocket for real-time UI updates.
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { query, getOne, run, saveDb } from "../../database/db.js";

// =============================================================================
// Types
// =============================================================================

export type EventSource =
  | "task-agent"
  | "pipeline"
  | "api"
  | "system"
  | "ideation"
  | "build-agent"
  | "websocket"
  | "telegram"
  | "monitoring"
  | "memory-graph";

export type EventSeverity = "info" | "warning" | "error" | "critical";

// Event types that trigger message_bus_log auto-population (from migration 087)
export type TriggerHandledEventType =
  | "test_started"
  | "test_passed"
  | "test_failed"
  | "test_blocked"
  | "file_locked"
  | "file_unlocked"
  | "file_conflict"
  | "stuck_detected"
  | "regression_detected"
  | "deadlock_detected"
  | "decision_needed"
  | "decision_made"
  | "knowledge_recorded"
  | "checkpoint_created"
  | "rollback_triggered"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "wave_started"
  | "wave_completed"
  | "wave_failed"
  | "agent_spawned"
  | "agent_terminated";

// Additional platform event types
export type PlatformEventType =
  | TriggerHandledEventType
  // Task lifecycle
  | "task_created"
  | "task_updated"
  | "task_moved"
  | "task_decomposed"
  | "task_deleted"
  | "task_archived"
  // Project lifecycle
  | "project_created"
  | "project_updated"
  | "project_started"
  | "project_completed"
  | "project_archived"
  // Execution lifecycle
  | "execution_started"
  | "execution_paused"
  | "execution_resumed"
  | "execution_stopped"
  | "execution_completed"
  // API events
  | "api_request"
  | "api_error"
  // Question lifecycle
  | "question_created"
  | "question_answered"
  | "question_expired"
  | "question_skipped"
  // Notification events
  | "notification_sent"
  | "notification_delivered"
  | "notification_read"
  // Grouping events
  | "grouping_suggested"
  | "grouping_accepted"
  | "grouping_rejected"
  // Dependency events
  | "dependency_added"
  | "dependency_removed"
  | "cycle_detected"
  // Ideation events
  | "idea_created"
  | "idea_updated"
  | "artifact_created"
  | "session_started"
  | "session_ended"
  // Spec events
  | "spec_generated"
  | "spec_approved"
  // Memory graph events
  | "graph:created"
  | "graph:modified"
  | "graph:superseded"
  | "graph:linked"
  | "graph:unlinked"
  | "graph:deleted"
  // Generic events
  | string;

export interface PlatformEvent {
  type: PlatformEventType;
  source: EventSource;
  payload?: Record<string, unknown>;
  correlationId?: string;
  taskId?: string;
  executionId?: string;
  projectId?: string;
  ideaId?: string;
  sessionId?: string;
  userId?: string;
  severity?: EventSeverity;
}

export interface StoredEvent {
  id: string;
  timestamp: string;
  source: EventSource;
  eventType: string;
  correlationId: string | null;
  payload: Record<string, unknown> | null;
  taskId: string | null;
  executionId: string | null;
  projectId: string | null;
  ideaId: string | null;
  sessionId: string | null;
  userId: string | null;
  severity: EventSeverity;
  createdAt: string;
  // Joined fields (optional)
  taskTitle?: string;
  projectName?: string;
}

export interface EventFilters {
  source?: EventSource[];
  eventType?: string[];
  severity?: EventSeverity[];
  projectId?: string;
  taskId?: string;
  executionId?: string;
  ideaId?: string;
  sessionId?: string;
  userId?: string;
  correlationId?: string;
  fromTimestamp?: string;
  toTimestamp?: string;
  search?: string;
}

export interface PaginatedEvents {
  data: StoredEvent[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EventStats {
  total: number;
  bySource: Record<string, number>;
  bySeverity: Record<EventSeverity, number>;
  byType: Array<{ eventType: string; count: number }>;
  recentErrors: StoredEvent[];
  hourlyBreakdown: Array<{ hour: string; count: number; errorCount: number }>;
}

export interface PlatformEventStreamEvent {
  type: "platform:event";
  timestamp: string;
  event: StoredEvent;
}

// =============================================================================
// Event Service
// =============================================================================

export class EventService extends EventEmitter {
  private static instance: EventService;

  // Event buffer for late subscribers
  private eventBuffer: StoredEvent[] = [];
  private maxBufferSize = 200;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  /**
   * Emit a platform event.
   * Writes to `events` table and broadcasts via WebSocket.
   */
  async emitEvent(event: PlatformEvent): Promise<string> {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const severity = event.severity || "info";

    try {
      await run(
        `INSERT INTO events (
          id, timestamp, source, event_type, correlation_id, payload,
          task_id, execution_id, project_id, idea_id, session_id, user_id,
          severity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          timestamp,
          event.source,
          event.type,
          event.correlationId || null,
          event.payload ? JSON.stringify(event.payload) : null,
          event.taskId || null,
          event.executionId || null,
          event.projectId || null,
          event.ideaId || null,
          event.sessionId || null,
          event.userId || null,
          severity,
          timestamp,
        ],
      );

      // Persist to disk (sql.js runs in-memory, requires explicit save)
      await saveDb();

      const storedEvent: StoredEvent = {
        id,
        timestamp,
        source: event.source,
        eventType: event.type,
        correlationId: event.correlationId || null,
        payload: event.payload || null,
        taskId: event.taskId || null,
        executionId: event.executionId || null,
        projectId: event.projectId || null,
        ideaId: event.ideaId || null,
        sessionId: event.sessionId || null,
        userId: event.userId || null,
        severity,
        createdAt: timestamp,
      };

      // Add to buffer and broadcast
      this.addToBuffer(storedEvent);
      this.broadcast(storedEvent);

      return id;
    } catch (error) {
      console.error("Failed to emit platform event:", error);
      throw error;
    }
  }

  /**
   * Emit multiple events in batch.
   */
  async emitBatch(events: PlatformEvent[]): Promise<string[]> {
    const ids: string[] = [];
    for (const event of events) {
      const id = await this.emitEvent(event);
      ids.push(id);
    }
    return ids;
  }

  /**
   * Get events with filtering and pagination.
   */
  async getEvents(
    filters: EventFilters = {},
    limit = 100,
    offset = 0,
  ): Promise<PaginatedEvents> {
    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    // Build WHERE conditions
    if (filters.source?.length) {
      const placeholders = filters.source.map(() => "?").join(",");
      conditions.push(`source IN (${placeholders})`);
      params.push(...filters.source);
    }

    if (filters.eventType?.length) {
      const placeholders = filters.eventType.map(() => "?").join(",");
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...filters.eventType);
    }

    if (filters.severity?.length) {
      const placeholders = filters.severity.map(() => "?").join(",");
      conditions.push(`e.severity IN (${placeholders})`);
      params.push(...filters.severity);
    }

    if (filters.projectId) {
      conditions.push("project_id = ?");
      params.push(filters.projectId);
    }

    if (filters.taskId) {
      conditions.push("task_id = ?");
      params.push(filters.taskId);
    }

    if (filters.executionId) {
      conditions.push("execution_id = ?");
      params.push(filters.executionId);
    }

    if (filters.ideaId) {
      conditions.push("idea_id = ?");
      params.push(filters.ideaId);
    }

    if (filters.sessionId) {
      conditions.push("session_id = ?");
      params.push(filters.sessionId);
    }

    if (filters.userId) {
      conditions.push("user_id = ?");
      params.push(filters.userId);
    }

    if (filters.correlationId) {
      conditions.push("correlation_id = ?");
      params.push(filters.correlationId);
    }

    if (filters.fromTimestamp) {
      conditions.push("timestamp >= ?");
      params.push(filters.fromTimestamp);
    }

    if (filters.toTimestamp) {
      conditions.push("timestamp <= ?");
      params.push(filters.toTimestamp);
    }

    if (filters.search) {
      conditions.push("(event_type LIKE ? OR payload LIKE ? OR source LIKE ?)");
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = conditions.join(" AND ");

    const rows = await query<EventRow>(
      `SELECT
        e.id,
        e.timestamp,
        e.source,
        e.event_type,
        e.correlation_id,
        e.payload,
        e.task_id,
        e.execution_id,
        e.project_id,
        e.idea_id,
        e.session_id,
        e.user_id,
        e.severity,
        e.created_at,
        t.title as task_title,
        p.name as project_name
      FROM events e
      LEFT JOIN tasks t ON e.task_id = t.id
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE ${whereClause}
      ORDER BY e.timestamp DESC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const countResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM events e WHERE ${whereClause}`,
      params,
    );
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
   * Get a single event by ID.
   */
  async getEventById(id: string): Promise<StoredEvent | null> {
    const row = await getOne<EventRow>(
      `SELECT
        e.id,
        e.timestamp,
        e.source,
        e.event_type,
        e.correlation_id,
        e.payload,
        e.task_id,
        e.execution_id,
        e.project_id,
        e.idea_id,
        e.session_id,
        e.user_id,
        e.severity,
        e.created_at,
        t.title as task_title,
        p.name as project_name
      FROM events e
      LEFT JOIN tasks t ON e.task_id = t.id
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.id = ?`,
      [id],
    );

    return row ? this.mapRow(row) : null;
  }

  /**
   * Get correlated events.
   */
  async getCorrelatedEvents(correlationId: string): Promise<StoredEvent[]> {
    const rows = await query<EventRow>(
      `SELECT
        e.id,
        e.timestamp,
        e.source,
        e.event_type,
        e.correlation_id,
        e.payload,
        e.task_id,
        e.execution_id,
        e.project_id,
        e.idea_id,
        e.session_id,
        e.user_id,
        e.severity,
        e.created_at,
        t.title as task_title,
        p.name as project_name
      FROM events e
      LEFT JOIN tasks t ON e.task_id = t.id
      LEFT JOIN projects p ON e.project_id = p.id
      WHERE e.correlation_id = ?
      ORDER BY e.timestamp ASC`,
      [correlationId],
    );

    return rows.map((row) => this.mapRow(row));
  }

  /**
   * Get event statistics.
   */
  async getEventStats(filters?: Partial<EventFilters>): Promise<EventStats> {
    const baseCondition = filters?.executionId
      ? "WHERE execution_id = ?"
      : "WHERE 1=1";
    const params = filters?.executionId ? [filters.executionId] : [];

    // Total count
    const totalResult = await getOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM events ${baseCondition}`,
      params,
    );

    // By source
    const bySourceRows = await query<{ source: string; count: number }>(
      `SELECT source, COUNT(*) as count
       FROM events ${baseCondition}
       GROUP BY source`,
      params,
    );
    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.source] = row.count;
    }

    // By severity
    const bySeverityRows = await query<{ severity: string; count: number }>(
      `SELECT severity, COUNT(*) as count
       FROM events ${baseCondition}
       GROUP BY severity`,
      params,
    );
    const bySeverity: Record<EventSeverity, number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };
    for (const row of bySeverityRows) {
      if (row.severity in bySeverity) {
        bySeverity[row.severity as EventSeverity] = row.count;
      }
    }

    // By type (top 20)
    const byTypeRows = await query<{ event_type: string; count: number }>(
      `SELECT event_type, COUNT(*) as count
       FROM events ${baseCondition}
       GROUP BY event_type
       ORDER BY count DESC
       LIMIT 20`,
      params,
    );
    const byType = byTypeRows.map((row) => ({
      eventType: row.event_type,
      count: row.count,
    }));

    // Recent errors
    const errorRows = await query<EventRow>(
      `SELECT
        e.id, e.timestamp, e.source, e.event_type, e.correlation_id,
        e.payload, e.task_id, e.execution_id, e.project_id, e.idea_id,
        e.session_id, e.user_id, e.severity, e.created_at
       FROM events e
       ${baseCondition} AND severity IN ('error', 'critical')
       ORDER BY timestamp DESC
       LIMIT 10`,
      params,
    );
    const recentErrors = errorRows.map((row) => this.mapRow(row));

    // Hourly breakdown (last 24 hours)
    const hourlyRows = await query<{
      hour: string;
      count: number;
      error_count: number;
    }>(
      `SELECT
        strftime('%Y-%m-%d %H:00:00', timestamp) as hour,
        COUNT(*) as count,
        COUNT(CASE WHEN severity IN ('error', 'critical') THEN 1 END) as error_count
       FROM events
       WHERE timestamp >= datetime('now', '-24 hours')
       GROUP BY hour
       ORDER BY hour DESC`,
      [],
    );
    const hourlyBreakdown = hourlyRows.map((row) => ({
      hour: row.hour,
      count: row.count,
      errorCount: row.error_count,
    }));

    return {
      total: totalResult?.count || 0,
      bySource,
      bySeverity,
      byType,
      recentErrors,
      hourlyBreakdown,
    };
  }

  /**
   * Get buffered events for late subscribers.
   */
  getBufferedEvents(): StoredEvent[] {
    return [...this.eventBuffer];
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private addToBuffer(event: StoredEvent): void {
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }
  }

  private broadcast(event: StoredEvent): void {
    const streamEvent: PlatformEventStreamEvent = {
      type: "platform:event",
      timestamp: new Date().toISOString(),
      event,
    };

    // Emit to all listeners
    super.emit("platform:event", streamEvent);

    // Emit to execution-specific listeners if applicable
    if (event.executionId) {
      super.emit(`platform:event:${event.executionId}`, streamEvent);
    }

    // Emit to project-specific listeners if applicable
    if (event.projectId) {
      super.emit(`platform:event:project:${event.projectId}`, streamEvent);
    }
  }

  private mapRow(row: EventRow): StoredEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      source: row.source as EventSource,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      payload: this.parseJson(row.payload),
      taskId: row.task_id,
      executionId: row.execution_id,
      projectId: row.project_id,
      ideaId: row.idea_id,
      sessionId: row.session_id,
      userId: row.user_id,
      severity: row.severity as EventSeverity,
      createdAt: row.created_at,
      taskTitle: row.task_title,
      projectName: row.project_name,
    };
  }

  private parseJson<T>(json: string | null): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

// Internal row type
interface EventRow {
  id: string;
  timestamp: string;
  source: string;
  event_type: string;
  correlation_id: string | null;
  payload: string | null;
  task_id: string | null;
  execution_id: string | null;
  project_id: string | null;
  idea_id: string | null;
  session_id: string | null;
  user_id: string | null;
  severity: string;
  created_at: string;
  task_title?: string;
  project_name?: string;
}

// Export singleton instance
export const eventService = EventService.getInstance();
