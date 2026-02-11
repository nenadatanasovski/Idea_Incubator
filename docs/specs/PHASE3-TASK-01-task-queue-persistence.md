# PHASE3-TASK-01: Task Queue Persistence with Proper Wave/Lane Generation

**Status:** Specification
**Priority:** P0 (Critical Path - Phase 3)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement persistent task queue with automatic wave/lane generation for parallel execution coordination in the Parent Harness orchestrator. The system provides intelligent task batching based on dependencies, priority-based wave assignment, category-based lane organization, and conflict detection to enable safe parallel execution of independent tasks.

**Problem:** Current wave execution system (`parent-harness/orchestrator/src/waves/`) exists but lacks integration with the orchestrator's main tick loop. Wave runs are created on-demand via API but not automatically generated as tasks arrive. There's no persistent queue that survives orchestrator restarts, and lane organization for UI visualization is computed on-demand in the dashboard rather than persisted.

**Solution:** Extend the orchestrator tick loop to automatically maintain a persistent task queue, generate wave/lane assignments when tasks are created or updated, persist these assignments to the database, and provide real-time updates to the dashboard via WebSocket.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Wave System** (`parent-harness/orchestrator/src/waves/index.ts`)
   - ✅ Wave planning: `planWaves()` uses topological sort for dependency analysis
   - ✅ Wave execution: `startWaveRun()`, `startNextWave()`, `checkWaveCompletion()`
   - ✅ Database tables: `wave_runs`, `waves` with CREATE TABLE IF NOT EXISTS
   - ✅ Task wave assignment: Updates `tasks.wave_number` field
   - ✅ Dependency resolution: Queries `task_relationships` table
   - ❌ **Gap:** Not called automatically by orchestrator - only via API

2. **Task Pipeline Utils** (`parent-harness/dashboard/src/utils/task-pipeline.ts`)
   - ✅ Wave generation: `generateWavesFromTasks()` maps priority to wave number
   - ✅ Lane generation: `generateLanesFromTasks()` groups by category
   - ✅ Priority mapping: P0→1, P1→2, P2→3, P3→4, P4→5
   - ✅ Category mapping: feature→api, bug→types, documentation→ui, test→tests, infrastructure→infrastructure
   - ❌ **Gap:** Client-side only, not integrated with backend

3. **Task Database** (`parent-harness/orchestrator/src/db/tasks.ts`)
   - ✅ Task CRUD: getTasks, createTask, updateTask, assignTask, completeTask, failTask
   - ✅ Wave field: `tasks.wave_number` exists in schema
   - ✅ Execution order: `tasks.execution_order` field exists
   - ✅ Pending tasks query: `getPendingTasks()` filters by dependencies
   - ❌ **Gap:** No automatic wave calculation on task creation

4. **Orchestrator Tick Loop** (`parent-harness/orchestrator/src/orchestrator/index.ts`)
   - ✅ Runs every 30 seconds (TICK_INTERVAL_MS)
   - ✅ Processes pending tasks in `tick()` function
   - ✅ Assigns tasks to agents via spawner
   - ❌ **Gap:** No wave/lane generation logic in tick loop

5. **File Impact Analyzer** (`server/services/task-agent/file-impact-analyzer.ts`)
   - ✅ File conflict detection logic exists
   - ✅ Pattern matching: Estimates which files tasks will modify
   - ✅ Historical patterns: Learns from validated predictions
   - ❌ **Gap:** Not integrated with wave/lane generation for conflict prevention

### Integration Points

```
Task Created/Updated
    ↓
Auto-Generate Wave/Lane
    ↓ (uses)
Dependency Analysis (wave_runs.planWaves)
File Impact Analysis (file-impact-analyzer.ts)
Priority Mapping (P0-P4 → wave 1-5)
Category Mapping (feature/bug/test → lane)
    ↓
Persist to Database
    ↓
Update wave_runs, waves tables
Set tasks.wave_number, tasks.execution_order
    ↓
Broadcast via WebSocket
    ↓
Dashboard Updates in Real-Time
```

---

## Requirements

### Functional Requirements

**FR-1: Automatic Wave Generation**

- MUST generate wave assignments when tasks are created or dependencies change
- MUST use topological sort to respect task dependencies (existing `planWaves()` logic)
- MUST assign wave numbers based on priority + dependencies:
  - Tasks with no dependencies: wave = priority level (P0→1, P1→2, etc.)
  - Tasks with dependencies: wave = max(dep_wave) + 1
- MUST update `tasks.wave_number` field when wave is calculated
- MUST create/update `wave_runs` and `waves` tables
- MUST handle circular dependencies gracefully (log warning, break cycle)

**FR-2: Automatic Lane Assignment**

- MUST assign lane based on task category:
  - feature → "api"
  - bug → "types"
  - documentation → "ui"
  - test → "tests"
  - infrastructure → "infrastructure"
  - (other categories map to "api" as default)
- MUST persist lane assignments to enable filtering/grouping
- SHOULD extend schema with `tasks.lane` field (TEXT)
- MUST include lane in wave generation for visualization

**FR-3: Conflict Detection**

- MUST detect file conflicts between tasks in same wave
- MUST use file impact analyzer to predict file modifications
- MUST prevent parallel execution if tasks modify same file
- SHOULD push conflicting tasks to next wave
- MUST log conflict warnings with affected tasks and files
- SHOULD update conflict metadata in database

**FR-4: Queue Persistence**

- MUST persist task queue state to survive orchestrator restarts
- MUST maintain wave run state (planning/running/completed/failed/cancelled)
- MUST restore queue on orchestrator startup
- MUST resume incomplete wave runs after restart
- SHOULD expose queue status via API endpoint

**FR-5: Real-Time Updates**

- MUST broadcast wave updates via WebSocket
- MUST emit events: `wave:planned`, `wave:started`, `wave:completed`, `task:wave_assigned`
- MUST include wave/lane data in task events
- SHOULD batch updates to prevent spam (max 1 update per second per wave)

### Non-Functional Requirements

**NFR-1: Performance**

- Wave generation MUST complete within 500ms for 100 tasks
- Dependency analysis MUST use efficient topological sort (O(V+E))
- Database queries MUST use indexes on wave_number, lane, priority
- File conflict detection SHOULD be async (don't block task creation)

**NFR-2: Reliability**

- Wave generation MUST be idempotent (same input → same output)
- Failed wave generation MUST NOT corrupt task state
- Partial failures MUST rollback transaction
- Queue state MUST survive orchestrator crashes

**NFR-3: Observability**

- MUST log wave generation events with task count, wave count, duration
- MUST track wave progress metrics (total/completed/running/blocked)
- SHOULD expose metrics: avg wave size, parallelism factor, conflict rate
- MUST emit structured logs for debugging

**NFR-4: Maintainability**

- MUST reuse existing `waves/index.ts` logic (don't duplicate)
- MUST integrate cleanly with orchestrator tick loop
- SHOULD separate concerns: generation, persistence, broadcasting
- MUST include comprehensive TypeScript types

---

## Technical Design

### Database Schema Changes

**Extend tasks table:**

```sql
ALTER TABLE tasks ADD COLUMN lane TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane);
CREATE INDEX IF NOT EXISTS idx_tasks_wave_lane ON tasks(wave_number, lane);
```

**New table: task_conflicts (optional, for conflict tracking)**

```sql
CREATE TABLE IF NOT EXISTS task_conflicts (
  id TEXT PRIMARY KEY,
  wave_run_id TEXT NOT NULL,
  task_a_id TEXT NOT NULL,
  task_b_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL, -- 'file_overlap', 'dependency_cycle'
  conflict_details TEXT, -- JSON: { files: [], reason: '' }
  resolution TEXT, -- 'moved_wave', 'manual_review', 'ignored'
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT DEFAULT NULL,
  FOREIGN KEY (wave_run_id) REFERENCES wave_runs(id),
  FOREIGN KEY (task_a_id) REFERENCES tasks(id),
  FOREIGN KEY (task_b_id) REFERENCES tasks(id)
);
```

### Architecture

**New Module: `parent-harness/orchestrator/src/queue/index.ts`**

```typescript
/**
 * Task Queue Management
 *
 * Manages persistent task queue with automatic wave/lane generation.
 */

export interface QueueConfig {
  autoGenerateWaves: boolean;
  conflictDetection: boolean;
  maxWaveSize: number;
  batchUpdates: boolean;
}

export interface QueueState {
  totalTasks: number;
  pendingTasks: number;
  activeWaveRun: string | null;
  currentWave: number;
  totalWaves: number;
}

// Initialize queue system
export function initQueue(config: QueueConfig): void;

// Generate waves for task list or individual task
export function generateWaves(taskListId: string): WaveRun;
export function assignTaskWave(taskId: string): void;

// Assign lane based on category
export function assignTaskLane(taskId: string): void;

// Detect conflicts in wave
export function detectConflicts(waveId: string): TaskConflict[];

// Get queue state
export function getQueueState(taskListId?: string): QueueState;

// Restore queue on startup
export function restoreQueue(): void;
```

**Integration: `parent-harness/orchestrator/src/orchestrator/index.ts`**

```typescript
import * as queue from "../queue/index.js";

async function tick(): Promise<void> {
  // ... existing logic ...

  // Auto-generate waves for pending tasks
  if (config.autoGenerateWaves) {
    const pendingTasks = tasks.getPendingTasks();
    if (pendingTasks.length > 0) {
      // Check if we need to regenerate waves
      const needsRegeneration =
        await queue.needsWaveRegeneration("default-task-list");
      if (needsRegeneration) {
        await queue.generateWaves("default-task-list");
      }
    }
  }

  // Check wave completion and advance
  const activeRun = await queue.getActiveWaveRun("default-task-list");
  if (activeRun) {
    waves.checkWaveCompletion(activeRun.id);
  }

  // ... rest of tick logic ...
}
```

**WebSocket Events:**

```typescript
// New event types
ws.broadcast({
  type: 'wave:planned',
  runId: string,
  taskListId: string,
  totalWaves: number,
  totalTasks: number,
});

ws.broadcast({
  type: 'wave:started',
  runId: string,
  waveNumber: number,
  taskIds: string[],
});

ws.broadcast({
  type: 'task:wave_assigned',
  taskId: string,
  waveNumber: number,
  lane: string,
});

ws.broadcast({
  type: 'conflict:detected',
  waveId: string,
  conflictType: string,
  taskIds: string[],
  details: object,
});
```

### File Impact Integration

```typescript
import * as fileImpact from "../../../server/services/task-agent/file-impact-analyzer.js";

async function detectFileConflicts(waveId: string): Promise<TaskConflict[]> {
  const wave = waves.getWave(waveId);
  const taskIds = wave.task_ids;

  // Get file impacts for all tasks in wave
  const impactsByTask = new Map();
  for (const taskId of taskIds) {
    const impacts = await fileImpact.getFileImpacts(taskId);
    if (impacts.length === 0) {
      // Estimate if not yet analyzed
      const task = tasks.getTask(taskId);
      impacts = await fileImpact.estimateFileImpacts(
        taskId,
        task.title,
        task.description,
        task.category,
      );
    }
    impactsByTask.set(taskId, impacts);
  }

  // Detect overlapping files
  const conflicts: TaskConflict[] = [];
  const fileToTasks = new Map<string, string[]>();

  for (const [taskId, impacts] of impactsByTask) {
    for (const impact of impacts) {
      if (impact.operation === "UPDATE" || impact.operation === "DELETE") {
        if (!fileToTasks.has(impact.filePath)) {
          fileToTasks.set(impact.filePath, []);
        }
        fileToTasks.get(impact.filePath)!.push(taskId);
      }
    }
  }

  for (const [file, taskIds] of fileToTasks) {
    if (taskIds.length > 1) {
      conflicts.push({
        id: uuidv4(),
        waveId,
        taskIds,
        conflictType: "file_overlap",
        conflictDetails: JSON.stringify({ file, taskIds }),
      });
    }
  }

  return conflicts;
}
```

### Wave Generation Algorithm

```typescript
/**
 * Enhanced wave planning with lanes and conflict detection
 */
async function enhancedPlanWaves(taskListId: string): Promise<WaveRun> {
  // 1. Use existing dependency-based wave generation
  const waveRun = waves.planWaves(taskListId);

  // 2. Assign lanes based on category
  const allTasks = tasks.getTasks({ taskListId });
  for (const task of allTasks) {
    const lane = CATEGORY_TO_LANE[task.category] || "api";
    tasks.updateTask(task.id, { lane } as any);
  }

  // 3. Detect file conflicts in each wave
  if (config.conflictDetection) {
    const waveList = waves.getWaves(waveRun.id);
    for (const wave of waveList) {
      const conflicts = await detectFileConflicts(wave.id);

      if (conflicts.length > 0) {
        // Move conflicting tasks to next wave
        for (const conflict of conflicts) {
          const [taskA, ...otherTasks] = conflict.taskIds;
          // Keep first task, move others
          for (const taskId of otherTasks) {
            const currentWave = wave.wave_number;
            tasks.updateTask(taskId, { wave_number: currentWave + 1 } as any);
          }

          // Log conflict
          console.warn(
            `⚠️ File conflict detected in wave ${wave.wave_number}:`,
            conflict,
          );
          await recordConflict(waveRun.id, conflict);
        }
      }
    }

    // Regenerate waves if conflicts were moved
    if (conflicts.length > 0) {
      return waves.planWaves(taskListId); // Recalculate with new assignments
    }
  }

  // 4. Broadcast wave plan
  ws.broadcast({
    type: "wave:planned",
    runId: waveRun.id,
    taskListId,
    totalWaves: waveRun.total_waves,
    totalTasks: allTasks.length,
  });

  return waveRun;
}
```

### Startup Queue Restoration

```typescript
/**
 * Restore queue state on orchestrator startup
 */
async function restoreQueue(): Promise<void> {
  console.log("📋 Restoring task queue...");

  // Find active wave runs
  const activeRuns = db.query<WaveRun>(
    `SELECT * FROM wave_runs
     WHERE status IN ('planning', 'running')
     ORDER BY created_at ASC`,
  );

  for (const run of activeRuns) {
    const currentWave = waves.getOne<Wave>(
      `SELECT * FROM waves
       WHERE run_id = ? AND status = 'running'`,
      [run.id],
    );

    if (currentWave) {
      console.log(
        `   ↳ Resuming wave run ${run.id}, wave ${currentWave.wave_number}`,
      );

      // Check if wave tasks are still active
      const taskIds = JSON.parse(currentWave.task_ids);
      const taskStatuses = tasks
        .getTasks({})
        .filter((t) => taskIds.includes(t.id));
      const allDone = taskStatuses.every(
        (t) => t.status === "completed" || t.status === "failed",
      );

      if (allDone) {
        // Advance to next wave
        waves.checkWaveCompletion(run.id);
      }
    } else if (run.status === "planning") {
      // Complete planning
      console.log(`   ↳ Resuming wave planning for ${run.id}`);
      waves.startWaveRun(run.id);
    }
  }

  console.log(`✅ Restored ${activeRuns.length} active wave runs`);
}

// Call in startOrchestrator()
export async function startOrchestrator(): Promise<void> {
  // ... existing setup ...

  // Restore queue
  await queue.restoreQueue();

  // ... start tick loop ...
}
```

---

## Pass Criteria

### Implementation Completeness

1. ✅ **Queue module created** - `parent-harness/orchestrator/src/queue/index.ts` exists with all exported functions
2. ✅ **Database schema updated** - `tasks.lane` column added, indexes created
3. ✅ **Orchestrator integration** - tick() calls wave generation when needed
4. ✅ **Wave auto-generation** - New tasks automatically get wave/lane assignments
5. ✅ **Conflict detection** - File overlaps detected and tasks moved to separate waves
6. ✅ **Queue persistence** - Wave runs survive orchestrator restarts
7. ✅ **WebSocket events** - wave:planned, wave:started, task:wave_assigned emitted
8. ✅ **Startup restoration** - restoreQueue() resumes active wave runs

### Functional Validation

9. ✅ **Dependency resolution** - Tasks respect dependencies (child after parent)
10. ✅ **Priority mapping** - P0→wave 1, P1→wave 2, etc. (with dependency offsets)
11. ✅ **Category lanes** - feature→api, bug→types, test→tests mapping works
12. ✅ **Conflict prevention** - Tasks modifying same file cannot run in parallel
13. ✅ **Wave progression** - Orchestrator advances waves when complete
14. ✅ **Queue metrics** - getQueueState() returns accurate counts

### Testing

15. ✅ **Unit tests** - queue module functions tested in isolation
16. ✅ **Integration test** - Create 10 tasks → verify wave generation → verify assignments
17. ✅ **Conflict test** - Create 2 tasks modifying same file → verify moved to separate waves
18. ✅ **Restart test** - Start wave run → kill orchestrator → restart → verify resumption
19. ✅ **Dashboard test** - Create tasks → verify dashboard shows waves/lanes in real-time

### Performance

20. ✅ **Generation speed** - 100 tasks generate waves in <500ms
21. ✅ **No blocking** - Wave generation doesn't block task creation (async)

---

## Dependencies

**Upstream (Must Complete First):**

- ✅ PHASE2-TASK-01: Spec Agent v0.1 (COMPLETED)
- ✅ Wave system (`waves/index.ts`) exists
- ✅ Task database with wave_number field exists

**Downstream (Depends on This):**

- PHASE3-TASK-02: Dashboard wave/lane visualization
- PHASE3-TASK-03: Real-time task assignment coordination
- PHASE5-TASK-01: Parallel execution engine

**Parallel Work (Can Develop Concurrently):**

- PHASE3-TASK-04: Session state tracking
- PHASE3-TASK-05: Agent health monitoring

---

## Implementation Plan

### Phase 1: Core Queue Module (2 hours)

1. Create `queue/index.ts` with TypeScript types
2. Implement `generateWaves()` wrapper around existing `planWaves()`
3. Implement `assignTaskLane()` using category mapping
4. Add database migration for `tasks.lane` column
5. Write unit tests for queue module

### Phase 2: Conflict Detection (2 hours)

6. Implement `detectFileConflicts()` using file-impact-analyzer
7. Add logic to move conflicting tasks to next wave
8. Create `task_conflicts` table (optional)
9. Add conflict logging and metrics
10. Write tests for conflict detection

### Phase 3: Orchestrator Integration (1.5 hours)

11. Add queue initialization to `startOrchestrator()`
12. Implement `restoreQueue()` for startup restoration
13. Add wave generation check to tick loop
14. Add wave completion check to tick loop
15. Test orchestrator integration end-to-end

### Phase 4: WebSocket Events (1 hour)

16. Define new event types in websocket.ts
17. Emit wave:planned when waves generated
18. Emit wave:started when wave begins
19. Emit task:wave_assigned when task assigned
20. Test dashboard receives events

### Phase 5: Testing & Documentation (1.5 hours)

21. Write integration tests (create tasks → verify waves)
22. Write restart test (start → kill → restart → verify)
23. Update CLAUDE.md with queue usage
24. Add metrics logging for monitoring
25. Performance test with 100 tasks

**Total Estimated Effort:** 8 hours

---

## Testing Strategy

### Unit Tests

```typescript
// queue/index.test.ts
describe("Queue Management", () => {
  test("generateWaves respects dependencies", () => {
    // Create 3 tasks: A, B→A, C→B
    // Verify: A=wave 1, B=wave 2, C=wave 3
  });

  test("assignTaskLane maps categories correctly", () => {
    // Create tasks with different categories
    // Verify lane assignments match mapping
  });

  test("detectConflicts finds file overlaps", () => {
    // Create 2 tasks modifying same file
    // Verify conflict detected
  });
});
```

### Integration Tests

```typescript
// orchestrator/queue-integration.test.ts
describe("Queue Integration", () => {
  test("new tasks auto-generate waves", async () => {
    // Create 5 tasks with varying priorities
    // Wait for orchestrator tick
    // Verify wave_number and lane assigned
  });

  test("conflicts move tasks to next wave", async () => {
    // Create 2 P0 tasks modifying database/schema.ts
    // Trigger wave generation
    // Verify one task in wave 1, other in wave 2
  });

  test("queue restores after restart", async () => {
    // Start wave run
    // Stop orchestrator
    // Restart orchestrator
    // Verify wave run resumed
  });
});
```

### Manual Testing

1. **Dashboard Visualization:**
   - Create 10 tasks via API
   - Open dashboard
   - Verify waves/lanes appear
   - Verify real-time updates as tasks complete

2. **Conflict Prevention:**
   - Create tasks: "Update schema" (modifies db/schema.sql)
   - Create task: "Add migration" (modifies db/migrations/\*.sql)
   - Verify both don't run in parallel

3. **Restart Resilience:**
   - Start orchestrator with HARNESS_SPAWN_AGENTS=true
   - Create 5 tasks
   - Kill orchestrator (Ctrl+C)
   - Restart orchestrator
   - Verify tasks still queued, waves resumed

---

## Rollback Plan

If implementation fails or causes instability:

1. **Disable auto-generation:**
   - Add feature flag: `HARNESS_AUTO_WAVES=false`
   - Orchestrator skips queue logic if disabled
   - API endpoints still work for manual wave creation

2. **Revert database changes:**
   - `ALTER TABLE tasks DROP COLUMN lane;`
   - Wave tables already use IF NOT EXISTS, safe to keep

3. **Remove queue module:**
   - Delete `queue/index.ts`
   - Remove import from orchestrator
   - System falls back to manual wave management

---

## Success Metrics

**Operational Metrics:**

- Queue restoration time: <1 second
- Wave generation time: <500ms for 100 tasks
- Conflict detection accuracy: >90%
- False positive rate: <5%

**Usage Metrics:**

- % of tasks with wave assignment: >95%
- % of waves with conflicts: <10%
- Avg parallelism factor: >3 tasks per wave
- Queue uptime: >99%

**Quality Metrics:**

- Zero data loss during restarts
- Zero invalid state transitions
- 100% test pass rate
- TypeScript compilation success

---

## Future Enhancements (Out of Scope)

1. **Dynamic wave adjustment** - Rebalance waves based on agent availability
2. **Priority boost** - Promote urgent tasks to earlier waves
3. **Conflict resolution strategies** - User-configurable (serialize, parallelize with caution, block)
4. **Multi-tenant queues** - Separate queues per user/project
5. **Wave size limits** - Prevent waves with >10 tasks (split into sub-waves)
6. **Historical analytics** - Track wave execution trends over time

---

## References

- STRATEGIC_PLAN.md: Phase 5 orchestrator requirements
- `parent-harness/orchestrator/src/waves/index.ts`: Existing wave system
- `parent-harness/dashboard/src/utils/task-pipeline.ts`: Client-side wave/lane utils
- `server/services/task-agent/file-impact-analyzer.ts`: Conflict detection logic
- PHASE2-TASK-04: Task state machine specification
