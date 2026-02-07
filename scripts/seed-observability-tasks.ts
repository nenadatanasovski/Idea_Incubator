/**
 * Seed Observability Tasks
 *
 * Creates all Phase 1 and Phase 2 observability tasks in the task database
 * with proper display IDs, dependencies, and file impacts.
 *
 * Run: npx tsx scripts/seed-observability-tasks.ts
 */

import { v4 as uuidv4 } from "uuid";
import { run, getOne, query as all, saveDb } from "../database/db.js";

interface TaskToCreate {
  id: string;
  displayId: string;
  title: string;
  description: string;
  category: "feature" | "task" | "infrastructure";
  priority: "P0" | "P1" | "P2";
  effort: "small" | "medium" | "large";
  phase: number;
  fileImpacts: Array<{
    filePath: string;
    operation: "CREATE" | "UPDATE" | "READ";
  }>;
  dependsOn: string[]; // display_ids
}

// Define all observability tasks
const observabilityTasks: Omit<TaskToCreate, "id">[] = [
  // Phase 1: Database Schema
  {
    displayId: "TU-OBS-INF-001",
    title: "Create core observability schema (Migration 087)",
    description: `Create the core observability database tables:
- transcript_entries: Unified event log for all agent activity
- tool_uses: Tool invocation records with timing and results
- skill_traces: Skill invocations with file:line references
- assertion_results: Test assertions with pass/fail and evidence
- assertion_chains: Ordered assertion groups for tasks
- message_bus_log: Human-readable events (auto-populated via trigger)

Also create all required indexes (35+) and the tr_event_to_log trigger.

Acceptance Criteria:
- All 6 tables created with correct column types
- All indexes created for efficient querying
- Trigger fires on events insert
- Foreign keys enforced`,
    category: "infrastructure",
    priority: "P0",
    effort: "medium",
    phase: 1,
    fileImpacts: [
      {
        filePath: "database/migrations/087_observability_schema.sql",
        operation: "CREATE",
      },
    ],
    dependsOn: [],
  },
  {
    displayId: "TU-OBS-INF-002",
    title: "Create parallel execution observability extensions (Migration 088)",
    description: `Create the parallel execution observability extensions:
- wave_statistics: Pre-computed wave stats for dashboard
- concurrent_execution_sessions: Multi-list tracking

Add wave_id FK to:
- transcript_entries
- tool_uses
- assertion_results
- task_list_execution_runs (session_id)

Create views:
- v_wave_progress: Wave completion dashboard
- v_active_agents: Active agent status

Acceptance Criteria:
- wave_statistics table created with all columns
- concurrent_execution_sessions table created
- All 4 ALTER TABLE statements applied
- Wave-based indexes created
- Both views return data correctly`,
    category: "infrastructure",
    priority: "P0",
    effort: "medium",
    phase: 1,
    fileImpacts: [
      {
        filePath:
          "database/migrations/088_parallel_execution_observability.sql",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-INF-001"],
  },

  // Phase 2: Python Data Producers
  {
    displayId: "TU-OBS-FEA-003",
    title: "Create TranscriptWriter Python class",
    description: `Create the TranscriptWriter class for unified transcript logging:

Class Features:
- Writes to both JSONL files and SQLite database
- Maintains monotonic sequence numbers per execution
- Thread-safe for concurrent writes from multiple agents
- Configurable flush interval (default 1 second)

Methods:
- __init__(execution_id, instance_id, wave_id=None)
- write(entry: Dict) -> str (returns entry_id)
- flush() -> None
- close() -> None
- get_sequence() -> int

Entry Types:
phase_start, phase_end, task_start, task_end, tool_use,
skill_invoke, skill_complete, validation, assertion,
discovery, error, checkpoint, lock_acquire, lock_release

Acceptance Criteria:
- Writes to coding-loops/transcripts/{execution_id}/unified.jsonl
- Inserts into transcript_entries table
- Sequence numbers monotonically increasing per execution
- Thread-safe using file locks`,
    category: "feature",
    priority: "P0",
    effort: "medium",
    phase: 2,
    fileImpacts: [
      {
        filePath: "coding-loops/shared/transcript_writer.py",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-INF-001"],
  },
  {
    displayId: "TU-OBS-FEA-004",
    title: "Create ToolUseLogger Python class",
    description: `Create the ToolUseLogger class for logging tool invocations:

Class Features:
- Logs every tool invocation with inputs, outputs, and timing
- Links tool uses to transcript entries
- Handles blocked commands separately
- Categorizes tools (file_read, file_write, shell, browser, etc.)

Methods:
- __init__(transcript_writer: TranscriptWriter)
- log_start(tool_use_block: ToolUseBlock) -> str
- log_end(tool_use_id: str, tool_result_block: ToolResultBlock) -> None
- log_blocked(tool_use_id: str, reason: str) -> None

Tool Categories:
file_read, file_write, shell, browser, network, agent, custom

Acceptance Criteria:
- Creates tool_uses row on log_start
- Updates tool_uses row on log_end with result, duration
- Sets is_blocked=1 and block_reason on log_blocked
- Calculates duration_ms from start_time to end_time
- Links to transcript entry via transcript_entry_id`,
    category: "feature",
    priority: "P0",
    effort: "medium",
    phase: 2,
    fileImpacts: [
      {
        filePath: "coding-loops/shared/tool_use_logger.py",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-INF-001", "TU-OBS-FEA-003"],
  },
  {
    displayId: "TU-OBS-FEA-005",
    title: "Create SkillTracer Python class",
    description: `Create the SkillTracer class for tracing skill invocations:

Class Features:
- Traces skill invocations with file:line references
- Links tool calls to skill traces
- Supports nested skills (sub-skills)
- Records timing and status

Methods:
- __init__(transcript_writer, tool_logger)
- trace_start(skill_ref: SkillReference) -> str
- trace_end(trace_id: str, status: str, error: str = None) -> None
- add_tool_call(trace_id: str, tool_use_id: str) -> None

SkillReference:
- skill_name: str
- skill_file: str
- line_number: int
- section_title: str

Acceptance Criteria:
- Creates skill_traces row on trace_start
- Updates row on trace_end with status, duration
- Records tool call IDs in tool_calls JSON array
- Sets within_skill on associated tool_uses rows
- Writes transcript entries for skill_invoke and skill_complete`,
    category: "feature",
    priority: "P0",
    effort: "medium",
    phase: 2,
    fileImpacts: [
      {
        filePath: "coding-loops/shared/skill_tracer.py",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-FEA-003", "TU-OBS-FEA-004"],
  },
  {
    displayId: "TU-OBS-FEA-006",
    title: "Create AssertionRecorder Python class",
    description: `Create the AssertionRecorder class for recording test assertions:

Class Features:
- Records assertions with evidence linking
- Groups assertions into chains
- Pre-built assertions for common checks
- Computes overall pass/fail for chains

Methods:
- __init__(transcript_writer, execution_id)
- start_chain(task_id: str, description: str) -> str
- end_chain(chain_id: str) -> ChainResult

Pre-built Assertions:
- assert_file_created(task_id, file_path) -> AssertionResult
- assert_file_modified(task_id, file_path) -> AssertionResult
- assert_file_deleted(task_id, file_path) -> AssertionResult
- assert_typescript_compiles(task_id) -> AssertionResult
- assert_lint_passes(task_id) -> AssertionResult
- assert_tests_pass(task_id, pattern) -> AssertionResult
- assert_custom(task_id, category, desc, cmd) -> AssertionResult

Acceptance Criteria:
- Creates assertion_chains row on start_chain
- Creates assertion_results row for each assertion
- Updates chain counts (pass_count, fail_count) on each assertion
- Sets first_failure_id when first failure occurs
- Evidence JSON includes command output, file info, etc.`,
    category: "feature",
    priority: "P0",
    effort: "medium",
    phase: 2,
    fileImpacts: [
      {
        filePath: "coding-loops/shared/assertion_recorder.py",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-FEA-003"],
  },
  {
    displayId: "TU-OBS-FEA-007",
    title: "Create ObservabilitySkills query class",
    description: `Create the ObservabilitySkills class implementing all 39 SQL tools:

Tool Categories:
- Validation (V001-V007): Verify data integrity
- Troubleshooting (T001-T006): Find and diagnose errors
- Investigation (I001-I007): Deep analysis of execution
- Aggregation (A001-A006): Summary statistics and reports
- Parallel Execution (P001-P007): Wave monitoring
- Anomaly Detection (D001-D006): Proactive issue detection

Key Methods:
- v001_verify_sequence_integrity(execution_id) -> List[SequenceGap]
- t001_find_all_errors(execution_id) -> List[ErrorRecord]
- t002_find_blocked_commands(execution_id) -> List[BlockedCommand]
- i001_task_execution_trace(task_id) -> List[TraceEntry]
- a001_execution_summary(execution_id) -> ExecutionSummary
- p001_wave_progress(execution_id) -> List[WaveProgress]
- d001_unusual_duration(execution_id) -> List[DurationOutlier]

Acceptance Criteria:
- All 39 SQL tools implemented as methods
- Returns typed dataclasses for each query result
- SQL queries match OBSERVABILITY-SQL-TOOLS.md exactly
- Connection management with proper cleanup
- Error handling for missing tables (graceful degradation)`,
    category: "feature",
    priority: "P0",
    effort: "large",
    phase: 2,
    fileImpacts: [
      {
        filePath: "coding-loops/shared/observability_skills.py",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-INF-001", "TU-OBS-INF-002"],
  },

  // Test Validation Tasks
  {
    displayId: "TU-OBS-TST-001",
    title: "Create Phase 1 schema validation tests",
    description: `Create comprehensive test script for Phase 1 schema validation:

Tests:
1. Verify all 8 required tables exist
2. Verify transcript_entries schema (columns, types, constraints)
3. Verify tool_uses schema
4. Verify assertion_results schema
5. Verify all 37+ required indexes exist
6. Verify v_wave_progress and v_active_agents views exist
7. Verify tr_event_to_log trigger exists
8. Verify foreign key constraints
9. Test data insertion and cleanup works
10. Verify SQL tool queries from OBSERVABILITY-SQL-TOOLS.md compile

Run Command: npx tsx tests/e2e/test-obs-phase1-schema.ts

Acceptance Criteria:
- All 10 tests pass
- Test outputs clear pass/fail messages
- Test cleans up any test data after completion`,
    category: "task",
    priority: "P0",
    effort: "small",
    phase: 1,
    fileImpacts: [
      {
        filePath: "tests/e2e/test-obs-phase1-schema.ts",
        operation: "CREATE",
      },
    ],
    dependsOn: ["TU-OBS-INF-001", "TU-OBS-INF-002"],
  },
  {
    displayId: "TU-OBS-TST-002",
    title: "Create Phase 2 producer validation tests",
    description: `Create comprehensive Python test script for Phase 2 producers:

Tests:
1. TranscriptWriter writes to database
2. ToolUseLogger creates tool use records
3. ToolUseLogger handles blocked commands
4. AssertionRecorder creates chains and results
5. SkillTracer traces skill invocations
6. ObservabilitySkills queries work
7. SQL invariants verification (sequence monotonicity, temporal consistency, etc.)

Run Command: python3 tests/e2e/test-obs-phase2-producers.py

Acceptance Criteria:
- All 7 tests pass
- SQL invariants from OBSERVABILITY-SQL-TOOLS.md hold
- Test cleans up test data after completion`,
    category: "task",
    priority: "P0",
    effort: "small",
    phase: 2,
    fileImpacts: [
      {
        filePath: "tests/e2e/test-obs-phase2-producers.py",
        operation: "CREATE",
      },
    ],
    dependsOn: [
      "TU-OBS-FEA-003",
      "TU-OBS-FEA-004",
      "TU-OBS-FEA-005",
      "TU-OBS-FEA-006",
      "TU-OBS-FEA-007",
    ],
  },
];

async function main() {
  console.log("=".repeat(70));
  console.log("SEEDING OBSERVABILITY TASKS");
  console.log("=".repeat(70));
  console.log();

  // Check if tasks already exist
  const existingCount = await getOne<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM tasks WHERE display_id LIKE 'TU-OBS-%'",
  );

  if (existingCount && existingCount.cnt > 0) {
    console.log(
      `Found ${existingCount.cnt} existing observability tasks. Skipping seeding.`,
    );
    console.log(
      "To re-seed, first delete existing tasks with: DELETE FROM tasks WHERE display_id LIKE 'TU-OBS-%'",
    );
    return;
  }

  // Create a task list for observability tasks
  const taskListId = uuidv4();
  await run(
    `INSERT INTO task_lists_v2 (id, name, project_id, status, total_tasks, completed_tasks, failed_tasks)
     VALUES (?, ?, NULL, 'draft', ?, 0, 0)`,
    [
      taskListId,
      "Observability System - Phases 1 & 2",
      observabilityTasks.length,
    ],
  );
  console.log(`Created task list: ${taskListId}`);

  // Map display_id to task id for dependency resolution
  const displayIdToId: Map<string, string> = new Map();

  // First pass: Create all tasks
  for (const taskDef of observabilityTasks) {
    const id = uuidv4();
    displayIdToId.set(taskDef.displayId, id);

    await run(
      `INSERT INTO tasks (
        id, display_id, title, description, category,
        status, queue, task_list_id, project_id,
        priority, effort, phase, position, owner
      ) VALUES (
        ?, ?, ?, ?, ?,
        'pending', NULL, ?, NULL,
        ?, ?, ?, ?, 'build_agent'
      )`,
      [
        id,
        taskDef.displayId,
        taskDef.title,
        taskDef.description,
        taskDef.category === "infrastructure" ? "task" : taskDef.category,
        taskListId,
        taskDef.priority,
        taskDef.effort,
        taskDef.phase,
        observabilityTasks.indexOf(taskDef),
      ],
    );

    console.log(`✓ Created task: ${taskDef.displayId} - ${taskDef.title}`);

    // Create file impacts
    for (const impact of taskDef.fileImpacts) {
      const impactId = uuidv4();
      await run(
        `INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
         VALUES (?, ?, ?, ?, 1.0, 'user_declared')`,
        [impactId, id, impact.filePath, impact.operation],
      );
    }
  }

  // Second pass: Create dependencies
  for (const taskDef of observabilityTasks) {
    const sourceId = displayIdToId.get(taskDef.displayId);
    if (!sourceId) continue;

    for (const depDisplayId of taskDef.dependsOn) {
      const targetId = displayIdToId.get(depDisplayId);
      if (!targetId) {
        console.log(
          `WARNING: Dependency ${depDisplayId} not found for ${taskDef.displayId}`,
        );
        continue;
      }

      const relId = uuidv4();
      await run(
        `INSERT INTO task_relationships (id, source_task_id, target_task_id, relationship_type)
         VALUES (?, ?, ?, 'depends_on')`,
        [relId, sourceId, targetId],
      );
    }
  }

  await saveDb();

  console.log();
  console.log("=".repeat(70));
  console.log(`SUCCESSFULLY CREATED ${observabilityTasks.length} TASKS`);
  console.log("=".repeat(70));
  console.log();
  console.log("Task List ID:", taskListId);
  console.log();
  console.log("Tasks created:");
  for (const task of observabilityTasks) {
    const deps =
      task.dependsOn.length > 0
        ? ` (depends on: ${task.dependsOn.join(", ")})`
        : "";
    console.log(`  ${task.displayId}: ${task.title}${deps}`);
  }
  console.log();
  console.log("File impacts created for each task.");
  console.log("Dependencies created between tasks.");
}

main().catch((err) => {
  console.error("Error seeding tasks:", err);
  process.exit(1);
});
