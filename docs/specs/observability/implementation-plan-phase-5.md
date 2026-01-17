# Observability System Implementation Plan - Phase 5: API Routes

> **Location:** `docs/specs/observability/implementation-plan-phase-5.md`
> **Purpose:** Actionable implementation plan for REST API endpoints
> **Status:** Ready for execution
> **Priority:** P1 (Required for UI phases)
> **Dependencies:** Phase 1 (Database Schema), Phase 4 (TypeScript Types)

---

## Executive Summary

Phase 5 implements all REST API endpoints for the observability system. These endpoints serve the frontend UI components and provide programmatic access to observability data.

| Scope               | Details                                              |
| ------------------- | ---------------------------------------------------- |
| **Route File**      | `server/routes/observability.ts`                     |
| **Services**        | `server/services/observability/*.ts`                 |
| **Tasks**           | OBS-300 to OBS-318                                   |
| **Deliverables**    | Complete REST API for observability data access      |
| **Test Validation** | API E2E tests verifying all endpoints work correctly |

---

## API Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY API ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Frontend (React)                                                        │
│       │                                                                  │
│       ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                server/routes/observability.ts                    │    │
│  │                                                                  │    │
│  │  GET /api/observability/executions                              │    │
│  │  GET /api/observability/executions/:id                          │    │
│  │  GET /api/observability/executions/:id/transcript               │    │
│  │  GET /api/observability/executions/:id/tool-uses                │    │
│  │  GET /api/observability/executions/:id/assertions               │    │
│  │  GET /api/observability/executions/:id/skills                   │    │
│  │  GET /api/observability/executions/:id/tool-summary             │    │
│  │  GET /api/observability/executions/:id/assertion-summary        │    │
│  │  GET /api/observability/cross-refs/:entityType/:entityId        │    │
│  │  GET /api/logs/message-bus                                      │    │
│  │                                                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│       │                                                                  │
│       ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              server/services/observability/                      │    │
│  │                                                                  │    │
│  │  ExecutionService      - Execution listing and details          │    │
│  │  TranscriptService     - Transcript entry queries               │    │
│  │  ToolUseService        - Tool use queries and summaries         │    │
│  │  AssertionService      - Assertion queries and chains           │    │
│  │  SkillService          - Skill trace queries                    │    │
│  │  CrossReferenceService - Entity linking                         │    │
│  │  MessageBusService     - Human-readable logs                    │    │
│  │                                                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│       │                                                                  │
│       ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                    database/ideas.db                             │    │
│  │                                                                  │    │
│  │  transcript_entries | tool_uses | assertion_results | etc.      │    │
│  │                                                                  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### OBS-300: Create Execution Service

**File:** `server/services/observability/execution-service.ts`

**Purpose:** Manage execution queries and statistics.

#### Implementation

```typescript
// server/services/observability/execution-service.ts

import Database from "better-sqlite3";
import type {
  ExecutionResponse,
  PaginatedResponse,
} from "../../types/observability";

export class ExecutionService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * List all executions with stats.
   */
  listExecutions(
    options: {
      status?: "running" | "completed" | "failed";
      limit?: number;
      cursor?: string;
    } = {},
  ): PaginatedResponse<ExecutionResponse> {
    const limit = options.limit || 50;

    // Get unique execution IDs from transcript entries
    let query = `
      SELECT DISTINCT
        te.execution_id as id,
        MIN(te.timestamp) as startTime,
        MAX(te.timestamp) as endTime,
        COUNT(DISTINCT te.instance_id) as agentCount,
        MAX(te.wave_id) as waveCount
      FROM transcript_entries te
    `;

    const params: any[] = [];

    if (options.cursor) {
      query += ` WHERE te.execution_id < ?`;
      params.push(options.cursor);
    }

    query += ` GROUP BY te.execution_id ORDER BY MIN(te.timestamp) DESC LIMIT ?`;
    params.push(limit + 1);

    const rows = this.db.prepare(query).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);

    // Enrich with stats
    const enriched = data.map((row) => this.enrichExecutionStats(row));

    return {
      data: enriched,
      total: this.getExecutionCount(),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  }

  /**
   * Get single execution details.
   */
  getExecution(executionId: string): ExecutionResponse | null {
    const query = `
      SELECT DISTINCT
        te.execution_id as id,
        MIN(te.timestamp) as startTime,
        MAX(te.timestamp) as endTime,
        COUNT(DISTINCT te.instance_id) as agentCount,
        MAX(CAST(te.wave_id AS INTEGER)) as waveCount
      FROM transcript_entries te
      WHERE te.execution_id = ?
      GROUP BY te.execution_id
    `;

    const row = this.db.prepare(query).get(executionId) as any;
    if (!row) return null;

    return this.enrichExecutionStats(row);
  }

  /**
   * Enrich execution with computed stats.
   */
  private enrichExecutionStats(row: any): ExecutionResponse {
    const executionId = row.id;

    // Get task count
    const taskCount = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT task_id) as count
      FROM transcript_entries
      WHERE execution_id = ? AND task_id IS NOT NULL
    `,
      )
      .get(executionId) as any;

    // Get tool use stats
    const toolStats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as totalToolUses,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as errorCount
      FROM tool_uses
      WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    // Get assertion stats
    const assertionStats = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as totalAssertions,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed
      FROM assertion_results
      WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    const passRate =
      assertionStats.totalAssertions > 0
        ? assertionStats.passed / assertionStats.totalAssertions
        : 1;

    // Determine status
    const latestEntry = this.db
      .prepare(
        `
      SELECT entry_type, details
      FROM transcript_entries
      WHERE execution_id = ?
      ORDER BY sequence DESC
      LIMIT 1
    `,
      )
      .get(executionId) as any;

    let status: "running" | "completed" | "failed" = "running";
    if (latestEntry) {
      if (latestEntry.entry_type === "phase_end") {
        const details = JSON.parse(latestEntry.details || "{}");
        status = details.status === "failed" ? "failed" : "completed";
      }
    }

    const startTime = new Date(row.startTime);
    const endTime = row.endTime ? new Date(row.endTime) : undefined;
    const durationMs = endTime
      ? endTime.getTime() - startTime.getTime()
      : undefined;

    return {
      id: executionId,
      startTime: row.startTime,
      endTime: row.endTime || undefined,
      status,
      taskCount: taskCount?.count || 0,
      agentCount: row.agentCount || 1,
      waveCount: row.waveCount || 1,
      stats: {
        totalToolUses: toolStats?.totalToolUses || 0,
        totalAssertions: assertionStats?.totalAssertions || 0,
        passRate,
        errorCount: toolStats?.errorCount || 0,
        durationMs,
      },
    };
  }

  /**
   * Get total execution count.
   */
  private getExecutionCount(): number {
    const result = this.db
      .prepare(
        `
      SELECT COUNT(DISTINCT execution_id) as count
      FROM transcript_entries
    `,
      )
      .get() as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] `listExecutions()` returns paginated execution list
- [ ] `getExecution()` returns single execution with stats
- [ ] Status computed from latest phase_end entry
- [ ] Pass rate calculated from assertion results
- [ ] Duration calculated when execution complete

---

### OBS-301: Create Transcript Service

**File:** `server/services/observability/transcript-service.ts`

**Purpose:** Query transcript entries with filtering.

#### Implementation

```typescript
// server/services/observability/transcript-service.ts

import Database from "better-sqlite3";
import type {
  TranscriptEntry,
  TranscriptQuery,
  PaginatedResponse,
} from "../../types/observability";

export class TranscriptService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get transcript entries for an execution.
   */
  getTranscript(
    executionId: string,
    query: TranscriptQuery = {},
  ): PaginatedResponse<TranscriptEntry> {
    const limit = query.limit || 500;
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

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
    if (query.since) {
      conditions.push("timestamp >= ?");
      params.push(query.since);
    }

    if (query.until) {
      conditions.push("timestamp <= ?");
      params.push(query.until);
    }

    // Pagination cursor
    if (query.cursor) {
      conditions.push("sequence > ?");
      params.push(parseInt(query.cursor, 10));
    }

    const whereClause = conditions.join(" AND ");
    params.push(limit + 1);

    const sql = `
      SELECT
        id,
        timestamp,
        sequence,
        execution_id as executionId,
        task_id as taskId,
        instance_id as instanceId,
        wave_id as waveNumber,
        entry_type as entryType,
        category,
        summary,
        details,
        duration_ms as durationMs
      FROM transcript_entries
      WHERE ${whereClause}
      ORDER BY sequence ASC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(this.mapRow);

    return {
      data,
      total: this.getEntryCount(executionId, query),
      hasMore,
      nextCursor: hasMore ? String(data[data.length - 1].sequence) : undefined,
    };
  }

  /**
   * Get a single transcript entry.
   */
  getEntry(entryId: string): TranscriptEntry | null {
    const sql = `
      SELECT
        id,
        timestamp,
        sequence,
        execution_id as executionId,
        task_id as taskId,
        instance_id as instanceId,
        wave_id as waveNumber,
        entry_type as entryType,
        category,
        summary,
        details,
        duration_ms as durationMs
      FROM transcript_entries
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(entryId) as any;
    if (!row) return null;

    return this.mapRow(row);
  }

  /**
   * Map database row to TranscriptEntry.
   */
  private mapRow(row: any): TranscriptEntry {
    return {
      id: row.id,
      timestamp: row.timestamp,
      sequence: row.sequence,
      executionId: row.executionId,
      taskId: row.taskId || undefined,
      instanceId: row.instanceId,
      waveNumber: row.waveNumber ? parseInt(row.waveNumber, 10) : undefined,
      entryType: row.entryType,
      category: row.category,
      summary: row.summary,
      details: JSON.parse(row.details || "{}"),
      durationMs: row.durationMs || undefined,
    };
  }

  /**
   * Get total entry count with filters.
   */
  private getEntryCount(executionId: string, query: TranscriptQuery): number {
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (query.entryTypes?.length) {
      const placeholders = query.entryTypes.map(() => "?").join(",");
      conditions.push(`entry_type IN (${placeholders})`);
      params.push(...query.entryTypes);
    }

    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.categories);
    }

    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM transcript_entries
      WHERE ${conditions.join(" AND ")}
    `;

    const result = this.db.prepare(sql).get(...params) as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Supports filtering by entry type, category, task
- [ ] Supports time range filtering
- [ ] Implements cursor-based pagination
- [ ] Returns properly typed TranscriptEntry objects
- [ ] JSON details parsed correctly

---

### OBS-302: Create Tool Use Service

**File:** `server/services/observability/tool-use-service.ts`

**Purpose:** Query tool uses and compute summaries.

#### Implementation

```typescript
// server/services/observability/tool-use-service.ts

import Database from "better-sqlite3";
import type {
  ToolUse,
  ToolUseQuery,
  ToolUsageSummaryResponse,
  PaginatedResponse,
  ToolCategory,
} from "../../types/observability";

export class ToolUseService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get tool uses for an execution.
   */
  getToolUses(
    executionId: string,
    query: ToolUseQuery = {},
  ): PaginatedResponse<ToolUse> {
    const limit = query.limit || 100;
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    // Filter by tools
    if (query.tools?.length) {
      const placeholders = query.tools.map(() => "?").join(",");
      conditions.push(`tool IN (${placeholders})`);
      params.push(...query.tools);
    }

    // Filter by categories
    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`tool_category IN (${placeholders})`);
      params.push(...query.categories);
    }

    // Filter by status
    if (query.status?.length) {
      const placeholders = query.status.map(() => "?").join(",");
      conditions.push(`result_status IN (${placeholders})`);
      params.push(...query.status);
    }

    // Filter by task
    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    // Time filters
    if (query.since) {
      conditions.push("start_time >= ?");
      params.push(query.since);
    }

    if (query.until) {
      conditions.push("end_time <= ?");
      params.push(query.until);
    }

    const whereClause = conditions.join(" AND ");

    // Select columns based on include flags
    const selectColumns = [
      "id",
      "execution_id as executionId",
      "task_id as taskId",
      "transcript_entry_id as transcriptEntryId",
      "tool",
      "tool_category as toolCategory",
      "input_summary as inputSummary",
      "result_status as resultStatus",
      "output_summary as outputSummary",
      "is_error as isError",
      "is_blocked as isBlocked",
      "error_message as errorMessage",
      "block_reason as blockReason",
      "start_time as startTime",
      "end_time as endTime",
      "duration_ms as durationMs",
      "within_skill as withinSkill",
      "parent_tool_use_id as parentToolUseId",
    ];

    if (query.includeInputs) {
      selectColumns.push("input");
    }

    if (query.includeOutputs) {
      selectColumns.push("output");
    }

    params.push(limit + 1);

    const sql = `
      SELECT ${selectColumns.join(", ")}
      FROM tool_uses
      WHERE ${whereClause}
      ORDER BY start_time ASC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map((row) => this.mapRow(row, query));

    return {
      data,
      total: this.getToolUseCount(executionId, query),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  }

  /**
   * Get tool usage summary for an execution.
   */
  getToolSummary(executionId: string): ToolUsageSummaryResponse {
    // Aggregate by tool
    const byToolRows = this.db
      .prepare(
        `
      SELECT
        tool,
        COUNT(*) as count,
        SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN result_status = 'blocked' THEN 1 ELSE 0 END) as blocked,
        AVG(duration_ms) as avgDurationMs
      FROM tool_uses
      WHERE execution_id = ?
      GROUP BY tool
    `,
      )
      .all(executionId) as any[];

    const byTool: ToolUsageSummaryResponse["byTool"] = {};
    for (const row of byToolRows) {
      byTool[row.tool] = {
        count: row.count,
        success: row.success,
        error: row.error,
        blocked: row.blocked,
        avgDurationMs: Math.round(row.avgDurationMs || 0),
      };
    }

    // Aggregate by category
    const byCategoryRows = this.db
      .prepare(
        `
      SELECT
        tool_category as category,
        COUNT(*) as count,
        SUM(CASE WHEN result_status = 'done' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN result_status = 'error' THEN 1 ELSE 0 END) as error,
        SUM(CASE WHEN result_status = 'blocked' THEN 1 ELSE 0 END) as blocked
      FROM tool_uses
      WHERE execution_id = ?
      GROUP BY tool_category
    `,
      )
      .all(executionId) as any[];

    const byCategory: ToolUsageSummaryResponse["byCategory"] = {} as any;
    for (const row of byCategoryRows) {
      byCategory[row.category as ToolCategory] = {
        count: row.count,
        success: row.success,
        error: row.error,
        blocked: row.blocked,
      };
    }

    // Timeline
    const timeline = this.db
      .prepare(
        `
      SELECT
        MIN(start_time) as firstToolUse,
        MAX(end_time) as lastToolUse,
        SUM(duration_ms) as totalDurationMs
      FROM tool_uses
      WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    // Errors list
    const errors = this.db
      .prepare(
        `
      SELECT
        id as toolUseId,
        tool,
        input_summary as inputSummary,
        error_message as errorMessage,
        start_time as timestamp
      FROM tool_uses
      WHERE execution_id = ? AND is_error = 1
      ORDER BY start_time DESC
      LIMIT 20
    `,
      )
      .all(executionId) as ToolUsageSummaryResponse["errors"];

    // Blocked list
    const blocked = this.db
      .prepare(
        `
      SELECT
        id as toolUseId,
        tool,
        input_summary as inputSummary,
        block_reason as blockReason,
        start_time as timestamp
      FROM tool_uses
      WHERE execution_id = ? AND is_blocked = 1
      ORDER BY start_time DESC
      LIMIT 20
    `,
      )
      .all(executionId) as ToolUsageSummaryResponse["blocked"];

    // Total count
    const totalResult = this.db
      .prepare(
        `
      SELECT COUNT(*) as count FROM tool_uses WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    return {
      executionId,
      totalToolUses: totalResult?.count || 0,
      byTool,
      byCategory,
      timeline: {
        firstToolUse: timeline?.firstToolUse,
        lastToolUse: timeline?.lastToolUse,
        totalDurationMs: timeline?.totalDurationMs || 0,
      },
      errors,
      blocked,
    };
  }

  /**
   * Get single tool use.
   */
  getToolUse(toolUseId: string): ToolUse | null {
    const sql = `
      SELECT
        id,
        execution_id as executionId,
        task_id as taskId,
        transcript_entry_id as transcriptEntryId,
        tool,
        tool_category as toolCategory,
        input,
        input_summary as inputSummary,
        result_status as resultStatus,
        output,
        output_summary as outputSummary,
        is_error as isError,
        is_blocked as isBlocked,
        error_message as errorMessage,
        block_reason as blockReason,
        start_time as startTime,
        end_time as endTime,
        duration_ms as durationMs,
        within_skill as withinSkill,
        parent_tool_use_id as parentToolUseId
      FROM tool_uses
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(toolUseId) as any;
    if (!row) return null;

    return this.mapRow(row, { includeInputs: true, includeOutputs: true });
  }

  /**
   * Map database row to ToolUse.
   */
  private mapRow(row: any, query: ToolUseQuery = {}): ToolUse {
    const result: ToolUse = {
      id: row.id,
      executionId: row.executionId,
      taskId: row.taskId || undefined,
      transcriptEntryId: row.transcriptEntryId,
      tool: row.tool,
      toolCategory: row.toolCategory,
      input: query.includeInputs && row.input ? JSON.parse(row.input) : {},
      inputSummary: row.inputSummary,
      resultStatus: row.resultStatus,
      output:
        query.includeOutputs && row.output ? JSON.parse(row.output) : undefined,
      outputSummary: row.outputSummary,
      isError: Boolean(row.isError),
      isBlocked: Boolean(row.isBlocked),
      errorMessage: row.errorMessage || undefined,
      blockReason: row.blockReason || undefined,
      startTime: row.startTime,
      endTime: row.endTime,
      durationMs: row.durationMs,
      withinSkill: row.withinSkill || undefined,
      parentToolUseId: row.parentToolUseId || undefined,
    };

    return result;
  }

  /**
   * Get tool use count with filters.
   */
  private getToolUseCount(executionId: string, query: ToolUseQuery): number {
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (query.tools?.length) {
      const placeholders = query.tools.map(() => "?").join(",");
      conditions.push(`tool IN (${placeholders})`);
      params.push(...query.tools);
    }

    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`tool_category IN (${placeholders})`);
      params.push(...query.categories);
    }

    if (query.status?.length) {
      const placeholders = query.status.map(() => "?").join(",");
      conditions.push(`result_status IN (${placeholders})`);
      params.push(...query.status);
    }

    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM tool_uses
      WHERE ${conditions.join(" AND ")}
    `;

    const result = this.db.prepare(sql).get(...params) as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Supports filtering by tool, category, status
- [ ] Supports optional input/output inclusion
- [ ] `getToolSummary()` aggregates by tool and category
- [ ] Error and blocked lists included in summary
- [ ] Duration metrics calculated correctly

---

### OBS-303: Create Assertion Service

**File:** `server/services/observability/assertion-service.ts`

**Purpose:** Query assertions and compute summaries.

#### Implementation

```typescript
// server/services/observability/assertion-service.ts

import Database from "better-sqlite3";
import type {
  AssertionResult,
  AssertionChain,
  AssertionQuery,
  AssertionSummaryResponse,
  PaginatedResponse,
  AssertionCategory,
} from "../../types/observability";

export class AssertionService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get assertions for an execution.
   */
  getAssertions(
    executionId: string,
    query: AssertionQuery = {},
  ): PaginatedResponse<AssertionResult> {
    const limit = query.limit || 100;
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.categories);
    }

    if (query.result?.length) {
      const placeholders = query.result.map(() => "?").join(",");
      conditions.push(`result IN (${placeholders})`);
      params.push(...query.result);
    }

    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    if (query.chainId) {
      conditions.push("chain_id = ?");
      params.push(query.chainId);
    }

    if (query.since) {
      conditions.push("timestamp >= ?");
      params.push(query.since);
    }

    const whereClause = conditions.join(" AND ");
    params.push(limit + 1);

    const sql = `
      SELECT
        id,
        task_id as taskId,
        execution_id as executionId,
        chain_id as chainId,
        category,
        description,
        result,
        evidence,
        timestamp,
        duration_ms as durationMs
      FROM assertion_results
      WHERE ${whereClause}
      ORDER BY timestamp ASC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(this.mapRow);

    return {
      data,
      total: this.getAssertionCount(executionId, query),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  }

  /**
   * Get assertion summary for an execution.
   */
  getAssertionSummary(executionId: string): AssertionSummaryResponse {
    // Overall summary
    const summary = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as totalAssertions,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN result = 'warn' THEN 1 ELSE 0 END) as warnings
      FROM assertion_results
      WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    const passRate =
      summary.totalAssertions > 0
        ? summary.passed / summary.totalAssertions
        : 1;

    // By category
    const byCategoryRows = this.db
      .prepare(
        `
      SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN result = 'fail' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN result = 'skip' THEN 1 ELSE 0 END) as skipped
      FROM assertion_results
      WHERE execution_id = ?
      GROUP BY category
    `,
      )
      .all(executionId) as any[];

    const byCategory: AssertionSummaryResponse["byCategory"] = {};
    for (const row of byCategoryRows) {
      byCategory[row.category as AssertionCategory] = {
        total: row.total,
        passed: row.passed,
        failed: row.failed,
        skipped: row.skipped,
      };
    }

    // Recent failures
    const recentFailures = this.db
      .prepare(
        `
      SELECT
        id as assertionId,
        task_id as taskId,
        category,
        description,
        timestamp
      FROM assertion_results
      WHERE execution_id = ? AND result = 'fail'
      ORDER BY timestamp DESC
      LIMIT 10
    `,
      )
      .all(executionId) as AssertionSummaryResponse["recentFailures"];

    return {
      executionId,
      summary: {
        totalAssertions: summary.totalAssertions,
        passed: summary.passed,
        failed: summary.failed,
        skipped: summary.skipped,
        warnings: summary.warnings,
        passRate,
      },
      byCategory,
      recentFailures,
    };
  }

  /**
   * Get assertion chains for an execution.
   */
  getChains(executionId: string): AssertionChain[] {
    const chains = this.db
      .prepare(
        `
      SELECT
        id,
        task_id as taskId,
        execution_id as executionId,
        description,
        overall_result as overallResult,
        pass_count as passCount,
        fail_count as failCount,
        skip_count as skipCount
      FROM assertion_chains
      WHERE execution_id = ?
      ORDER BY id ASC
    `,
      )
      .all(executionId) as any[];

    return chains.map((chain) => {
      // Get assertions for this chain
      const assertions = this.db
        .prepare(
          `
        SELECT
          id,
          task_id as taskId,
          execution_id as executionId,
          chain_id as chainId,
          category,
          description,
          result,
          evidence,
          timestamp,
          duration_ms as durationMs
        FROM assertion_results
        WHERE chain_id = ?
        ORDER BY timestamp ASC
      `,
        )
        .all(chain.id) as any[];

      // Get first failure
      const firstFailure = assertions.find((a) => a.result === "fail");

      return {
        id: chain.id,
        taskId: chain.taskId,
        executionId: chain.executionId,
        description: chain.description,
        assertions: assertions.map(this.mapRow),
        overallResult: chain.overallResult,
        passCount: chain.passCount,
        failCount: chain.failCount,
        skipCount: chain.skipCount,
        firstFailure: firstFailure
          ? {
              assertionId: firstFailure.id,
              description: firstFailure.description,
              evidence: JSON.parse(firstFailure.evidence || "{}"),
            }
          : undefined,
      };
    });
  }

  /**
   * Get single assertion.
   */
  getAssertion(assertionId: string): AssertionResult | null {
    const sql = `
      SELECT
        id,
        task_id as taskId,
        execution_id as executionId,
        chain_id as chainId,
        category,
        description,
        result,
        evidence,
        timestamp,
        duration_ms as durationMs
      FROM assertion_results
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(assertionId) as any;
    if (!row) return null;

    return this.mapRow(row);
  }

  /**
   * Map database row to AssertionResult.
   */
  private mapRow(row: any): AssertionResult {
    return {
      id: row.id,
      taskId: row.taskId,
      executionId: row.executionId,
      chainId: row.chainId || undefined,
      category: row.category,
      description: row.description,
      result: row.result,
      evidence: JSON.parse(row.evidence || "{}"),
      timestamp: row.timestamp,
      durationMs: row.durationMs,
    };
  }

  /**
   * Get assertion count with filters.
   */
  private getAssertionCount(
    executionId: string,
    query: AssertionQuery,
  ): number {
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (query.categories?.length) {
      const placeholders = query.categories.map(() => "?").join(",");
      conditions.push(`category IN (${placeholders})`);
      params.push(...query.categories);
    }

    if (query.result?.length) {
      const placeholders = query.result.map(() => "?").join(",");
      conditions.push(`result IN (${placeholders})`);
      params.push(...query.result);
    }

    if (query.taskId) {
      conditions.push("task_id = ?");
      params.push(query.taskId);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM assertion_results
      WHERE ${conditions.join(" AND ")}
    `;

    const result = this.db.prepare(sql).get(...params) as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Supports filtering by category, result, task, chain
- [ ] `getAssertionSummary()` aggregates by category
- [ ] `getChains()` returns full chain structures
- [ ] First failure identified in chains
- [ ] Pass rate calculated correctly

---

### OBS-304: Create Skill Service

**File:** `server/services/observability/skill-service.ts`

**Purpose:** Query skill traces.

#### Implementation

```typescript
// server/services/observability/skill-service.ts

import Database from "better-sqlite3";
import type {
  SkillTrace,
  SkillReference,
  SkillsUsageSummary,
  PaginatedResponse,
} from "../../types/observability";

export class SkillService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get skill traces for an execution.
   */
  getSkillTraces(
    executionId: string,
    options: { taskId?: string; limit?: number } = {},
  ): PaginatedResponse<SkillTrace> {
    const limit = options.limit || 100;
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (options.taskId) {
      conditions.push("task_id = ?");
      params.push(options.taskId);
    }

    params.push(limit + 1);

    const sql = `
      SELECT
        id,
        execution_id as executionId,
        task_id as taskId,
        skill_name as skillName,
        skill_file as skillFile,
        line_number as lineNumber,
        section_title as sectionTitle,
        input_summary as inputSummary,
        output_summary as outputSummary,
        start_time as startTime,
        end_time as endTime,
        duration_ms as durationMs,
        token_estimate as tokenEstimate,
        status,
        error_message as errorMessage,
        parent_skill_id as parentSkillId
      FROM skill_traces
      WHERE ${conditions.join(" AND ")}
      ORDER BY start_time ASC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows
      .slice(0, limit)
      .map((row) => this.mapRow(row, executionId));

    return {
      data,
      total: this.getSkillCount(executionId, options.taskId),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].id : undefined,
    };
  }

  /**
   * Get skill usage summary for an execution.
   */
  getSkillsSummary(executionId: string): SkillsUsageSummary {
    // Aggregate by skill
    const skillRows = this.db
      .prepare(
        `
      SELECT
        skill_name as skillName,
        skill_file as skillFile,
        COUNT(*) as invocationCount,
        SUM(duration_ms) as totalDurationMs,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successCount,
        COUNT(*) as total
      FROM skill_traces
      WHERE execution_id = ?
      GROUP BY skill_name, skill_file
    `,
      )
      .all(executionId) as any[];

    const skills = skillRows.map((row) => {
      // Get sections for this skill
      const sections = this.db
        .prepare(
          `
        SELECT
          section_title as section,
          COUNT(*) as count
        FROM skill_traces
        WHERE execution_id = ? AND skill_name = ?
        GROUP BY section_title
      `,
        )
        .all(executionId, row.skillName) as any[];

      return {
        skillName: row.skillName,
        skillFile: row.skillFile,
        invocationCount: row.invocationCount,
        totalDurationMs: row.totalDurationMs,
        successRate: row.total > 0 ? row.successCount / row.total : 1,
        sections,
      };
    });

    // File references
    const fileRefs = this.db
      .prepare(
        `
      SELECT DISTINCT
        skill_file as file,
        GROUP_CONCAT(DISTINCT line_number) as lines,
        GROUP_CONCAT(DISTINCT section_title) as sections
      FROM skill_traces
      WHERE execution_id = ?
      GROUP BY skill_file
    `,
      )
      .all(executionId) as any[];

    const skillFileReferences = fileRefs.map((ref) => ({
      file: ref.file,
      linesReferenced: ref.lines ? ref.lines.split(",").map(Number) : [],
      sectionsUsed: ref.sections ? ref.sections.split(",") : [],
    }));

    // Totals
    const totals = this.db
      .prepare(
        `
      SELECT
        COUNT(*) as totalSkillInvocations,
        COUNT(DISTINCT skill_name) as uniqueSkillsUsed
      FROM skill_traces
      WHERE execution_id = ?
    `,
      )
      .get(executionId) as any;

    return {
      executionId,
      totalSkillInvocations: totals?.totalSkillInvocations || 0,
      uniqueSkillsUsed: totals?.uniqueSkillsUsed || 0,
      skills,
      skillFileReferences,
    };
  }

  /**
   * Get single skill trace with nested data.
   */
  getSkillTrace(traceId: string): SkillTrace | null {
    const sql = `
      SELECT
        id,
        execution_id as executionId,
        task_id as taskId,
        skill_name as skillName,
        skill_file as skillFile,
        line_number as lineNumber,
        section_title as sectionTitle,
        input_summary as inputSummary,
        output_summary as outputSummary,
        start_time as startTime,
        end_time as endTime,
        duration_ms as durationMs,
        token_estimate as tokenEstimate,
        status,
        error_message as errorMessage,
        parent_skill_id as parentSkillId
      FROM skill_traces
      WHERE id = ?
    `;

    const row = this.db.prepare(sql).get(traceId) as any;
    if (!row) return null;

    return this.mapRow(row, row.executionId);
  }

  /**
   * Map database row to SkillTrace.
   */
  private mapRow(row: any, executionId: string): SkillTrace {
    const skill: SkillReference = {
      skillName: row.skillName,
      skillFile: row.skillFile,
      lineNumber: row.lineNumber,
      sectionTitle: row.sectionTitle,
      inputSummary: row.inputSummary,
      outputSummary: row.outputSummary,
      startTime: row.startTime,
      endTime: row.endTime,
      tokenEstimate: row.tokenEstimate,
      status: row.status,
      errorMessage: row.errorMessage || undefined,
    };

    // Get tool calls during this skill
    const toolCalls = this.db
      .prepare(
        `
      SELECT
        id as toolUseId,
        tool,
        input_summary as inputSummary,
        result_status as resultStatus,
        duration_ms as durationMs
      FROM tool_uses
      WHERE within_skill = ?
    `,
      )
      .all(row.id) as any[];

    // Get sub-skills
    const subSkillRows = this.db
      .prepare(
        `
      SELECT id FROM skill_traces WHERE parent_skill_id = ?
    `,
      )
      .all(row.id) as any[];

    const subSkills = subSkillRows
      .map((s) => this.getSkillTrace(s.id)!)
      .filter(Boolean);

    // Get assertions
    const assertions = this.db
      .prepare(
        `
      SELECT
        id,
        task_id as taskId,
        execution_id as executionId,
        category,
        description,
        result,
        evidence,
        timestamp,
        duration_ms as durationMs
      FROM assertion_results
      WHERE execution_id = ? AND task_id = ?
        AND timestamp >= ? AND timestamp <= ?
    `,
      )
      .all(executionId, row.taskId, row.startTime, row.endTime) as any[];

    return {
      id: row.id,
      executionId: row.executionId,
      taskId: row.taskId,
      skill,
      toolCalls,
      subSkills,
      entries: [], // Would need to query transcript_entries
      assertions: assertions.map((a) => ({
        ...a,
        evidence: JSON.parse(a.evidence || "{}"),
      })),
    };
  }

  /**
   * Get skill trace count.
   */
  private getSkillCount(executionId: string, taskId?: string): number {
    const conditions: string[] = ["execution_id = ?"];
    const params: any[] = [executionId];

    if (taskId) {
      conditions.push("task_id = ?");
      params.push(taskId);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM skill_traces
      WHERE ${conditions.join(" AND ")}
    `;

    const result = this.db.prepare(sql).get(...params) as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Returns skill traces with nested tool calls
- [ ] Supports filtering by task
- [ ] `getSkillsSummary()` aggregates by skill and file
- [ ] Sub-skills loaded recursively
- [ ] File references include line numbers and sections

---

### OBS-305: Create Cross-Reference Service

**File:** `server/services/observability/cross-reference-service.ts`

**Purpose:** Resolve entity cross-references for navigation.

#### Implementation

```typescript
// server/services/observability/cross-reference-service.ts

import Database from "better-sqlite3";
import type {
  EntityCrossRefs,
  ToolUseCrossRefs,
  AssertionCrossRefs,
  SkillTraceCrossRefs,
  TranscriptEntryCrossRefs,
  RelatedEntitiesResult,
  CrossRefEntityType,
} from "../../types/observability";

export class CrossReferenceService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Get cross-references for an entity.
   */
  getCrossReferences(
    entityType: CrossRefEntityType,
    entityId: string,
  ): EntityCrossRefs | null {
    switch (entityType) {
      case "toolUse":
        return this.getToolUseCrossRefs(entityId);
      case "assertion":
        return this.getAssertionCrossRefs(entityId);
      case "skillTrace":
        return this.getSkillTraceCrossRefs(entityId);
      case "transcriptEntry":
        return this.getTranscriptEntryCrossRefs(entityId);
      default:
        return null;
    }
  }

  /**
   * Get cross-references for a tool use.
   */
  private getToolUseCrossRefs(toolUseId: string): EntityCrossRefs | null {
    const toolUse = this.db
      .prepare(
        `
      SELECT
        transcript_entry_id,
        task_id,
        within_skill,
        parent_tool_use_id
      FROM tool_uses
      WHERE id = ?
    `,
      )
      .get(toolUseId) as any;

    if (!toolUse) return null;

    // Get child tool uses
    const childToolUses = this.db
      .prepare(
        `
      SELECT id FROM tool_uses WHERE parent_tool_use_id = ?
    `,
      )
      .all(toolUseId) as any[];

    // Get related assertions (that reference this tool use in evidence)
    const relatedAssertions = this.db
      .prepare(
        `
      SELECT id FROM assertion_results
      WHERE evidence LIKE ?
    `,
      )
      .all(`%${toolUseId}%`) as any[];

    const refs: ToolUseCrossRefs = {
      transcriptEntry: toolUse.transcript_entry_id,
      task: toolUse.task_id || undefined,
      skill: toolUse.within_skill || undefined,
      parentToolUse: toolUse.parent_tool_use_id || undefined,
      childToolUses: childToolUses.map((c) => c.id),
      relatedAssertions: relatedAssertions.map((a) => a.id),
    };

    return { type: "toolUse", refs };
  }

  /**
   * Get cross-references for an assertion.
   */
  private getAssertionCrossRefs(assertionId: string): EntityCrossRefs | null {
    const assertion = this.db
      .prepare(
        `
      SELECT
        task_id,
        chain_id,
        execution_id,
        timestamp
      FROM assertion_results
      WHERE id = ?
    `,
      )
      .get(assertionId) as any;

    if (!assertion) return null;

    // Get transcript entries around this assertion
    const transcriptEntries = this.db
      .prepare(
        `
      SELECT id FROM transcript_entries
      WHERE execution_id = ? AND task_id = ?
      ORDER BY sequence ASC
    `,
      )
      .all(assertion.execution_id, assertion.task_id) as any[];

    // Get tool uses that might be evidence
    const toolUses = this.db
      .prepare(
        `
      SELECT id FROM tool_uses
      WHERE execution_id = ? AND task_id = ?
    `,
      )
      .all(assertion.execution_id, assertion.task_id) as any[];

    // Get prev/next in chain
    let previousInChain: string | undefined;
    let nextInChain: string | undefined;

    if (assertion.chain_id) {
      const chainAssertions = this.db
        .prepare(
          `
        SELECT id FROM assertion_results
        WHERE chain_id = ?
        ORDER BY timestamp ASC
      `,
        )
        .all(assertion.chain_id) as any[];

      const idx = chainAssertions.findIndex((a) => a.id === assertionId);
      if (idx > 0) previousInChain = chainAssertions[idx - 1].id;
      if (idx < chainAssertions.length - 1)
        nextInChain = chainAssertions[idx + 1].id;
    }

    const refs: AssertionCrossRefs = {
      task: assertion.task_id,
      chain: assertion.chain_id || undefined,
      transcriptEntries: transcriptEntries.map((e) => e.id),
      toolUses: toolUses.map((t) => t.id),
      previousInChain,
      nextInChain,
    };

    return { type: "assertion", refs };
  }

  /**
   * Get cross-references for a skill trace.
   */
  private getSkillTraceCrossRefs(traceId: string): EntityCrossRefs | null {
    const trace = this.db
      .prepare(
        `
      SELECT
        task_id,
        execution_id,
        start_time,
        end_time,
        parent_skill_id
      FROM skill_traces
      WHERE id = ?
    `,
      )
      .get(traceId) as any;

    if (!trace) return null;

    // Get transcript entries during skill
    const transcriptEntries = this.db
      .prepare(
        `
      SELECT id FROM transcript_entries
      WHERE execution_id = ?
        AND timestamp >= ? AND timestamp <= ?
      ORDER BY sequence ASC
    `,
      )
      .all(trace.execution_id, trace.start_time, trace.end_time) as any[];

    // Get tool uses during skill
    const toolUses = this.db
      .prepare(
        `
      SELECT id FROM tool_uses WHERE within_skill = ?
    `,
      )
      .all(traceId) as any[];

    // Get assertions during skill
    const assertions = this.db
      .prepare(
        `
      SELECT id FROM assertion_results
      WHERE execution_id = ? AND task_id = ?
        AND timestamp >= ? AND timestamp <= ?
    `,
      )
      .all(
        trace.execution_id,
        trace.task_id,
        trace.start_time,
        trace.end_time,
      ) as any[];

    // Get child skills
    const childSkills = this.db
      .prepare(
        `
      SELECT id FROM skill_traces WHERE parent_skill_id = ?
    `,
      )
      .all(traceId) as any[];

    const refs: SkillTraceCrossRefs = {
      task: trace.task_id,
      transcriptEntries: transcriptEntries.map((e) => e.id),
      toolUses: toolUses.map((t) => t.id),
      assertions: assertions.map((a) => a.id),
      parentSkill: trace.parent_skill_id || undefined,
      childSkills: childSkills.map((s) => s.id),
    };

    return { type: "skillTrace", refs };
  }

  /**
   * Get cross-references for a transcript entry.
   */
  private getTranscriptEntryCrossRefs(entryId: string): EntityCrossRefs | null {
    const entry = this.db
      .prepare(
        `
      SELECT
        execution_id,
        task_id,
        entry_type,
        sequence
      FROM transcript_entries
      WHERE id = ?
    `,
      )
      .get(entryId) as any;

    if (!entry) return null;

    // Get previous/next entries
    const prevEntry = this.db
      .prepare(
        `
      SELECT id FROM transcript_entries
      WHERE execution_id = ? AND sequence < ?
      ORDER BY sequence DESC
      LIMIT 1
    `,
      )
      .get(entry.execution_id, entry.sequence) as any;

    const nextEntry = this.db
      .prepare(
        `
      SELECT id FROM transcript_entries
      WHERE execution_id = ? AND sequence > ?
      ORDER BY sequence ASC
      LIMIT 1
    `,
      )
      .get(entry.execution_id, entry.sequence) as any;

    // Get linked entities based on entry type
    let toolUse: string | undefined;
    let skill: string | undefined;
    let assertion: string | undefined;

    if (entry.entry_type === "tool_use") {
      const tu = this.db
        .prepare(
          `
        SELECT id FROM tool_uses WHERE transcript_entry_id = ?
      `,
        )
        .get(entryId) as any;
      toolUse = tu?.id;
    }

    if (
      entry.entry_type === "skill_invoke" ||
      entry.entry_type === "skill_complete"
    ) {
      // Would need to parse details to get skill trace ID
    }

    if (entry.entry_type === "assertion") {
      // Would need to parse details to get assertion ID
    }

    const refs: TranscriptEntryCrossRefs = {
      execution: entry.execution_id,
      task: entry.task_id || undefined,
      toolUse,
      skill,
      assertion,
      previousEntry: prevEntry?.id,
      nextEntry: nextEntry?.id,
    };

    return { type: "transcriptEntry", refs };
  }

  /**
   * Get related entities (fully loaded).
   */
  getRelatedEntities(
    entityType: CrossRefEntityType,
    entityId: string,
  ): RelatedEntitiesResult {
    const crossRefs = this.getCrossReferences(entityType, entityId);
    if (!crossRefs) {
      return {
        transcriptEntries: [],
        toolUses: [],
        assertions: [],
        skillTraces: [],
      };
    }

    // Load full entities based on cross-refs
    // (In practice, you'd use the respective services to load these)
    return {
      transcriptEntries: [],
      toolUses: [],
      assertions: [],
      skillTraces: [],
    };
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Returns cross-references for all 4 entity types
- [ ] Tool uses link to transcript, task, skill, parent
- [ ] Assertions link to chain neighbors
- [ ] Skill traces link to nested operations
- [ ] Transcript entries link to prev/next in sequence

---

### OBS-306: Create Message Bus Service

**File:** `server/services/observability/message-bus-service.ts`

**Purpose:** Query human-readable message bus logs.

#### Implementation

```typescript
// server/services/observability/message-bus-service.ts

import Database from "better-sqlite3";
import type {
  MessageBusLogEntry,
  MessageBusQuery,
  PaginatedResponse,
} from "../../types/observability";

export class MessageBusService {
  private db: Database.Database;

  constructor(dbPath: string = "database/ideas.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Query message bus logs.
   */
  getLogs(query: MessageBusQuery = {}): PaginatedResponse<MessageBusLogEntry> {
    const limit = query.limit || 100;
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.since) {
      conditions.push("timestamp >= ?");
      params.push(query.since);
    }

    if (query.until) {
      conditions.push("timestamp <= ?");
      params.push(query.until);
    }

    if (query.eventTypes?.length) {
      const placeholders = query.eventTypes.map(() => "?").join(",");
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...query.eventTypes);
    }

    if (query.sources?.length) {
      const placeholders = query.sources.map(() => "?").join(",");
      conditions.push(`source IN (${placeholders})`);
      params.push(...query.sources);
    }

    if (query.severity?.length) {
      const placeholders = query.severity.map(() => "?").join(",");
      conditions.push(`severity IN (${placeholders})`);
      params.push(...query.severity);
    }

    if (query.correlationId) {
      conditions.push("correlation_id = ?");
      params.push(query.correlationId);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit + 1);

    const sql = `
      SELECT
        id as eventId,
        timestamp,
        source,
        event_type as eventType,
        correlation_id as correlationId,
        human_summary as humanSummary,
        severity,
        category,
        transcript_entry_id as transcriptEntryId,
        task_id as taskId,
        execution_id as executionId,
        payload
      FROM message_bus_log
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const rows = this.db.prepare(sql).all(...params) as any[];

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit).map(this.mapRow);

    return {
      data,
      total: this.getLogCount(query),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].eventId : undefined,
    };
  }

  /**
   * Get correlated events.
   */
  getCorrelatedEvents(correlationId: string): MessageBusLogEntry[] {
    const sql = `
      SELECT
        id as eventId,
        timestamp,
        source,
        event_type as eventType,
        correlation_id as correlationId,
        human_summary as humanSummary,
        severity,
        category,
        transcript_entry_id as transcriptEntryId,
        task_id as taskId,
        execution_id as executionId,
        payload
      FROM message_bus_log
      WHERE correlation_id = ?
      ORDER BY timestamp ASC
    `;

    const rows = this.db.prepare(sql).all(correlationId) as any[];
    return rows.map(this.mapRow);
  }

  /**
   * Map database row to MessageBusLogEntry.
   */
  private mapRow(row: any): MessageBusLogEntry {
    return {
      eventId: row.eventId,
      timestamp: row.timestamp,
      source: row.source,
      eventType: row.eventType,
      correlationId: row.correlationId || undefined,
      humanSummary: row.humanSummary,
      severity: row.severity,
      category: row.category,
      transcriptEntryId: row.transcriptEntryId || undefined,
      taskId: row.taskId || undefined,
      executionId: row.executionId || undefined,
      payload: JSON.parse(row.payload || "{}"),
    };
  }

  /**
   * Get log count with filters.
   */
  private getLogCount(query: MessageBusQuery): number {
    const conditions: string[] = [];
    const params: any[] = [];

    if (query.since) {
      conditions.push("timestamp >= ?");
      params.push(query.since);
    }

    if (query.until) {
      conditions.push("timestamp <= ?");
      params.push(query.until);
    }

    if (query.eventTypes?.length) {
      const placeholders = query.eventTypes.map(() => "?").join(",");
      conditions.push(`event_type IN (${placeholders})`);
      params.push(...query.eventTypes);
    }

    if (query.sources?.length) {
      const placeholders = query.sources.map(() => "?").join(",");
      conditions.push(`source IN (${placeholders})`);
      params.push(...query.sources);
    }

    if (query.severity?.length) {
      const placeholders = query.severity.map(() => "?").join(",");
      conditions.push(`severity IN (${placeholders})`);
      params.push(...query.severity);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `SELECT COUNT(*) as count FROM message_bus_log ${whereClause}`;

    const result = this.db.prepare(sql).get(...params) as any;
    return result?.count || 0;
  }

  close(): void {
    this.db.close();
  }
}
```

#### Acceptance Criteria

- [ ] Supports filtering by time range, event type, source, severity
- [ ] Supports correlation ID filtering
- [ ] `getCorrelatedEvents()` returns all related events
- [ ] Returns paginated results

---

### OBS-307: Create Service Index

**File:** `server/services/observability/index.ts`

**Purpose:** Export all observability services.

```typescript
// server/services/observability/index.ts

export { ExecutionService } from "./execution-service";
export { TranscriptService } from "./transcript-service";
export { ToolUseService } from "./tool-use-service";
export { AssertionService } from "./assertion-service";
export { SkillService } from "./skill-service";
export { CrossReferenceService } from "./cross-reference-service";
export { MessageBusService } from "./message-bus-service";

// Re-export TypeScript services if they exist
export { TranscriptWriter } from "./transcript-writer";
export { ToolUseLogger } from "./tool-use-logger";
export { AssertionRecorder } from "./assertion-recorder";
```

#### Acceptance Criteria

- [ ] All services exported from index
- [ ] Clean import paths for routes

---

### OBS-308: Create Observability Routes

**File:** `server/routes/observability.ts`

**Purpose:** REST API endpoints for observability.

#### Implementation

```typescript
// server/routes/observability.ts

import { Router, Request, Response } from "express";
import {
  ExecutionService,
  TranscriptService,
  ToolUseService,
  AssertionService,
  SkillService,
  CrossReferenceService,
  MessageBusService,
} from "../services/observability";
import type {
  TranscriptQuery,
  ToolUseQuery,
  AssertionQuery,
  MessageBusQuery,
  CrossRefEntityType,
} from "../types/observability";

const router = Router();

// Initialize services
const executionService = new ExecutionService();
const transcriptService = new TranscriptService();
const toolUseService = new ToolUseService();
const assertionService = new AssertionService();
const skillService = new SkillService();
const crossRefService = new CrossReferenceService();
const messageBusService = new MessageBusService();

// ============================================================================
// EXECUTIONS
// ============================================================================

/**
 * GET /api/observability/executions
 * List all executions with stats.
 */
router.get("/executions", (req: Request, res: Response) => {
  try {
    const { status, limit, cursor } = req.query;

    const result = executionService.listExecutions({
      status: status as any,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: cursor as string,
    });

    res.json(result);
  } catch (error) {
    console.error("Error listing executions:", error);
    res.status(500).json({
      error: "Failed to list executions",
      code: "EXECUTION_LIST_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

/**
 * GET /api/observability/executions/:id
 * Get single execution details.
 */
router.get("/executions/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const execution = executionService.getExecution(id);
    if (!execution) {
      return res.status(404).json({
        error: "Execution not found",
        code: "EXECUTION_NOT_FOUND",
        details: { executionId: id },
      });
    }

    res.json(execution);
  } catch (error) {
    console.error("Error getting execution:", error);
    res.status(500).json({
      error: "Failed to get execution",
      code: "EXECUTION_GET_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

// ============================================================================
// TRANSCRIPT
// ============================================================================

/**
 * GET /api/observability/executions/:id/transcript
 * Get transcript entries for an execution.
 */
router.get("/executions/:id/transcript", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { entryTypes, categories, taskId, since, until, limit, cursor } =
      req.query;

    const query: TranscriptQuery = {
      entryTypes: entryTypes ? (entryTypes as string).split(",") : undefined,
      categories: categories ? (categories as string).split(",") : undefined,
      taskId: taskId as string,
      since: since as string,
      until: until as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      cursor: cursor as string,
    };

    const result = transcriptService.getTranscript(id, query);
    res.json(result);
  } catch (error) {
    console.error("Error getting transcript:", error);
    res.status(500).json({
      error: "Failed to get transcript",
      code: "TRANSCRIPT_GET_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

// ============================================================================
// TOOL USES
// ============================================================================

/**
 * GET /api/observability/executions/:id/tool-uses
 * Get tool uses for an execution.
 */
router.get("/executions/:id/tool-uses", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      tools,
      categories,
      status,
      taskId,
      since,
      until,
      limit,
      includeInputs,
      includeOutputs,
    } = req.query;

    const query: ToolUseQuery = {
      tools: tools ? (tools as string).split(",") : undefined,
      categories: categories
        ? ((categories as string).split(",") as any)
        : undefined,
      status: status ? ((status as string).split(",") as any) : undefined,
      taskId: taskId as string,
      since: since as string,
      until: until as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      includeInputs: includeInputs === "true",
      includeOutputs: includeOutputs === "true",
    };

    const result = toolUseService.getToolUses(id, query);
    res.json(result);
  } catch (error) {
    console.error("Error getting tool uses:", error);
    res.status(500).json({
      error: "Failed to get tool uses",
      code: "TOOL_USES_GET_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

/**
 * GET /api/observability/executions/:id/tool-summary
 * Get aggregated tool usage for an execution.
 */
router.get("/executions/:id/tool-summary", (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const summary = toolUseService.getToolSummary(id);
    res.json(summary);
  } catch (error) {
    console.error("Error getting tool summary:", error);
    res.status(500).json({
      error: "Failed to get tool summary",
      code: "TOOL_SUMMARY_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

// ============================================================================
// ASSERTIONS
// ============================================================================

/**
 * GET /api/observability/executions/:id/assertions
 * Get assertions for an execution.
 */
router.get("/executions/:id/assertions", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categories, result, taskId, chainId, since, limit } = req.query;

    const query: AssertionQuery = {
      categories: categories
        ? ((categories as string).split(",") as any)
        : undefined,
      result: result ? ((result as string).split(",") as any) : undefined,
      taskId: taskId as string,
      chainId: chainId as string,
      since: since as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    const results = assertionService.getAssertions(id, query);
    res.json(results);
  } catch (error) {
    console.error("Error getting assertions:", error);
    res.status(500).json({
      error: "Failed to get assertions",
      code: "ASSERTIONS_GET_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

/**
 * GET /api/observability/executions/:id/assertion-summary
 * Get assertion statistics for an execution.
 */
router.get(
  "/executions/:id/assertion-summary",
  (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const summary = assertionService.getAssertionSummary(id);
      res.json(summary);
    } catch (error) {
      console.error("Error getting assertion summary:", error);
      res.status(500).json({
        error: "Failed to get assertion summary",
        code: "ASSERTION_SUMMARY_ERROR",
        details: { message: (error as Error).message },
      });
    }
  },
);

// ============================================================================
// SKILLS
// ============================================================================

/**
 * GET /api/observability/executions/:id/skills
 * Get skill traces for an execution.
 */
router.get("/executions/:id/skills", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { taskId, limit } = req.query;

    const result = skillService.getSkillTraces(id, {
      taskId: taskId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(result);
  } catch (error) {
    console.error("Error getting skills:", error);
    res.status(500).json({
      error: "Failed to get skills",
      code: "SKILLS_GET_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

// ============================================================================
// CROSS-REFERENCES
// ============================================================================

/**
 * GET /api/observability/cross-refs/:entityType/:entityId
 * Get cross-references for an entity.
 */
router.get(
  "/cross-refs/:entityType/:entityId",
  (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      const validTypes: CrossRefEntityType[] = [
        "toolUse",
        "assertion",
        "skillTrace",
        "transcriptEntry",
      ];

      if (!validTypes.includes(entityType as CrossRefEntityType)) {
        return res.status(400).json({
          error: "Invalid entity type",
          code: "INVALID_ENTITY_TYPE",
          details: { entityType, validTypes },
        });
      }

      const refs = crossRefService.getCrossReferences(
        entityType as CrossRefEntityType,
        entityId,
      );

      if (!refs) {
        return res.status(404).json({
          error: "Entity not found",
          code: "ENTITY_NOT_FOUND",
          details: { entityType, entityId },
        });
      }

      res.json(refs);
    } catch (error) {
      console.error("Error getting cross-references:", error);
      res.status(500).json({
        error: "Failed to get cross-references",
        code: "CROSS_REFS_ERROR",
        details: { message: (error as Error).message },
      });
    }
  },
);

// ============================================================================
// MESSAGE BUS
// ============================================================================

/**
 * GET /api/logs/message-bus
 * Query message bus logs.
 */
router.get("/logs/message-bus", (req: Request, res: Response) => {
  try {
    const {
      since,
      until,
      eventTypes,
      sources,
      severity,
      correlationId,
      limit,
    } = req.query;

    const query: MessageBusQuery = {
      since: since as string,
      until: until as string,
      eventTypes: eventTypes ? (eventTypes as string).split(",") : undefined,
      sources: sources ? (sources as string).split(",") : undefined,
      severity: severity ? (severity as string).split(",") : undefined,
      correlationId: correlationId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    };

    const result = messageBusService.getLogs(query);
    res.json(result);
  } catch (error) {
    console.error("Error getting message bus logs:", error);
    res.status(500).json({
      error: "Failed to get message bus logs",
      code: "MESSAGE_BUS_ERROR",
      details: { message: (error as Error).message },
    });
  }
});

export default router;
```

#### Acceptance Criteria

- [ ] All endpoints return proper JSON responses
- [ ] Query parameters parsed correctly
- [ ] Error responses include code and details
- [ ] 404 returned for missing entities
- [ ] Pagination parameters work correctly

---

### OBS-309: Register Routes in API

**File:** `server/api.ts` (modification)

**Purpose:** Mount observability routes.

```typescript
// Add to server/api.ts

import observabilityRoutes from "./routes/observability";

// ... existing routes ...

// Mount observability routes
app.use("/api/observability", observabilityRoutes);

// Mount message bus route (at different path per spec)
app.use("/api", observabilityRoutes);
```

#### Acceptance Criteria

- [ ] Observability routes mounted at `/api/observability`
- [ ] Message bus route accessible at `/api/logs/message-bus`
- [ ] No conflicts with existing routes

---

## Phase 5 Test Validation Script

**File:** `tests/e2e/test-obs-phase5-api.py`

```python
#!/usr/bin/env python3
"""
Phase 5 API Routes Validation Tests

Validates that all observability API endpoints work correctly.
"""

import sys
import os
import requests
import sqlite3
import time
import json
from typing import Dict, Any

# Test configuration
API_BASE = os.environ.get('API_BASE', 'http://localhost:3001')
DB_PATH = 'database/ideas.db'
TEST_EXECUTION_ID = f'test-api-{int(time.time())}'


def setup_test_data():
    """Create test data for API tests."""
    print("\n" + "=" * 70)
    print("SETUP: Creating test data")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create test transcript entries
    entries = [
        (f'entry-{i}', TEST_EXECUTION_ID, f'task-{i % 3}', 'instance-1',
         ['phase_start', 'task_start', 'tool_use', 'assertion', 'phase_end'][i % 5],
         'lifecycle', f'Test entry {i}', '{}', i)
        for i in range(10)
    ]

    for entry in entries:
        cursor.execute("""
            INSERT INTO transcript_entries
            (id, execution_id, task_id, instance_id, entry_type, category, summary, details, sequence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, entry)

    # Create test tool uses
    tool_uses = [
        (f'tool-{i}', TEST_EXECUTION_ID, f'task-{i % 3}', f'entry-{i}',
         ['Read', 'Write', 'Bash'][i % 3],
         ['file_read', 'file_write', 'shell'][i % 3],
         '{}', f'Input summary {i}',
         ['done', 'error', 'blocked'][i % 3],
         '{}', f'Output summary {i}',
         i % 3 == 1, i % 3 == 2,
         'Error message' if i % 3 == 1 else None,
         'Block reason' if i % 3 == 2 else None,
         '2026-01-17T10:00:00Z', '2026-01-17T10:00:01Z', 1000)
        for i in range(9)
    ]

    for tu in tool_uses:
        cursor.execute("""
            INSERT INTO tool_uses
            (id, execution_id, task_id, transcript_entry_id, tool, tool_category,
             input, input_summary, result_status, output, output_summary,
             is_error, is_blocked, error_message, block_reason,
             start_time, end_time, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, tu)

    # Create test assertions
    assertions = [
        (f'assert-{i}', f'task-{i % 3}', TEST_EXECUTION_ID,
         ['file_created', 'typescript_compiles', 'tests_pass'][i % 3],
         f'Assertion {i}',
         ['pass', 'fail', 'skip'][i % 3],
         '{}', '2026-01-17T10:00:00Z', 500)
        for i in range(6)
    ]

    for a in assertions:
        cursor.execute("""
            INSERT INTO assertion_results
            (id, task_id, execution_id, category, description, result, evidence, timestamp, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, a)

    conn.commit()
    conn.close()

    print("✓ Test data created\n")


def cleanup_test_data():
    """Remove test data."""
    print("=" * 70)
    print("CLEANUP: Removing test data")
    print("=" * 70)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM assertion_results WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM tool_uses WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (TEST_EXECUTION_ID,))

    conn.commit()
    conn.close()

    print("✓ Test data cleaned up\n")


# ============================================================================
# API TESTS
# ============================================================================

def test_list_executions():
    """Test GET /api/observability/executions"""
    print("=" * 70)
    print("TEST 1: GET /api/observability/executions")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions')
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    data = response.json()
    assert 'data' in data, "Response should have 'data' field"
    assert 'total' in data, "Response should have 'total' field"
    assert 'hasMore' in data, "Response should have 'hasMore' field"

    # Find our test execution
    test_exec = next((e for e in data['data'] if e['id'] == TEST_EXECUTION_ID), None)
    assert test_exec is not None, f"Test execution {TEST_EXECUTION_ID} not found"

    print("✓ Execution list returned correctly")
    print("✓ Pagination fields present")
    print("✓ Test execution found in list")
    print("✓ TEST 1 PASSED\n")


def test_get_execution():
    """Test GET /api/observability/executions/:id"""
    print("=" * 70)
    print("TEST 2: GET /api/observability/executions/:id")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}')
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"

    execution = response.json()
    assert execution['id'] == TEST_EXECUTION_ID
    assert 'stats' in execution
    assert 'totalToolUses' in execution['stats']
    assert 'totalAssertions' in execution['stats']
    assert 'passRate' in execution['stats']

    # Test 404
    response = requests.get(f'{API_BASE}/api/observability/executions/nonexistent')
    assert response.status_code == 404, f"Expected 404, got {response.status_code}"

    print("✓ Execution details returned correctly")
    print("✓ Stats included in response")
    print("✓ 404 returned for missing execution")
    print("✓ TEST 2 PASSED\n")


def test_get_transcript():
    """Test GET /api/observability/executions/:id/transcript"""
    print("=" * 70)
    print("TEST 3: GET /api/observability/executions/:id/transcript")
    print("=" * 70)

    # Basic request
    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/transcript')
    assert response.status_code == 200

    data = response.json()
    assert len(data['data']) == 10, f"Expected 10 entries, got {len(data['data'])}"

    # Test filtering by entry type
    response = requests.get(
        f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/transcript',
        params={'entryTypes': 'phase_start,phase_end'}
    )
    data = response.json()
    for entry in data['data']:
        assert entry['entryType'] in ['phase_start', 'phase_end']

    # Test pagination
    response = requests.get(
        f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/transcript',
        params={'limit': 3}
    )
    data = response.json()
    assert len(data['data']) == 3
    assert data['hasMore'] == True

    print("✓ Transcript entries returned")
    print("✓ Entry type filtering works")
    print("✓ Pagination works")
    print("✓ TEST 3 PASSED\n")


def test_get_tool_uses():
    """Test GET /api/observability/executions/:id/tool-uses"""
    print("=" * 70)
    print("TEST 4: GET /api/observability/executions/:id/tool-uses")
    print("=" * 70)

    # Basic request
    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/tool-uses')
    assert response.status_code == 200

    data = response.json()
    assert len(data['data']) == 9

    # Test filtering by tool
    response = requests.get(
        f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/tool-uses',
        params={'tools': 'Read'}
    )
    data = response.json()
    for tu in data['data']:
        assert tu['tool'] == 'Read'

    # Test filtering by status
    response = requests.get(
        f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/tool-uses',
        params={'status': 'error'}
    )
    data = response.json()
    for tu in data['data']:
        assert tu['resultStatus'] == 'error'

    print("✓ Tool uses returned")
    print("✓ Tool filtering works")
    print("✓ Status filtering works")
    print("✓ TEST 4 PASSED\n")


def test_get_tool_summary():
    """Test GET /api/observability/executions/:id/tool-summary"""
    print("=" * 70)
    print("TEST 5: GET /api/observability/executions/:id/tool-summary")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/tool-summary')
    assert response.status_code == 200

    summary = response.json()
    assert summary['executionId'] == TEST_EXECUTION_ID
    assert summary['totalToolUses'] == 9
    assert 'byTool' in summary
    assert 'byCategory' in summary
    assert 'timeline' in summary
    assert 'errors' in summary
    assert 'blocked' in summary

    # Verify aggregations
    assert 'Read' in summary['byTool']
    assert summary['byTool']['Read']['count'] == 3

    print("✓ Tool summary returned")
    print("✓ byTool aggregation correct")
    print("✓ byCategory aggregation present")
    print("✓ Errors and blocked lists present")
    print("✓ TEST 5 PASSED\n")


def test_get_assertions():
    """Test GET /api/observability/executions/:id/assertions"""
    print("=" * 70)
    print("TEST 6: GET /api/observability/executions/:id/assertions")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/assertions')
    assert response.status_code == 200

    data = response.json()
    assert len(data['data']) == 6

    # Test filtering by result
    response = requests.get(
        f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/assertions',
        params={'result': 'fail'}
    )
    data = response.json()
    for a in data['data']:
        assert a['result'] == 'fail'

    print("✓ Assertions returned")
    print("✓ Result filtering works")
    print("✓ TEST 6 PASSED\n")


def test_get_assertion_summary():
    """Test GET /api/observability/executions/:id/assertion-summary"""
    print("=" * 70)
    print("TEST 7: GET /api/observability/executions/:id/assertion-summary")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions/{TEST_EXECUTION_ID}/assertion-summary')
    assert response.status_code == 200

    summary = response.json()
    assert summary['executionId'] == TEST_EXECUTION_ID
    assert 'summary' in summary
    assert summary['summary']['totalAssertions'] == 6
    assert summary['summary']['passed'] == 2
    assert summary['summary']['failed'] == 2
    assert 'byCategory' in summary
    assert 'recentFailures' in summary

    print("✓ Assertion summary returned")
    print("✓ Pass/fail counts correct")
    print("✓ byCategory aggregation present")
    print("✓ Recent failures list present")
    print("✓ TEST 7 PASSED\n")


def test_cross_references():
    """Test GET /api/observability/cross-refs/:entityType/:entityId"""
    print("=" * 70)
    print("TEST 8: GET /api/observability/cross-refs/:entityType/:entityId")
    print("=" * 70)

    # Test tool use cross-refs
    response = requests.get(f'{API_BASE}/api/observability/cross-refs/toolUse/tool-0')
    assert response.status_code == 200

    refs = response.json()
    assert refs['type'] == 'toolUse'
    assert 'refs' in refs
    assert 'transcriptEntry' in refs['refs']

    # Test 404 for missing entity
    response = requests.get(f'{API_BASE}/api/observability/cross-refs/toolUse/nonexistent')
    assert response.status_code == 404

    # Test 400 for invalid entity type
    response = requests.get(f'{API_BASE}/api/observability/cross-refs/invalid/id')
    assert response.status_code == 400

    print("✓ Cross-references returned for tool use")
    print("✓ 404 returned for missing entity")
    print("✓ 400 returned for invalid entity type")
    print("✓ TEST 8 PASSED\n")


def test_error_responses():
    """Test error response format"""
    print("=" * 70)
    print("TEST 9: Error Response Format")
    print("=" * 70)

    response = requests.get(f'{API_BASE}/api/observability/executions/nonexistent')
    assert response.status_code == 404

    error = response.json()
    assert 'error' in error
    assert 'code' in error
    assert error['code'] == 'EXECUTION_NOT_FOUND'

    print("✓ Error responses have correct structure")
    print("✓ Error codes included")
    print("✓ TEST 9 PASSED\n")


# ============================================================================
# Main
# ============================================================================

def main():
    print("\n" + "=" * 70)
    print("OBSERVABILITY PHASE 5 API TESTS")
    print("=" * 70)

    try:
        setup_test_data()

        test_list_executions()
        test_get_execution()
        test_get_transcript()
        test_get_tool_uses()
        test_get_tool_summary()
        test_get_assertions()
        test_get_assertion_summary()
        test_cross_references()
        test_error_responses()

        print("=" * 70)
        print("ALL PHASE 5 TESTS PASSED")
        print("=" * 70)

    except requests.exceptions.ConnectionError:
        print("\n" + "=" * 70)
        print("ERROR: Could not connect to API server")
        print(f"Make sure the server is running at {API_BASE}")
        print("=" * 70)
        sys.exit(1)

    except AssertionError as e:
        print("\n" + "=" * 70)
        print(f"PHASE 5 TEST FAILURE: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    except Exception as e:
        print("\n" + "=" * 70)
        print(f"PHASE 5 TEST ERROR: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        cleanup_test_data()


if __name__ == "__main__":
    main()
```

---

## Task Summary

| Task ID | Title                   | File                                                       | Priority | Dependencies     |
| ------- | ----------------------- | ---------------------------------------------------------- | -------- | ---------------- |
| OBS-300 | Execution Service       | `server/services/observability/execution-service.ts`       | P1       | OBS-001, OBS-200 |
| OBS-301 | Transcript Service      | `server/services/observability/transcript-service.ts`      | P1       | OBS-001, OBS-200 |
| OBS-302 | Tool Use Service        | `server/services/observability/tool-use-service.ts`        | P1       | OBS-001, OBS-201 |
| OBS-303 | Assertion Service       | `server/services/observability/assertion-service.ts`       | P1       | OBS-001, OBS-204 |
| OBS-304 | Skill Service           | `server/services/observability/skill-service.ts`           | P1       | OBS-001, OBS-203 |
| OBS-305 | Cross-Reference Service | `server/services/observability/cross-reference-service.ts` | P1       | OBS-001, OBS-208 |
| OBS-306 | Message Bus Service     | `server/services/observability/message-bus-service.ts`     | P1       | OBS-001, OBS-205 |
| OBS-307 | Service Index           | `server/services/observability/index.ts`                   | P1       | OBS-300-306      |
| OBS-308 | Observability Routes    | `server/routes/observability.ts`                           | P1       | OBS-307          |
| OBS-309 | Register Routes         | `server/api.ts` (modification)                             | P1       | OBS-308          |

### Test Validation Tasks

| Task ID     | Title                  | File                               | Priority | Dependencies       |
| ----------- | ---------------------- | ---------------------------------- | -------- | ------------------ |
| OBS-TEST-05 | Phase 5 API validation | `tests/e2e/test-obs-phase5-api.py` | P1       | OBS-300 to OBS-309 |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 5 IMPLEMENTATION SEQUENCE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PRE-REQUISITES                                                          │
│  ─────────────                                                          │
│  ✓ Database schema created (Phase 1)                                    │
│  ✓ TypeScript types defined (Phase 4)                                   │
│  ✓ Server running with Express                                          │
│                                                                          │
│  PHASE 5a: Services                                                      │
│  ─────────────────                                                      │
│  1. OBS-300: Create ExecutionService                                    │
│  2. OBS-301: Create TranscriptService                                   │
│  3. OBS-302: Create ToolUseService                                      │
│  4. OBS-303: Create AssertionService                                    │
│  5. OBS-304: Create SkillService                                        │
│  6. OBS-305: Create CrossReferenceService                               │
│  7. OBS-306: Create MessageBusService                                   │
│  8. OBS-307: Create service index                                       │
│                                                                          │
│  PHASE 5b: Routes                                                        │
│  ───────────────                                                        │
│  9. OBS-308: Create observability routes                                │
│  10. OBS-309: Register routes in api.ts                                 │
│                                                                          │
│  VALIDATION                                                              │
│  ──────────                                                             │
│  11. Start server: npm run dev                                          │
│  12. Run: python3 tests/e2e/test-obs-phase5-api.py                     │
│      └─ Verify: ALL PHASE 5 TESTS PASSED                                │
│                                                                          │
│  SUCCESS CRITERIA                                                        │
│  ────────────────                                                       │
│  ✓ All endpoints return 200 for valid requests                          │
│  ✓ All endpoints return proper error responses                          │
│  ✓ Filtering parameters work correctly                                  │
│  ✓ Pagination works for all list endpoints                              │
│  ✓ Aggregation summaries computed correctly                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Run Commands

```bash
# After implementing Phase 5 tasks

# Step 1: Start the server (in one terminal)
npm run dev

# Step 2: Run API tests (in another terminal)
python3 tests/e2e/test-obs-phase5-api.py
```

### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 5 API TESTS
======================================================================

======================================================================
SETUP: Creating test data
======================================================================
✓ Test data created

======================================================================
TEST 1: GET /api/observability/executions
======================================================================
✓ Execution list returned correctly
✓ Pagination fields present
✓ Test execution found in list
✓ TEST 1 PASSED

[... all 9 tests pass ...]

======================================================================
ALL PHASE 5 TESTS PASSED
======================================================================

======================================================================
CLEANUP: Removing test data
======================================================================
✓ Test data cleaned up
```

---

## Related Documents

| Document                                                           | Purpose                     |
| ------------------------------------------------------------------ | --------------------------- |
| [api/README.md](./api/README.md)                                   | API specification           |
| [appendices/TYPES.md](./appendices/TYPES.md)                       | TypeScript types            |
| [implementation-plan-phase-4.md](./implementation-plan-phase-4.md) | TypeScript types (Phase 4)  |
| [implementation-plan-phase-3.md](./implementation-plan-phase-3.md) | Agent integration (Phase 3) |

---

_Phase 5 Implementation Plan: API Routes_
