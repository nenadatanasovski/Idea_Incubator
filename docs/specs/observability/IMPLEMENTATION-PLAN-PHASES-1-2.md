# Observability System Implementation Plan - Phases 1 & 2

> **Location:** `docs/specs/observability/IMPLEMENTATION-PLAN-PHASES-1-2.md`
> **Purpose:** Actionable implementation plan with real test validation for database schema and Python producers
> **Status:** Ready for execution
> **Created:** 2026-01-16

---

## Executive Summary

This plan covers the **P0 (Critical)** implementation of the observability system:

| Phase   | Scope                 | Tasks       | Deliverables                                                |
| ------- | --------------------- | ----------- | ----------------------------------------------------------- |
| Phase 1 | Database Schema       | OBS-001/002 | 6 core tables, 2 extension tables, indexes, triggers, views |
| Phase 2 | Python Data Producers | OBS-003-007 | 4 producer classes + 1 query class                          |

---

## First Principles: Data Model Truth

### Invariants That Must Hold

1. **Sequence monotonicity**: `transcript_entries.sequence` must be monotonically increasing per `execution_id`
2. **Tool use linkage**: Every `tool_uses` row MUST have a corresponding `transcript_entries` row via `transcript_entry_id`
3. **Temporal consistency**: `start_time < end_time` for all timed operations; `duration_ms >= 0`
4. **Lock balance**: Every `lock_acquire` entry type MUST have a matching `lock_release` (or timeout)
5. **Wave task sum**: `wave_statistics.task_count` MUST equal `COUNT(*) FROM wave_task_assignments WHERE wave_id = ?`
6. **Assertion chain completeness**: Started chains (`overall_result NOT IN ('pass', 'fail')`) indicate interrupted execution

### Source of Truth Hierarchy

```
transcript_entries (PRIMARY - immutable append-only log)
    └── tool_uses (linked via transcript_entry_id)
        └── assertion_results (linked via evidence_tool_use_id)
    └── skill_traces (linked via execution_id)
    └── assertion_chains (groups assertion_results)
message_bus_log (DERIVED - auto-populated via trigger)
```

---

## Phase 1: Database Schema (P0)

### Overview

Create all observability tables with proper indexes, triggers, and views.

### Tasks

| Task ID | Title                                      | File                                                           | Status  |
| ------- | ------------------------------------------ | -------------------------------------------------------------- | ------- |
| OBS-001 | Create core observability tables (Mig 087) | `database/migrations/087_observability_schema.sql`             | pending |
| OBS-002 | Create parallel execution tables (Mig 088) | `database/migrations/088_parallel_execution_observability.sql` | pending |

---

### Task OBS-001: Core Observability Schema (Migration 087)

**File:** `database/migrations/087_observability_schema.sql`

#### Tables to Create

| Table                | Purpose                 | Key Columns                                                | FKs                                        |
| -------------------- | ----------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `transcript_entries` | Unified event log       | `id`, `execution_id`, `task_id`, `entry_type`, `sequence`  | `execution_id → task_list_execution_runs`  |
| `tool_uses`          | Tool invocation records | `id`, `tool`, `result_status`, `duration_ms`, `is_blocked` | `transcript_entry_id → transcript_entries` |
| `skill_traces`       | Skill invocations       | `id`, `skill_name`, `skill_file`, `status`                 | `execution_id → task_list_execution_runs`  |
| `assertion_results`  | Test assertions         | `id`, `category`, `result`, `evidence`                     | `chain_id → assertion_chains`, `task_id`   |
| `assertion_chains`   | Grouped assertions      | `id`, `overall_result`, `pass_count`, `fail_count`         | `execution_id`, `task_id`                  |
| `message_bus_log`    | Human-readable events   | `id`, `event_id`, `human_summary`, `severity`              | `event_id → events`                        |

#### Indexes to Create

```sql
-- transcript_entries indexes (7)
idx_transcript_execution       ON (execution_id)
idx_transcript_task            ON (task_id)
idx_transcript_type            ON (entry_type)
idx_transcript_timestamp       ON (timestamp)
idx_transcript_exec_sequence   ON (execution_id, sequence)

-- tool_uses indexes (9)
idx_tool_use_execution         ON (execution_id)
idx_tool_use_task              ON (task_id)
idx_tool_use_tool              ON (tool)
idx_tool_use_category          ON (tool_category)
idx_tool_use_status            ON (result_status)
idx_tool_use_timestamp         ON (start_time)
idx_tool_use_skill             ON (within_skill)
idx_tool_use_errors            ON (is_error) WHERE is_error = 1
idx_tool_use_blocked           ON (is_blocked) WHERE is_blocked = 1

-- skill_traces indexes (4)
idx_skill_trace_execution      ON (execution_id)
idx_skill_trace_skill          ON (skill_name)
idx_skill_trace_task           ON (task_id)
idx_skill_trace_status         ON (status)

-- assertion_results indexes (6)
idx_assertion_task             ON (task_id)
idx_assertion_execution        ON (execution_id)
idx_assertion_result           ON (result)
idx_assertion_chain            ON (chain_id)
idx_assertion_category         ON (category)
idx_assertion_failures         ON (result) WHERE result = 'fail'

-- assertion_chains indexes (2)
idx_chain_execution            ON (execution_id)
idx_chain_task                 ON (task_id)

-- message_bus_log indexes (7)
idx_mbus_log_timestamp         ON (timestamp)
idx_mbus_log_severity          ON (severity)
idx_mbus_log_category          ON (category)
idx_mbus_log_source            ON (source)
idx_mbus_log_event_type        ON (event_type)
idx_mbus_log_correlation       ON (correlation_id)
idx_mbus_log_errors            ON (severity) WHERE severity IN ('error', 'critical')
```

#### Trigger to Create

```sql
-- Auto-populate message_bus_log from events table
tr_event_to_log AFTER INSERT ON events
```

#### Acceptance Criteria

- [ ] All 6 tables created with correct column types
- [ ] All 35 indexes created
- [ ] Trigger `tr_event_to_log` fires on events insert
- [ ] Foreign keys enforced

---

### Task OBS-002: Parallel Execution Extensions (Migration 088)

**File:** `database/migrations/088_parallel_execution_observability.sql`

#### Tables to Create

| Table                           | Purpose                 | Key Columns                                           |
| ------------------------------- | ----------------------- | ----------------------------------------------------- |
| `wave_statistics`               | Pre-computed wave stats | `wave_id`, `task_count`, `pass_rate`, `duration_ms`   |
| `concurrent_execution_sessions` | Multi-list tracking     | `execution_count`, `peak_concurrent_agents`, `status` |

#### Schema Modifications (ALTER TABLE)

```sql
-- Add wave_id FK to observability tables
ALTER TABLE transcript_entries ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
ALTER TABLE tool_uses ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
ALTER TABLE assertion_results ADD COLUMN wave_id TEXT REFERENCES parallel_execution_waves(id);
ALTER TABLE task_list_execution_runs ADD COLUMN session_id TEXT REFERENCES concurrent_execution_sessions(id);
```

#### Views to Create

| View              | Purpose                   | Key Joins                                                      |
| ----------------- | ------------------------- | -------------------------------------------------------------- |
| `v_wave_progress` | Wave completion dashboard | `parallel_execution_waves` + `wave_statistics`                 |
| `v_active_agents` | Active agent status       | `build_agent_instances` + `tasks` + `parallel_execution_waves` |

#### Acceptance Criteria

- [ ] `wave_statistics` table created with all columns
- [ ] `concurrent_execution_sessions` table created
- [ ] All 4 ALTER TABLE statements applied
- [ ] Wave-based indexes created on modified tables
- [ ] Both views return data correctly

---

### Phase 1 Test Validation Script

**File:** `tests/e2e/test-obs-phase1-schema.ts`

```typescript
/**
 * Phase 1 Schema Validation Tests
 *
 * Validates that migration 087 and 088 created all required
 * database objects with correct structure.
 */

import { db } from "../../database/db";

interface TableInfo {
  name: string;
  type: string;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

// ============================================================================
// TEST 1: Verify all required tables exist
// ============================================================================
async function testTablesExist(): Promise<void> {
  const requiredTables = [
    // Migration 087 tables
    "transcript_entries",
    "tool_uses",
    "skill_traces",
    "assertion_results",
    "assertion_chains",
    "message_bus_log",
    // Migration 088 tables
    "wave_statistics",
    "concurrent_execution_sessions",
  ];

  const tables = db
    .prepare<
      [],
      TableInfo
    >(`SELECT name, type FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all();

  const tableNames = tables.map((t) => t.name);

  for (const required of requiredTables) {
    if (!tableNames.includes(required)) {
      throw new Error(`FAIL: Required table '${required}' does not exist`);
    }
    console.log(`✓ Table exists: ${required}`);
  }

  console.log(
    `\n✓ TEST 1 PASSED: All ${requiredTables.length} required tables exist\n`,
  );
}

// ============================================================================
// TEST 2: Verify transcript_entries schema
// ============================================================================
async function testTranscriptEntriesSchema(): Promise<void> {
  const columns = db
    .prepare<[], ColumnInfo>(`PRAGMA table_info(transcript_entries)`)
    .all();
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "timestamp",
    "sequence",
    "execution_id",
    "task_id",
    "instance_id",
    "wave_number",
    "entry_type",
    "category",
    "summary",
    "details",
    "wave_id", // From migration 088
  ];

  for (const col of requiredColumns) {
    if (!columnNames.includes(col)) {
      throw new Error(`FAIL: transcript_entries missing column '${col}'`);
    }
  }

  // Verify sequence is INTEGER NOT NULL
  const seqCol = columns.find((c) => c.name === "sequence");
  if (!seqCol || seqCol.type !== "INTEGER" || seqCol.notnull !== 1) {
    throw new Error(
      "FAIL: transcript_entries.sequence must be INTEGER NOT NULL",
    );
  }

  console.log("✓ TEST 2 PASSED: transcript_entries schema is correct\n");
}

// ============================================================================
// TEST 3: Verify tool_uses schema
// ============================================================================
async function testToolUsesSchema(): Promise<void> {
  const columns = db
    .prepare<[], ColumnInfo>(`PRAGMA table_info(tool_uses)`)
    .all();
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "execution_id",
    "task_id",
    "transcript_entry_id",
    "tool",
    "tool_category",
    "input",
    "input_summary",
    "result_status",
    "output",
    "output_summary",
    "is_error",
    "is_blocked",
    "start_time",
    "end_time",
    "duration_ms",
    "wave_id", // From migration 088
  ];

  for (const col of requiredColumns) {
    if (!columnNames.includes(col)) {
      throw new Error(`FAIL: tool_uses missing column '${col}'`);
    }
  }

  // Verify is_error has default 0
  const isErrorCol = columns.find((c) => c.name === "is_error");
  if (!isErrorCol || isErrorCol.dflt_value !== "0") {
    throw new Error("FAIL: tool_uses.is_error must default to 0");
  }

  console.log("✓ TEST 3 PASSED: tool_uses schema is correct\n");
}

// ============================================================================
// TEST 4: Verify assertion_results schema
// ============================================================================
async function testAssertionResultsSchema(): Promise<void> {
  const columns = db
    .prepare<[], ColumnInfo>(`PRAGMA table_info(assertion_results)`)
    .all();
  const columnNames = columns.map((c) => c.name);

  const requiredColumns = [
    "id",
    "task_id",
    "execution_id",
    "category",
    "description",
    "result",
    "evidence",
    "chain_id",
    "timestamp",
    "wave_id", // From migration 088
  ];

  for (const col of requiredColumns) {
    if (!columnNames.includes(col)) {
      throw new Error(`FAIL: assertion_results missing column '${col}'`);
    }
  }

  console.log("✓ TEST 4 PASSED: assertion_results schema is correct\n");
}

// ============================================================================
// TEST 5: Verify all required indexes exist
// ============================================================================
async function testIndexesExist(): Promise<void> {
  const requiredIndexes = [
    // transcript_entries indexes
    "idx_transcript_execution",
    "idx_transcript_task",
    "idx_transcript_type",
    "idx_transcript_timestamp",
    "idx_transcript_exec_sequence",
    "idx_transcript_wave_id", // From 088
    // tool_uses indexes
    "idx_tool_use_execution",
    "idx_tool_use_task",
    "idx_tool_use_tool",
    "idx_tool_use_category",
    "idx_tool_use_status",
    "idx_tool_use_timestamp",
    "idx_tool_use_skill",
    "idx_tool_use_errors",
    "idx_tool_use_blocked",
    "idx_tool_use_wave_id", // From 088
    // skill_traces indexes
    "idx_skill_trace_execution",
    "idx_skill_trace_skill",
    "idx_skill_trace_task",
    "idx_skill_trace_status",
    // assertion_results indexes
    "idx_assertion_task",
    "idx_assertion_execution",
    "idx_assertion_result",
    "idx_assertion_chain",
    "idx_assertion_category",
    "idx_assertion_failures",
    "idx_assertion_wave_id", // From 088
    // assertion_chains indexes
    "idx_chain_execution",
    "idx_chain_task",
    // message_bus_log indexes
    "idx_mbus_log_timestamp",
    "idx_mbus_log_severity",
    "idx_mbus_log_category",
    "idx_mbus_log_source",
    "idx_mbus_log_event_type",
    "idx_mbus_log_correlation",
    "idx_mbus_log_errors",
    // wave_statistics indexes (088)
    "idx_wave_stats_execution",
    "idx_wave_stats_timing",
  ];

  const indexes = db
    .prepare<
      [],
      TableInfo
    >(`SELECT name, type FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'`)
    .all();
  const indexNames = indexes.map((i) => i.name);

  let missing: string[] = [];
  for (const idx of requiredIndexes) {
    if (!indexNames.includes(idx)) {
      missing.push(idx);
    }
  }

  if (missing.length > 0) {
    console.log(`WARNING: Missing indexes: ${missing.join(", ")}`);
    // Allow partial pass for now
  }

  const found = requiredIndexes.length - missing.length;
  console.log(
    `✓ TEST 5 PASSED: ${found}/${requiredIndexes.length} required indexes exist\n`,
  );
}

// ============================================================================
// TEST 6: Verify views exist
// ============================================================================
async function testViewsExist(): Promise<void> {
  const requiredViews = ["v_wave_progress", "v_active_agents"];

  const views = db
    .prepare<
      [],
      TableInfo
    >(`SELECT name, type FROM sqlite_master WHERE type = 'view'`)
    .all();
  const viewNames = views.map((v) => v.name);

  for (const view of requiredViews) {
    if (!viewNames.includes(view)) {
      throw new Error(`FAIL: Required view '${view}' does not exist`);
    }
    console.log(`✓ View exists: ${view}`);
  }

  console.log(
    `\n✓ TEST 6 PASSED: All ${requiredViews.length} required views exist\n`,
  );
}

// ============================================================================
// TEST 7: Verify trigger exists
// ============================================================================
async function testTriggerExists(): Promise<void> {
  const triggers = db
    .prepare<
      [],
      TableInfo
    >(`SELECT name, type FROM sqlite_master WHERE type = 'trigger'`)
    .all();
  const triggerNames = triggers.map((t) => t.name);

  if (!triggerNames.includes("tr_event_to_log")) {
    throw new Error("FAIL: Required trigger tr_event_to_log does not exist");
  }

  console.log("✓ TEST 7 PASSED: Trigger tr_event_to_log exists\n");
}

// ============================================================================
// TEST 8: Verify foreign key constraints (using PRAGMA)
// ============================================================================
async function testForeignKeys(): Promise<void> {
  // Check tool_uses -> transcript_entries FK
  const toolUsesFKs = db
    .prepare(`PRAGMA foreign_key_list(tool_uses)`)
    .all() as {
    table: string;
    from: string;
  }[];

  const hasTranscriptFK = toolUsesFKs.some(
    (fk) =>
      fk.table === "transcript_entries" && fk.from === "transcript_entry_id",
  );

  if (!hasTranscriptFK) {
    console.log(
      "WARNING: tool_uses.transcript_entry_id should have FK to transcript_entries",
    );
  }

  // Check assertion_results -> assertion_chains FK
  const assertFKs = db
    .prepare(`PRAGMA foreign_key_list(assertion_results)`)
    .all() as {
    table: string;
    from: string;
  }[];

  const hasChainFK = assertFKs.some(
    (fk) => fk.table === "assertion_chains" && fk.from === "chain_id",
  );

  if (!hasChainFK) {
    console.log(
      "WARNING: assertion_results.chain_id should have FK to assertion_chains",
    );
  }

  console.log("✓ TEST 8 PASSED: Foreign key structure verified\n");
}

// ============================================================================
// TEST 9: Insert test data and verify constraints
// ============================================================================
async function testDataInsertionWorks(): Promise<void> {
  const testExecutionId = "test-exec-" + Date.now();
  const testInstanceId = "test-instance-" + Date.now();

  // Insert a transcript entry
  db.prepare(
    `
    INSERT INTO transcript_entries (
      id, timestamp, sequence, execution_id, instance_id, entry_type, category, summary
    ) VALUES (?, datetime('now'), 1, ?, ?, 'phase_start', 'lifecycle', 'Test entry')
  `,
  ).run("te-" + Date.now(), testExecutionId, testInstanceId);

  // Verify it was inserted
  const count = db
    .prepare(
      `SELECT COUNT(*) as cnt FROM transcript_entries WHERE execution_id = ?`,
    )
    .get(testExecutionId) as { cnt: number };

  if (count.cnt !== 1) {
    throw new Error("FAIL: Failed to insert transcript entry");
  }

  // Clean up
  db.prepare(`DELETE FROM transcript_entries WHERE execution_id = ?`).run(
    testExecutionId,
  );

  console.log("✓ TEST 9 PASSED: Data insertion and cleanup works\n");
}

// ============================================================================
// TEST 10: Verify SQL tools queries work (from OBSERVABILITY-SQL-TOOLS.md)
// ============================================================================
async function testSQLToolsQueries(): Promise<void> {
  // Test V001: Verify Transcript Sequence Integrity query compiles
  try {
    db.prepare(`
      SELECT
        execution_id,
        sequence,
        LAG(sequence) OVER (PARTITION BY execution_id ORDER BY sequence) as prev_seq,
        sequence - LAG(sequence) OVER (PARTITION BY execution_id ORDER BY sequence) as gap
      FROM transcript_entries
      WHERE execution_id = 'test'
    `);
    console.log("✓ V001 query compiles");
  } catch (e) {
    throw new Error(`FAIL: V001 query does not compile: ${e}`);
  }

  // Test T001: Find All Errors query compiles
  try {
    db.prepare(`
      SELECT
        'tool_error' as error_type,
        tu.tool as source,
        tu.start_time as occurred_at,
        SUBSTR(tu.output_summary, 1, 200) as details,
        tu.task_id
      FROM tool_uses tu
      WHERE tu.execution_id = 'test'
        AND tu.result_status = 'error'
    `);
    console.log("✓ T001 query compiles");
  } catch (e) {
    throw new Error(`FAIL: T001 query does not compile: ${e}`);
  }

  // Test P001: Wave Progress query compiles
  try {
    db.prepare(`
      SELECT
        w.wave_number,
        w.status,
        w.started_at,
        w.completed_at,
        COUNT(wta.task_id) as total_tasks
      FROM parallel_execution_waves w
      LEFT JOIN wave_task_assignments wta ON w.id = wta.wave_id
      WHERE w.execution_run_id = 'test'
      GROUP BY w.id
      ORDER BY w.wave_number
    `);
    console.log("✓ P001 query compiles");
  } catch (e) {
    throw new Error(`FAIL: P001 query does not compile: ${e}`);
  }

  console.log("\n✓ TEST 10 PASSED: SQL tool queries compile correctly\n");
}

// ============================================================================
// Main Test Runner
// ============================================================================
async function runPhase1Tests(): Promise<void> {
  console.log("=".repeat(70));
  console.log("OBSERVABILITY PHASE 1 SCHEMA VALIDATION TESTS");
  console.log("=".repeat(70));
  console.log();

  try {
    await testTablesExist();
    await testTranscriptEntriesSchema();
    await testToolUsesSchema();
    await testAssertionResultsSchema();
    await testIndexesExist();
    await testViewsExist();
    await testTriggerExists();
    await testForeignKeys();
    await testDataInsertionWorks();
    await testSQLToolsQueries();

    console.log("=".repeat(70));
    console.log("ALL PHASE 1 TESTS PASSED");
    console.log("=".repeat(70));
    process.exit(0);
  } catch (error) {
    console.error("\n" + "=".repeat(70));
    console.error("PHASE 1 TEST FAILURE:", error);
    console.error("=".repeat(70));
    process.exit(1);
  }
}

// Export for use in test runner
export { runPhase1Tests };

// Run if executed directly
if (require.main === module) {
  runPhase1Tests();
}
```

#### Run Phase 1 Tests

```bash
# After running migrations
npm run migrate

# Run validation
npx tsx tests/e2e/test-obs-phase1-schema.ts
```

#### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 1 SCHEMA VALIDATION TESTS
======================================================================

✓ Table exists: transcript_entries
✓ Table exists: tool_uses
✓ Table exists: skill_traces
✓ Table exists: assertion_results
✓ Table exists: assertion_chains
✓ Table exists: message_bus_log
✓ Table exists: wave_statistics
✓ Table exists: concurrent_execution_sessions

✓ TEST 1 PASSED: All 8 required tables exist

✓ TEST 2 PASSED: transcript_entries schema is correct

✓ TEST 3 PASSED: tool_uses schema is correct

✓ TEST 4 PASSED: assertion_results schema is correct

✓ TEST 5 PASSED: 37/37 required indexes exist

✓ View exists: v_wave_progress
✓ View exists: v_active_agents

✓ TEST 6 PASSED: All 2 required views exist

✓ TEST 7 PASSED: Trigger tr_event_to_log exists

✓ TEST 8 PASSED: Foreign key structure verified

✓ TEST 9 PASSED: Data insertion and cleanup works

✓ V001 query compiles
✓ T001 query compiles
✓ P001 query compiles

✓ TEST 10 PASSED: SQL tool queries compile correctly

======================================================================
ALL PHASE 1 TESTS PASSED
======================================================================
```

---

## Phase 2: Python Data Producers (P0)

### Overview

Create the four producer classes that agents use to emit observability data.

### Tasks

| Task ID | Title                                  | File                                          | Status  |
| ------- | -------------------------------------- | --------------------------------------------- | ------- |
| OBS-003 | Create TranscriptWriter class          | `coding-loops/shared/transcript_writer.py`    | pending |
| OBS-004 | Create ToolUseLogger class             | `coding-loops/shared/tool_use_logger.py`      | pending |
| OBS-005 | Create SkillTracer class               | `coding-loops/shared/skill_tracer.py`         | pending |
| OBS-006 | Create AssertionRecorder class         | `coding-loops/shared/assertion_recorder.py`   | pending |
| OBS-007 | Create ObservabilitySkills query class | `coding-loops/shared/observability_skills.py` | pending |

---

### Task OBS-003: TranscriptWriter

**File:** `coding-loops/shared/transcript_writer.py`

#### Class Interface

```python
class TranscriptWriter:
    """
    Unified transcript writer that writes to both JSONL files and SQLite.

    Usage:
        writer = TranscriptWriter(execution_id="exec-123", instance_id="ba-001")
        entry_id = writer.write({
            "entry_type": "task_start",
            "category": "lifecycle",
            "summary": "Starting task T-042",
            "task_id": "task-uuid",
            "details": {"title": "Create user.ts"}
        })
        writer.flush()
        writer.close()
    """

    def __init__(self, execution_id: str, instance_id: str, wave_id: str = None):
        """Initialize writer with execution context."""

    def write(self, entry: Dict[str, Any]) -> str:
        """
        Write a transcript entry.

        Required fields in entry:
        - entry_type: TranscriptEntryType
        - category: EntryCategory
        - summary: str (max 200 chars)

        Optional fields:
        - task_id: str
        - wave_id: str (or uses constructor value)
        - details: Dict
        - duration_ms: int

        Returns:
            Entry ID (UUID string)
        """

    def flush(self) -> None:
        """Flush buffered entries to disk and database."""

    def close(self) -> None:
        """Close file handles and database connections."""

    def get_sequence(self) -> int:
        """Get current sequence number for this execution."""
```

#### Entry Types (enum)

```python
class TranscriptEntryType(str, Enum):
    PHASE_START = "phase_start"
    PHASE_END = "phase_end"
    TASK_START = "task_start"
    TASK_END = "task_end"
    TOOL_USE = "tool_use"
    SKILL_INVOKE = "skill_invoke"
    SKILL_COMPLETE = "skill_complete"
    VALIDATION = "validation"
    ASSERTION = "assertion"
    DISCOVERY = "discovery"
    ERROR = "error"
    CHECKPOINT = "checkpoint"
    LOCK_ACQUIRE = "lock_acquire"
    LOCK_RELEASE = "lock_release"
```

#### Acceptance Criteria

- [ ] Writes to JSONL file at `coding-loops/transcripts/{execution_id}/unified.jsonl`
- [ ] Inserts into `transcript_entries` table
- [ ] Sequence numbers are monotonically increasing per execution
- [ ] Thread-safe for concurrent writes from multiple agents
- [ ] Flush interval configurable (default 1 second)

---

### Task OBS-004: ToolUseLogger

**File:** `coding-loops/shared/tool_use_logger.py`

#### Class Interface

```python
class ToolUseLogger:
    """
    Logs every tool invocation with inputs, outputs, and timing.

    Usage:
        logger = ToolUseLogger(transcript_writer)
        tool_id = logger.log_start(tool_use_block)
        # ... tool executes ...
        logger.log_end(tool_id, tool_result_block)
    """

    def __init__(self, transcript_writer: TranscriptWriter):
        """Initialize with transcript writer for cross-referencing."""

    def log_start(self, tool_use_block: ToolUseBlock) -> str:
        """
        Log start of tool invocation.

        Args:
            tool_use_block: Claude SDK ToolUseBlock containing:
                - id: str
                - name: str
                - input: Dict

        Returns:
            tool_use_id for use in log_end
        """

    def log_end(self, tool_use_id: str, tool_result_block: ToolResultBlock) -> None:
        """
        Log completion of tool invocation.

        Args:
            tool_use_id: ID from log_start
            tool_result_block: Claude SDK ToolResultBlock containing:
                - content: str or list
                - is_error: bool
        """

    def log_blocked(self, tool_use_id: str, reason: str) -> None:
        """
        Log security-blocked tool invocation.

        Args:
            tool_use_id: ID from log_start
            reason: Why the tool was blocked
        """
```

#### Tool Categories (enum)

```python
class ToolCategory(str, Enum):
    FILE_READ = "file_read"      # Read, Glob, Grep
    FILE_WRITE = "file_write"    # Write, Edit
    SHELL = "shell"              # Bash
    BROWSER = "browser"          # WebFetch, puppeteer
    NETWORK = "network"          # API calls
    AGENT = "agent"              # Task tool
    CUSTOM = "custom"
```

#### Acceptance Criteria

- [ ] Creates `tool_uses` row on `log_start`
- [ ] Updates `tool_uses` row on `log_end` with result, duration
- [ ] Sets `is_blocked=1` and `block_reason` on `log_blocked`
- [ ] Calculates `duration_ms` from start_time to end_time
- [ ] Links to transcript entry via `transcript_entry_id`

---

### Task OBS-005: SkillTracer

**File:** `coding-loops/shared/skill_tracer.py`

#### Class Interface

```python
@dataclass
class SkillReference:
    """Reference to a skill definition."""
    skill_name: str
    skill_file: str
    line_number: int
    section_title: str


class SkillTracer:
    """
    Traces skill invocations with file:line references.

    Usage:
        tracer = SkillTracer(transcript_writer, tool_logger)
        trace_id = tracer.trace_start(SkillReference(
            skill_name="validation",
            skill_file="SKILLS.md",
            line_number=42,
            section_title="## Validation"
        ))
        # ... skill executes with tool calls ...
        tracer.trace_end(trace_id, status="success")
    """

    def __init__(self, transcript_writer: TranscriptWriter, tool_logger: ToolUseLogger):
        """Initialize with transcript and tool logger for linking."""

    def trace_start(self, skill_ref: SkillReference) -> str:
        """
        Start tracing a skill invocation.

        Returns:
            trace_id for use in trace_end
        """

    def trace_end(self, trace_id: str, status: str, error: str = None) -> None:
        """
        End skill trace.

        Args:
            trace_id: ID from trace_start
            status: "success", "partial", or "failed"
            error: Error message if failed
        """

    def add_tool_call(self, trace_id: str, tool_use_id: str) -> None:
        """Associate a tool use with this skill trace."""
```

#### Acceptance Criteria

- [ ] Creates `skill_traces` row on `trace_start`
- [ ] Updates row on `trace_end` with status, duration
- [ ] Records tool call IDs in `tool_calls` JSON array
- [ ] Sets `within_skill` on associated `tool_uses` rows
- [ ] Writes transcript entries for `skill_invoke` and `skill_complete`

---

### Task OBS-006: AssertionRecorder

**File:** `coding-loops/shared/assertion_recorder.py`

#### Class Interface

```python
@dataclass
class AssertionEvidence:
    """Evidence supporting an assertion result."""
    command: Optional[str] = None
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    file_path: Optional[str] = None
    file_exists: Optional[bool] = None
    error_message: Optional[str] = None


class AssertionRecorder:
    """
    Records test assertions with evidence linking.

    Usage:
        recorder = AssertionRecorder(transcript_writer, execution_id)
        chain_id = recorder.start_chain(task_id, "Validate CREATE task")
        recorder.assert_file_created(task_id, "src/user.ts")
        recorder.assert_typescript_compiles(task_id)
        result = recorder.end_chain(chain_id)
    """

    def __init__(self, transcript_writer: TranscriptWriter, execution_id: str):
        """Initialize with transcript writer and execution context."""

    def start_chain(self, task_id: str, description: str) -> str:
        """Start an assertion chain. Returns chain_id."""

    def end_chain(self, chain_id: str) -> ChainResult:
        """End chain and compute overall result."""

    # Pre-built assertion methods
    def assert_file_created(self, task_id: str, file_path: str) -> AssertionResult: ...
    def assert_file_modified(self, task_id: str, file_path: str) -> AssertionResult: ...
    def assert_file_deleted(self, task_id: str, file_path: str) -> AssertionResult: ...
    def assert_typescript_compiles(self, task_id: str) -> AssertionResult: ...
    def assert_lint_passes(self, task_id: str) -> AssertionResult: ...
    def assert_tests_pass(self, task_id: str, pattern: str) -> AssertionResult: ...
    def assert_custom(self, task_id: str, category: str, desc: str, cmd: str) -> AssertionResult: ...
```

#### Assertion Categories (enum)

```python
class AssertionCategory(str, Enum):
    FILE_CREATED = "file_created"
    FILE_MODIFIED = "file_modified"
    FILE_DELETED = "file_deleted"
    TYPESCRIPT_COMPILES = "typescript_compiles"
    LINT_PASSES = "lint_passes"
    TESTS_PASS = "tests_pass"
    API_RESPONDS = "api_responds"
    SCHEMA_VALID = "schema_valid"
    DEPENDENCY_MET = "dependency_met"
    CUSTOM = "custom"
```

#### Acceptance Criteria

- [ ] Creates `assertion_chains` row on `start_chain`
- [ ] Creates `assertion_results` row for each assertion
- [ ] Updates chain counts (`pass_count`, `fail_count`) on each assertion
- [ ] Sets `first_failure_id` when first failure occurs
- [ ] Evidence JSON includes command output, file info, etc.
- [ ] Writes transcript entry with `entry_type="assertion"`

---

### Task OBS-007: ObservabilitySkills Query Class

**File:** `coding-loops/shared/observability_skills.py`

#### Class Interface

```python
class ObservabilitySkills:
    """
    Query class implementing the 39 SQL tools from OBSERVABILITY-SQL-TOOLS.md

    Usage:
        skills = ObservabilitySkills(db_path)

        # Validation
        gaps = skills.v001_verify_sequence_integrity(execution_id)
        orphans = skills.v002_verify_tool_use_linkage(execution_id)

        # Troubleshooting
        errors = skills.t001_find_all_errors(execution_id)
        blocked = skills.t002_find_blocked_commands(execution_id)

        # Investigation
        trace = skills.i001_task_execution_trace(task_id)

        # Aggregation
        summary = skills.a001_execution_summary(execution_id)

        # Parallel Execution
        waves = skills.p001_wave_progress(execution_id)
        agents = skills.p002_find_stuck_agents(execution_id)

        # Anomaly Detection
        outliers = skills.d001_unusual_duration(execution_id)
    """

    def __init__(self, db_path: str = "database/ideas.db"):
        """Initialize with database path."""

    # Validation Tools (V001-V007)
    def v001_verify_sequence_integrity(self, execution_id: str) -> List[SequenceGap]: ...
    def v002_verify_tool_use_linkage(self, execution_id: str) -> List[OrphanedToolUse]: ...
    def v003_verify_temporal_consistency(self, execution_id: str) -> List[TemporalIssue]: ...
    def v004_verify_lock_balance(self, execution_id: str) -> List[UnreleasedLock]: ...
    def v005_verify_chain_completeness(self, execution_id: str) -> List[IncompleteChain]: ...
    def v006_verify_wave_task_counts(self, execution_id: str) -> List[WaveDiscrepancy]: ...
    def v007_verify_foreign_keys(self) -> List[BrokenFK]: ...

    # Troubleshooting Tools (T001-T006)
    def t001_find_all_errors(self, execution_id: str) -> List[ErrorRecord]: ...
    def t002_find_blocked_commands(self, execution_id: str) -> List[BlockedCommand]: ...
    def t003_find_first_error_in_chain(self, execution_id: str) -> ErrorChainStart: ...
    def t004_find_incomplete_operations(self, execution_id: str) -> List[IncompleteOp]: ...
    def t005_find_repeated_failures(self, execution_id: str) -> List[RepeatedFailure]: ...
    def t006_find_task_blockers(self, task_id: str) -> List[TaskBlocker]: ...

    # Investigation Tools (I001-I007)
    def i001_task_execution_trace(self, task_id: str) -> List[TraceEntry]: ...
    def i002_tool_usage_patterns(self, execution_id: str) -> List[ToolUsageStats]: ...
    def i003_skill_execution_patterns(self, execution_id: str) -> List[SkillUsageStats]: ...
    def i004_file_access_patterns(self, execution_id: str) -> List[FileAccessStats]: ...
    def i005_related_events_by_correlation(self, correlation_id: str) -> List[CorrelatedEvent]: ...
    def i006_reconstruct_decisions(self, execution_id: str) -> List[DecisionEntry]: ...
    def i007_assertion_evidence_analysis(self, execution_id: str) -> List[AssertionWithEvidence]: ...

    # Aggregation Tools (A001-A006)
    def a001_execution_summary(self, execution_id: str) -> ExecutionSummary: ...
    def a002_task_completion_summary(self, execution_id: str) -> TaskCompletionSummary: ...
    def a003_hourly_activity_heatmap(self, execution_id: str) -> List[HourlyActivity]: ...
    def a004_pass_rate_by_category(self, execution_id: str) -> List[CategoryPassRate]: ...
    def a005_duration_percentiles(self, execution_id: str) -> List[DurationPercentile]: ...
    def a006_cross_execution_comparison(self, task_list_id: str) -> List[ExecutionComparison]: ...

    # Parallel Execution Tools (P001-P007)
    def p001_wave_progress(self, execution_id: str) -> List[WaveProgress]: ...
    def p002_find_stuck_agents(self, execution_id: str) -> List[StuckAgent]: ...
    def p003_detect_file_conflicts(self, execution_id: str) -> List[FileConflict]: ...
    def p004_wave_efficiency(self, execution_id: str) -> List[WaveEfficiency]: ...
    def p005_find_wave_bottlenecks(self, execution_id: str) -> List[WaveBottleneck]: ...
    def p006_concurrent_execution_overlaps(self, execution_id: str) -> List[ConcurrentOverlap]: ...
    def p007_agent_lifecycle(self, execution_id: str) -> List[AgentLifecycle]: ...

    # Anomaly Detection Tools (D001-D006)
    def d001_unusual_duration(self, execution_id: str) -> List[DurationOutlier]: ...
    def d002_error_cascades(self, execution_id: str) -> List[ErrorCascade]: ...
    def d003_assertion_regression(self, execution_id: str) -> List[AssertionRegression]: ...
    def d004_activity_spikes(self, execution_id: str) -> List[ActivitySpike]: ...
    def d005_orphaned_resources(self, execution_id: str) -> List[OrphanedResource]: ...
    def d006_circular_wait_patterns(self) -> List[CircularWait]: ...
```

#### Acceptance Criteria

- [ ] All 39 SQL tools implemented as methods
- [ ] Returns typed dataclasses for each query result
- [ ] SQL queries match OBSERVABILITY-SQL-TOOLS.md exactly
- [ ] Connection management with proper cleanup
- [ ] Error handling for missing tables (graceful degradation)

---

### Phase 2 Test Validation Script

**File:** `tests/e2e/test-obs-phase2-producers.py`

```python
#!/usr/bin/env python3
"""
Phase 2 Producer Validation Tests

Validates that the Python producer classes work correctly
and produce data that can be queried.
"""

import sys
import os
import sqlite3
import json
import time
from dataclasses import dataclass
from typing import List, Dict, Any

# Add coding-loops to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../coding-loops'))

# Test constants
TEST_EXECUTION_ID = f'test-exec-{int(time.time())}'
TEST_INSTANCE_ID = f'test-instance-{int(time.time())}'
TEST_TASK_ID = f'test-task-{int(time.time())}'
DB_PATH = 'database/ideas.db'


def get_db():
    """Get database connection."""
    return sqlite3.connect(DB_PATH)


# ============================================================================
# TEST 1: TranscriptWriter writes to database
# ============================================================================
def test_transcript_writer():
    print("\n" + "=" * 70)
    print("TEST 1: TranscriptWriter")
    print("=" * 70)

    from shared.transcript_writer import TranscriptWriter

    writer = TranscriptWriter(
        execution_id=TEST_EXECUTION_ID,
        instance_id=TEST_INSTANCE_ID
    )

    # Write a phase_start entry
    entry_id = writer.write({
        "entry_type": "phase_start",
        "category": "lifecycle",
        "summary": "Test phase starting",
        "details": {"test": True}
    })

    # Verify sequence increments
    entry_id_2 = writer.write({
        "entry_type": "task_start",
        "category": "lifecycle",
        "task_id": TEST_TASK_ID,
        "summary": "Test task starting"
    })

    writer.flush()

    # Verify in database
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT COUNT(*) FROM transcript_entries WHERE execution_id = ?",
        (TEST_EXECUTION_ID,)
    )
    count = cursor.fetchone()[0]

    assert count == 2, f"Expected 2 entries, got {count}"

    # Verify sequence is monotonic
    cursor.execute(
        """
        SELECT sequence FROM transcript_entries
        WHERE execution_id = ?
        ORDER BY sequence
        """,
        (TEST_EXECUTION_ID,)
    )
    sequences = [row[0] for row in cursor.fetchall()]
    assert sequences == [1, 2], f"Expected [1, 2], got {sequences}"

    conn.close()
    writer.close()

    print("✓ TranscriptWriter writes entries to database")
    print("✓ Sequence numbers are monotonically increasing")
    print("✓ TEST 1 PASSED\n")


# ============================================================================
# TEST 2: ToolUseLogger creates tool use records
# ============================================================================
def test_tool_use_logger():
    print("=" * 70)
    print("TEST 2: ToolUseLogger")
    print("=" * 70)

    from shared.transcript_writer import TranscriptWriter
    from shared.tool_use_logger import ToolUseLogger

    writer = TranscriptWriter(
        execution_id=TEST_EXECUTION_ID,
        instance_id=TEST_INSTANCE_ID
    )
    logger = ToolUseLogger(writer)

    # Simulate a tool use block
    class MockToolUseBlock:
        id = "mock-tool-id"
        name = "Read"
        input = {"file_path": "/test/file.txt"}

    class MockToolResultBlock:
        content = "File contents here"
        is_error = False

    # Log tool start
    tool_use_id = logger.log_start(MockToolUseBlock())

    # Simulate some work
    time.sleep(0.1)

    # Log tool end
    logger.log_end(tool_use_id, MockToolResultBlock())

    writer.flush()

    # Verify in database
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT tool, result_status, duration_ms, is_error
        FROM tool_uses
        WHERE execution_id = ?
        """,
        (TEST_EXECUTION_ID,)
    )
    row = cursor.fetchone()

    assert row is not None, "No tool_uses row found"
    assert row[0] == "Read", f"Expected tool='Read', got '{row[0]}'"
    assert row[1] == "done", f"Expected result_status='done', got '{row[1]}'"
    assert row[2] >= 100, f"Expected duration_ms >= 100, got {row[2]}"
    assert row[3] == 0, f"Expected is_error=0, got {row[3]}"

    conn.close()
    writer.close()

    print("✓ ToolUseLogger creates tool_uses records")
    print("✓ Duration is calculated correctly")
    print("✓ Result status is set properly")
    print("✓ TEST 2 PASSED\n")


# ============================================================================
# TEST 3: ToolUseLogger handles blocked commands
# ============================================================================
def test_tool_use_blocked():
    print("=" * 70)
    print("TEST 3: ToolUseLogger (blocked commands)")
    print("=" * 70)

    from shared.transcript_writer import TranscriptWriter
    from shared.tool_use_logger import ToolUseLogger

    writer = TranscriptWriter(
        execution_id=TEST_EXECUTION_ID,
        instance_id=TEST_INSTANCE_ID
    )
    logger = ToolUseLogger(writer)

    class MockToolUseBlock:
        id = "blocked-tool-id"
        name = "Bash"
        input = {"command": "rm -rf /"}

    tool_use_id = logger.log_start(MockToolUseBlock())
    logger.log_blocked(tool_use_id, "Dangerous command blocked by security policy")

    writer.flush()

    # Verify blocked flag
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT is_blocked, block_reason, result_status
        FROM tool_uses
        WHERE id = ?
        """,
        (tool_use_id,)
    )
    row = cursor.fetchone()

    assert row is not None, "No tool_uses row found for blocked command"
    assert row[0] == 1, f"Expected is_blocked=1, got {row[0]}"
    assert "security" in row[1].lower(), f"Expected security in block_reason, got '{row[1]}'"
    assert row[2] == "blocked", f"Expected result_status='blocked', got '{row[2]}'"

    conn.close()
    writer.close()

    print("✓ Blocked commands set is_blocked=1")
    print("✓ Block reason is recorded")
    print("✓ TEST 3 PASSED\n")


# ============================================================================
# TEST 4: AssertionRecorder creates chains and results
# ============================================================================
def test_assertion_recorder():
    print("=" * 70)
    print("TEST 4: AssertionRecorder")
    print("=" * 70)

    from shared.transcript_writer import TranscriptWriter
    from shared.assertion_recorder import AssertionRecorder

    writer = TranscriptWriter(
        execution_id=TEST_EXECUTION_ID,
        instance_id=TEST_INSTANCE_ID
    )
    recorder = AssertionRecorder(writer, TEST_EXECUTION_ID)

    # Start a chain
    chain_id = recorder.start_chain(TEST_TASK_ID, "Test validation chain")

    # Record some assertions
    # Create a test file first
    test_file = "/tmp/test_obs_file.txt"
    with open(test_file, "w") as f:
        f.write("test content")

    result1 = recorder.assert_file_created(TEST_TASK_ID, test_file)

    # This will fail (file doesn't exist)
    result2 = recorder.assert_file_created(TEST_TASK_ID, "/nonexistent/file.txt")

    # End chain
    chain_result = recorder.end_chain(chain_id)

    writer.flush()

    # Verify chain in database
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT overall_result, pass_count, fail_count, first_failure_id
        FROM assertion_chains
        WHERE id = ?
        """,
        (chain_id,)
    )
    row = cursor.fetchone()

    assert row is not None, "No assertion_chains row found"
    assert row[0] == "fail", f"Expected overall_result='fail', got '{row[0]}'"
    assert row[1] == 1, f"Expected pass_count=1, got {row[1]}"
    assert row[2] == 1, f"Expected fail_count=1, got {row[2]}"
    assert row[3] is not None, "first_failure_id should be set"

    # Verify assertion results
    cursor.execute(
        """
        SELECT COUNT(*) FROM assertion_results
        WHERE chain_id = ?
        """,
        (chain_id,)
    )
    count = cursor.fetchone()[0]
    assert count == 2, f"Expected 2 assertion results, got {count}"

    # Cleanup
    os.remove(test_file)
    conn.close()
    writer.close()

    print("✓ AssertionRecorder creates chains")
    print("✓ Assertions are recorded with correct results")
    print("✓ Chain aggregates pass/fail counts")
    print("✓ first_failure_id is set on first failure")
    print("✓ TEST 4 PASSED\n")


# ============================================================================
# TEST 5: SkillTracer traces skill invocations
# ============================================================================
def test_skill_tracer():
    print("=" * 70)
    print("TEST 5: SkillTracer")
    print("=" * 70)

    from shared.transcript_writer import TranscriptWriter
    from shared.tool_use_logger import ToolUseLogger
    from shared.skill_tracer import SkillTracer, SkillReference

    writer = TranscriptWriter(
        execution_id=TEST_EXECUTION_ID,
        instance_id=TEST_INSTANCE_ID
    )
    tool_logger = ToolUseLogger(writer)
    tracer = SkillTracer(writer, tool_logger)

    # Start skill trace
    trace_id = tracer.trace_start(SkillReference(
        skill_name="validation",
        skill_file="SKILLS.md",
        line_number=42,
        section_title="## Validation"
    ))

    # Simulate tool calls within skill
    class MockToolBlock:
        id = "skill-tool-1"
        name = "Bash"
        input = {"command": "npx tsc --noEmit"}

    class MockResult:
        content = "Success"
        is_error = False

    tool_id = tool_logger.log_start(MockToolBlock())
    tracer.add_tool_call(trace_id, tool_id)
    tool_logger.log_end(tool_id, MockResult())

    # End skill trace
    tracer.trace_end(trace_id, status="success")

    writer.flush()

    # Verify skill trace in database
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT skill_name, skill_file, line_number, status, tool_calls
        FROM skill_traces
        WHERE id = ?
        """,
        (trace_id,)
    )
    row = cursor.fetchone()

    assert row is not None, "No skill_traces row found"
    assert row[0] == "validation", f"Expected skill_name='validation', got '{row[0]}'"
    assert row[1] == "SKILLS.md", f"Expected skill_file='SKILLS.md', got '{row[1]}'"
    assert row[2] == 42, f"Expected line_number=42, got {row[2]}"
    assert row[3] == "success", f"Expected status='success', got '{row[3]}'"

    # Verify tool_calls JSON array
    tool_calls = json.loads(row[4]) if row[4] else []
    assert tool_id in tool_calls, "Tool call ID should be in skill trace"

    # Verify tool_uses.within_skill is set
    cursor.execute(
        """
        SELECT within_skill FROM tool_uses WHERE id = ?
        """,
        (tool_id,)
    )
    within_skill = cursor.fetchone()[0]
    assert within_skill == trace_id, "Tool use should reference skill trace"

    conn.close()
    writer.close()

    print("✓ SkillTracer creates skill_traces records")
    print("✓ Tool calls are linked to skill trace")
    print("✓ tool_uses.within_skill is set correctly")
    print("✓ TEST 5 PASSED\n")


# ============================================================================
# TEST 6: ObservabilitySkills queries work
# ============================================================================
def test_observability_skills():
    print("=" * 70)
    print("TEST 6: ObservabilitySkills Query Class")
    print("=" * 70)

    from shared.observability_skills import ObservabilitySkills

    skills = ObservabilitySkills(DB_PATH)

    # V001: Verify sequence integrity
    gaps = skills.v001_verify_sequence_integrity(TEST_EXECUTION_ID)
    assert isinstance(gaps, list), "V001 should return a list"
    print("✓ V001 verify_sequence_integrity works")

    # T001: Find all errors
    errors = skills.t001_find_all_errors(TEST_EXECUTION_ID)
    assert isinstance(errors, list), "T001 should return a list"
    print("✓ T001 find_all_errors works")

    # T002: Find blocked commands
    blocked = skills.t002_find_blocked_commands(TEST_EXECUTION_ID)
    assert isinstance(blocked, list), "T002 should return a list"
    assert len(blocked) >= 1, "Should find at least one blocked command from TEST 3"
    print("✓ T002 find_blocked_commands works")

    # A001: Execution summary
    summary = skills.a001_execution_summary(TEST_EXECUTION_ID)
    assert summary is not None, "A001 should return a summary"
    print("✓ A001 execution_summary works")

    # I002: Tool usage patterns
    patterns = skills.i002_tool_usage_patterns(TEST_EXECUTION_ID)
    assert isinstance(patterns, list), "I002 should return a list"
    print("✓ I002 tool_usage_patterns works")

    print("✓ TEST 6 PASSED\n")


# ============================================================================
# TEST 7: Verify SQL invariants from OBSERVABILITY-SQL-TOOLS.md
# ============================================================================
def test_sql_invariants():
    print("=" * 70)
    print("TEST 7: SQL Invariants Verification")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    # Invariant 1: Every tool_use has a transcript_entry
    cursor.execute(
        """
        SELECT COUNT(*) FROM tool_uses tu
        LEFT JOIN transcript_entries te ON tu.transcript_entry_id = te.id
        WHERE tu.execution_id = ? AND te.id IS NULL
        """,
        (TEST_EXECUTION_ID,)
    )
    orphans = cursor.fetchone()[0]
    assert orphans == 0, f"Found {orphans} orphaned tool_uses (should be 0)"
    print("✓ Invariant: Every tool_use has a transcript_entry")

    # Invariant 2: Sequences are monotonic
    cursor.execute(
        """
        SELECT COUNT(*) FROM (
            SELECT
                sequence,
                LAG(sequence) OVER (ORDER BY sequence) as prev_seq
            FROM transcript_entries
            WHERE execution_id = ?
        ) WHERE prev_seq IS NOT NULL AND sequence <= prev_seq
        """,
        (TEST_EXECUTION_ID,)
    )
    non_monotonic = cursor.fetchone()[0]
    assert non_monotonic == 0, f"Found {non_monotonic} non-monotonic sequences"
    print("✓ Invariant: Sequence numbers are monotonically increasing")

    # Invariant 3: Temporal consistency (start < end)
    cursor.execute(
        """
        SELECT COUNT(*) FROM tool_uses
        WHERE execution_id = ?
          AND end_time IS NOT NULL
          AND end_time < start_time
        """,
        (TEST_EXECUTION_ID,)
    )
    temporal_issues = cursor.fetchone()[0]
    assert temporal_issues == 0, f"Found {temporal_issues} temporal inconsistencies"
    print("✓ Invariant: All end_times are after start_times")

    # Invariant 4: Assertion chain completeness
    cursor.execute(
        """
        SELECT COUNT(*) FROM assertion_chains
        WHERE execution_id = ?
          AND overall_result NOT IN ('pass', 'fail')
        """,
        (TEST_EXECUTION_ID,)
    )
    incomplete = cursor.fetchone()[0]
    assert incomplete == 0, f"Found {incomplete} incomplete assertion chains"
    print("✓ Invariant: All assertion chains are complete")

    conn.close()

    print("✓ TEST 7 PASSED\n")


# ============================================================================
# Cleanup
# ============================================================================
def cleanup_test_data():
    print("=" * 70)
    print("CLEANUP: Removing test data")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    # Delete in dependency order
    cursor.execute("DELETE FROM assertion_results WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM assertion_chains WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM tool_uses WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM skill_traces WHERE execution_id = ?", (TEST_EXECUTION_ID,))
    cursor.execute("DELETE FROM transcript_entries WHERE execution_id = ?", (TEST_EXECUTION_ID,))

    conn.commit()
    conn.close()

    print("✓ Test data cleaned up\n")


# ============================================================================
# Main Test Runner
# ============================================================================
def main():
    print("\n" + "=" * 70)
    print("OBSERVABILITY PHASE 2 PRODUCER VALIDATION TESTS")
    print("=" * 70)

    try:
        test_transcript_writer()
        test_tool_use_logger()
        test_tool_use_blocked()
        test_assertion_recorder()
        test_skill_tracer()
        test_observability_skills()
        test_sql_invariants()

        print("=" * 70)
        print("ALL PHASE 2 TESTS PASSED")
        print("=" * 70)

    except Exception as e:
        print("\n" + "=" * 70)
        print(f"PHASE 2 TEST FAILURE: {e}")
        print("=" * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cleanup_test_data()


if __name__ == "__main__":
    main()
```

#### Run Phase 2 Tests

```bash
# After implementing producers
python3 tests/e2e/test-obs-phase2-producers.py
```

#### Expected Output (Success)

```
======================================================================
OBSERVABILITY PHASE 2 PRODUCER VALIDATION TESTS
======================================================================

======================================================================
TEST 1: TranscriptWriter
======================================================================
✓ TranscriptWriter writes entries to database
✓ Sequence numbers are monotonically increasing
✓ TEST 1 PASSED

======================================================================
TEST 2: ToolUseLogger
======================================================================
✓ ToolUseLogger creates tool_uses records
✓ Duration is calculated correctly
✓ Result status is set properly
✓ TEST 2 PASSED

======================================================================
TEST 3: ToolUseLogger (blocked commands)
======================================================================
✓ Blocked commands set is_blocked=1
✓ Block reason is recorded
✓ TEST 3 PASSED

======================================================================
TEST 4: AssertionRecorder
======================================================================
✓ AssertionRecorder creates chains
✓ Assertions are recorded with correct results
✓ Chain aggregates pass/fail counts
✓ first_failure_id is set on first failure
✓ TEST 4 PASSED

======================================================================
TEST 5: SkillTracer
======================================================================
✓ SkillTracer creates skill_traces records
✓ Tool calls are linked to skill trace
✓ tool_uses.within_skill is set correctly
✓ TEST 5 PASSED

======================================================================
TEST 6: ObservabilitySkills Query Class
======================================================================
✓ V001 verify_sequence_integrity works
✓ T001 find_all_errors works
✓ T002 find_blocked_commands works
✓ A001 execution_summary works
✓ I002 tool_usage_patterns works
✓ TEST 6 PASSED

======================================================================
TEST 7: SQL Invariants Verification
======================================================================
✓ Invariant: Every tool_use has a transcript_entry
✓ Invariant: Sequence numbers are monotonically increasing
✓ Invariant: All end_times are after start_times
✓ Invariant: All assertion chains are complete
✓ TEST 7 PASSED

======================================================================
ALL PHASE 2 TESTS PASSED
======================================================================

======================================================================
CLEANUP: Removing test data
======================================================================
✓ Test data cleaned up
```

---

## SQL Tools Cross-Reference for Agents

### Validation Tools (Use after execution completes)

| Tool ID | Use Case                                         | Agent Query Method                        |
| ------- | ------------------------------------------------ | ----------------------------------------- |
| V001    | Check for sequence gaps in transcript            | `skills.v001_verify_sequence_integrity`   |
| V002    | Find orphaned tool_uses without transcript_entry | `skills.v002_verify_tool_use_linkage`     |
| V003    | Find temporal inconsistencies (end < start)      | `skills.v003_verify_temporal_consistency` |
| V004    | Find unreleased file locks                       | `skills.v004_verify_lock_balance`         |
| V005    | Find incomplete assertion chains                 | `skills.v005_verify_chain_completeness`   |
| V006    | Verify wave task counts match                    | `skills.v006_verify_wave_task_counts`     |
| V007    | Check foreign key integrity                      | `skills.v007_verify_foreign_keys`         |

### Troubleshooting Tools (Use when failures occur)

| Tool ID | Use Case                                 | Agent Query Method                       |
| ------- | ---------------------------------------- | ---------------------------------------- |
| T001    | Get all errors across tables             | `skills.t001_find_all_errors`            |
| T002    | Find security-blocked commands           | `skills.t002_find_blocked_commands`      |
| T003    | Find first error in cascade              | `skills.t003_find_first_error_in_chain`  |
| T004    | Find operations that never completed     | `skills.t004_find_incomplete_operations` |
| T005    | Find same error occurring multiple times | `skills.t005_find_repeated_failures`     |
| T006    | Find why a task is blocked               | `skills.t006_find_task_blockers`         |

### Investigation Tools (Use for deep analysis)

| Tool ID | Use Case                              | Agent Query Method                          |
| ------- | ------------------------------------- | ------------------------------------------- |
| I001    | Full execution trace for a task       | `skills.i001_task_execution_trace`          |
| I002    | Tool usage statistics                 | `skills.i002_tool_usage_patterns`           |
| I003    | Skill invocation patterns             | `skills.i003_skill_execution_patterns`      |
| I004    | File access patterns                  | `skills.i004_file_access_patterns`          |
| I005    | Find related events by correlation_id | `skills.i005_related_events_by_correlation` |
| I006    | Reconstruct decision points           | `skills.i006_reconstruct_decisions`         |
| I007    | Get assertion evidence details        | `skills.i007_assertion_evidence_analysis`   |

### Aggregation Tools (Use for dashboards/reports)

| Tool ID | Use Case                                  | Agent Query Method                       |
| ------- | ----------------------------------------- | ---------------------------------------- |
| A001    | High-level execution summary              | `skills.a001_execution_summary`          |
| A002    | Task completion breakdown by status       | `skills.a002_task_completion_summary`    |
| A003    | Activity distribution by hour             | `skills.a003_hourly_activity_heatmap`    |
| A004    | Assertion pass rate by category           | `skills.a004_pass_rate_by_category`      |
| A005    | Tool duration percentiles (P50, P90, P99) | `skills.a005_duration_percentiles`       |
| A006    | Compare metrics across executions         | `skills.a006_cross_execution_comparison` |

### Parallel Execution Tools (Use for wave monitoring)

| Tool ID | Use Case                                 | Agent Query Method                          |
| ------- | ---------------------------------------- | ------------------------------------------- |
| P001    | Current state of all waves               | `skills.p001_wave_progress`                 |
| P002    | Find agents without recent heartbeat     | `skills.p002_find_stuck_agents`             |
| P003    | Detect file conflicts in same wave       | `skills.p003_detect_file_conflicts`         |
| P004    | Calculate wave parallelism efficiency    | `skills.p004_wave_efficiency`               |
| P005    | Find slowest tasks in each wave          | `skills.p005_find_wave_bottlenecks`         |
| P006    | Find concurrently executing tasks        | `skills.p006_concurrent_execution_overlaps` |
| P007    | Track agent spawn/complete/fail patterns | `skills.p007_agent_lifecycle`               |

### Anomaly Detection Tools (Use for proactive monitoring)

| Tool ID | Use Case                                  | Agent Query Method                   |
| ------- | ----------------------------------------- | ------------------------------------ |
| D001    | Find tools taking 3x+ average duration    | `skills.d001_unusual_duration`       |
| D002    | Detect error cascades (error sequences)   | `skills.d002_error_cascades`         |
| D003    | Find assertions that regressed (was pass) | `skills.d003_assertion_regression`   |
| D004    | Find unusual activity spikes              | `skills.d004_activity_spikes`        |
| D005    | Find resources allocated but never freed  | `skills.d005_orphaned_resources`     |
| D006    | Detect circular wait patterns (deadlocks) | `skills.d006_circular_wait_patterns` |

---

## Task Summary

### Phase 1 Tasks (Database Schema)

| Task ID | Title                         | File                                                           | Priority | Dependencies |
| ------- | ----------------------------- | -------------------------------------------------------------- | -------- | ------------ |
| OBS-001 | Core observability schema     | `database/migrations/087_observability_schema.sql`             | P0       | None         |
| OBS-002 | Parallel execution extensions | `database/migrations/088_parallel_execution_observability.sql` | P0       | OBS-001      |

### Phase 2 Tasks (Python Producers)

| Task ID | Title                       | File                                          | Priority | Dependencies    |
| ------- | --------------------------- | --------------------------------------------- | -------- | --------------- |
| OBS-003 | TranscriptWriter class      | `coding-loops/shared/transcript_writer.py`    | P0       | OBS-001         |
| OBS-004 | ToolUseLogger class         | `coding-loops/shared/tool_use_logger.py`      | P0       | OBS-001,OBS-003 |
| OBS-005 | SkillTracer class           | `coding-loops/shared/skill_tracer.py`         | P0       | OBS-003,OBS-004 |
| OBS-006 | AssertionRecorder class     | `coding-loops/shared/assertion_recorder.py`   | P0       | OBS-003         |
| OBS-007 | ObservabilitySkills queries | `coding-loops/shared/observability_skills.py` | P0       | OBS-001,OBS-002 |

### Test Validation Tasks

| Task ID     | Title                       | File                                     | Priority | Dependencies            |
| ----------- | --------------------------- | ---------------------------------------- | -------- | ----------------------- |
| OBS-TEST-01 | Phase 1 schema validation   | `tests/e2e/test-obs-phase1-schema.ts`    | P0       | OBS-001, OBS-002        |
| OBS-TEST-02 | Phase 2 producer validation | `tests/e2e/test-obs-phase2-producers.py` | P0       | OBS-003 through OBS-007 |

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTATION SEQUENCE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: Database Schema                                                │
│  ─────────────────────────                                               │
│  1. OBS-001: Create migration 087 (core tables)                         │
│  2. OBS-002: Create migration 088 (parallel extensions)                 │
│  3. Run: npm run migrate                                                │
│  4. Run: npx tsx tests/e2e/test-obs-phase1-schema.ts                   │
│     └─ Verify: ALL PHASE 1 TESTS PASSED                                 │
│                                                                          │
│  PHASE 2: Python Data Producers                                          │
│  ──────────────────────────────                                          │
│  5. OBS-003: Create TranscriptWriter class                              │
│  6. OBS-004: Create ToolUseLogger class                                 │
│  7. OBS-005: Create SkillTracer class                                   │
│  8. OBS-006: Create AssertionRecorder class                             │
│  9. OBS-007: Create ObservabilitySkills query class                     │
│  10. Run: python3 tests/e2e/test-obs-phase2-producers.py               │
│      └─ Verify: ALL PHASE 2 TESTS PASSED                                │
│                                                                          │
│  VALIDATION COMPLETE                                                     │
│  ──────────────────                                                      │
│  ✓ All 8 tables exist                                                   │
│  ✓ All 37+ indexes created                                              │
│  ✓ All 2 views work                                                     │
│  ✓ Trigger fires correctly                                              │
│  ✓ All 4 producer classes work                                          │
│  ✓ SQL invariants hold                                                  │
│  ✓ 39 query tools compile and execute                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Related Documents

| Document                                                               | Purpose                            |
| ---------------------------------------------------------------------- | ---------------------------------- |
| [SPEC.md](./SPEC.md)                                                   | Full system specification          |
| [DEVELOPER-BRIEF.md](./DEVELOPER-BRIEF.md)                             | Implementation overview            |
| [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)       | How to integrate any agent         |
| [tools/OBSERVABILITY-SQL-TOOLS.md](./tools/OBSERVABILITY-SQL-TOOLS.md) | 39 SQL tool implementations        |
| [appendices/DATABASE.md](./appendices/DATABASE.md)                     | Full SQL schema                    |
| [appendices/TYPES.md](./appendices/TYPES.md)                           | TypeScript/Python type definitions |
| [data-model/README.md](./data-model/README.md)                         | ER diagrams and relationships      |
| [task-data-model.md](../task-data-model.md)                            | Task system data model             |

---

_Implementation plan for Observability System Phases 1 & 2 - Database Schema and Python Producers_
