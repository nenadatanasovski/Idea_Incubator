# PHASE3-TASK-01: Task Queue Persistence with Proper Wave/Lane Generation

**Status:** Specification
**Priority:** P1 (Phase 3 Core Infrastructure)
**Effort:** Medium
**Created:** 2026-02-08

---

## Overview

Implement comprehensive task queue persistence with proper wave/lane generation to enable reliable task execution across orchestrator restarts. The system provides persistent queue storage, automatic wave number calculation based on dependency graphs, lane assignment for parallel execution, and robust state recovery to ensure the orchestrator can resume work seamlessly after crashes or intentional restarts.

**Problem:** Current wave/lane generation is implemented in the dashboard frontend as a utility function that analyzes tasks client-side. The orchestrator has database schema columns (`wave_number`, `execution_order`) but no systematic queue persistence layer. Tasks can be created but wave numbers are set manually or not at all, making it difficult to ensure reliable parallel execution and recovery after restarts.

**Solution:** Backend-driven wave/lane calculation using topological sorting of task dependencies, persistent queue storage in the database, automatic wave number assignment during task creation, and queue recovery mechanisms that restore execution state on orchestrator startup.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Wave Execution System** (`parent-harness/orchestrator/src/waves/index.ts`)
   - ✅ Wave runs: Tracks execution of task waves with status (planning, running, completed, failed)
   - ✅ Wave tables: `wave_runs` and `waves` tables with proper schema
   - ✅ Dependency analysis: `planWaves()` uses topological sort to assign wave numbers
   - ✅ Wave progression: Automatically advances from wave N to wave N+1 when all tasks complete
   - ✅ Task grouping: Groups independent tasks into same wave for parallel execution
   - ✅ Database persistence: Wave runs and waves persisted with task_ids as JSON
   - ⚠️ **Limitation:** Requires explicit `planWaves(taskListId)` call - not automatic
   - ⚠️ **Limitation:** Wave numbers written to tasks but not always set during creation

2. **Task Database Schema** (`parent-harness/orchestrator/src/db/tasks.ts`)
   - ✅ Schema fields: `wave_number`, `execution_order` columns exist
   - ✅ `createTask()`: Accepts optional `wave_number` parameter
   - ✅ `updateTask()`: Can update wave_number (though not exposed in type)
   - ✅ `getPendingTasks()`: Returns tasks with no incomplete dependencies
   - ✅ Task relationships: `task_relationships` table with `depends_on` type
   - ❌ **Gap:** No automatic wave number calculation during task creation
   - ❌ **Gap:** `execution_order` column exists but never populated

3. **Frontend Wave/Lane Generation** (`parent-harness/dashboard/src/utils/task-pipeline.ts`)
   - ✅ `generateWavesFromTasks()`: Client-side wave analysis based on priority
   - ✅ `generateLanesFromTasks()`: Groups tasks by category into lanes
   - ✅ Priority mapping: P0→Wave 1, P1→Wave 2, P2→Wave 3, etc.
   - ✅ Category mapping: feature→api, bug→types, test→tests, etc.
   - ✅ Status aggregation: Calculates running/completed/blocked counts per wave
   - ❌ **Gap:** This is view-only logic - doesn't persist or drive execution

4. **Task State Machine** (`parent-harness/orchestrator/src/events/task-state-machine.ts`)
   - ✅ State transitions: Validates pending→in_progress→pending_verification→completed
   - ✅ Event emission: Broadcasts task state changes via event bus
   - ✅ State history: Logs all transitions to `task_state_history` table
   - ❌ **Gap:** No integration with wave/queue management

5. **Orchestrator Tick Loop** (`parent-harness/orchestrator/src/orchestrator/index.ts`)
   - ✅ Task assignment: `assignPendingTasks()` assigns pending tasks to idle agents
   - ✅ Dependency checking: Uses `getPendingTasks()` which filters by dependencies
   - ✅ Wave checking: After task completion, checks `checkWaveCompletion()`
   - ❌ **Gap:** No automatic queue initialization on startup
   - ❌ **Gap:** No queue recovery mechanism

6. **Task Queue Persistence Tests** (`tests/task-queue-persistence.test.ts`)
   - ✅ Test suite exists for main Idea Incubator `task_queue` table
   - ✅ Tests persistence: Queue saved to database, restored on restart
   - ✅ Tests priority ordering: Tasks sorted by priority in queue
   - ⚠️ **Note:** These tests are for Idea Incubator's task executor, not Parent Harness orchestrator

### Architecture Gap Analysis

| Component | Current State | Missing Pieces | Impact |
|-----------|--------------|----------------|--------|
| Wave Planning | ✅ Implemented | ❌ Not automatic | Manual calls required |
| Wave Number Assignment | ⚠️ Partial | ❌ Not during creation | Inconsistent wave numbers |
| Execution Order | ❌ Column unused | ❌ No population logic | Can't enforce serial tasks within wave |
| Queue Recovery | ❌ Not implemented | ❌ No startup init | Loses state on restart |
| Lane Assignment | ✅ Frontend only | ❌ No backend logic | Can't use for scheduling |
| Dependency Resolution | ✅ Working | ❌ Not integrated with creation | Must run separately |

---

## Requirements

### Functional Requirements

**FR-1: Automatic Wave Number Assignment**
- All tasks MUST have wave numbers assigned during creation or import
- Wave numbers calculated via topological sort of dependency graph
- Tasks with no dependencies assigned to wave 0
- Tasks with dependencies assigned to MAX(dependency_waves) + 1
- Circular dependencies detected and rejected with clear error
- Wave numbers persisted to `tasks.wave_number` column

**FR-2: Execution Order Within Waves**
- Tasks within the same wave MAY have execution_order to enforce serial execution
- Execution order determined by:
  - Priority (P0 before P1 before P2, etc.)
  - Creation timestamp (older tasks first)
  - Category grouping (related tasks together)
- Execution order persisted to `tasks.execution_order` column
- Tasks without execution_order can run in any order (default parallel behavior)

**FR-3: Lane Assignment for Parallel Execution**
- Each task assigned to a lane based on category
- Lane mapping:
  - `feature` → `api` lane
  - `bug` → `types` lane
  - `documentation` → `ui` lane
  - `test` → `tests` lane
  - `infrastructure` → `infrastructure` lane
  - Default → `general` lane
- Lane assignment stored in new `tasks.lane` column (TEXT, nullable)
- Multiple tasks in same lane can run in parallel (no lane conflicts)

**FR-4: Queue Initialization on Startup**
- Orchestrator MUST initialize queue state on startup
- Load all incomplete tasks (status != 'completed')
- Calculate missing wave numbers for tasks without them
- Restore active wave runs that were interrupted
- Resume wave execution from last checkpoint
- Log recovery summary: X tasks restored, Y waves active

**FR-5: Queue Persistence During Execution**
- All queue state changes MUST persist to database immediately
- Wave number changes logged to state history
- Execution order changes logged to state history
- Task completion triggers wave completion check
- Wave completion triggers next wave activation

**FR-6: Wave Run Recovery**
- Orchestrator can resume incomplete wave runs after restart
- Wave run status (planning, running) restored from database
- Current wave number restored
- Pending waves in the run automatically scheduled
- Failed/cancelled runs can be restarted or archived

**FR-7: Task List to Wave Run Mapping**
- Creating a task list automatically triggers wave planning
- Each task list can have multiple wave runs (historical)
- Active wave run tracked per task list
- Only one active wave run per task list at a time

### Non-Functional Requirements

**NFR-1: Performance**
- Wave calculation for 100 tasks: < 500ms
- Queue initialization on startup: < 2 seconds for 1000 tasks
- Database writes batched where possible (insert multiple tasks in transaction)
- Topological sort optimized with memoization

**NFR-2: Reliability**
- Database ACID guarantees ensure consistency
- Foreign key constraints prevent orphaned records
- Transactions used for multi-step operations
- Graceful degradation if wave calculation fails (tasks still executable individually)

**NFR-3: Observability**
- Wave planning logs task counts per wave
- Queue recovery logs restored task/wave counts
- State transitions logged to state history table
- WebSocket broadcasts wave/queue events to dashboard
- Metrics tracked: avg tasks per wave, wave completion time, queue depth

**NFR-4: Maintainability**
- Wave/lane logic centralized in one module
- Frontend utilities simplified to read from database
- Clear separation: backend calculates, frontend displays
- Migration path for existing tasks without wave numbers

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Startup                      │
│  1. Load all tasks (status != 'completed')                  │
│  2. Initialize QueueManager                                 │
│  3. Restore incomplete wave runs                            │
│  4. Calculate missing wave numbers                          │
│  5. Resume execution from checkpoint                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     QueueManager Module                      │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────┐           │
│  │  Wave Calculator   │  │  Lane Assigner      │           │
│  │ - Topological sort │  │ - Category mapping  │           │
│  │ - Dependency graph │  │ - Conflict detection│           │
│  │ - Cycle detection  │  │ - Parallel grouping │           │
│  └────────────────────┘  └─────────────────────┘           │
│                                                              │
│  ┌────────────────────┐  ┌─────────────────────┐           │
│  │ Execution Orderer  │  │  Queue Persistence  │           │
│  │ - Priority sort    │  │ - Database writes   │           │
│  │ - Timestamp order  │  │ - State recovery    │           │
│  │ - Category group   │  │ - Event emission    │           │
│  └────────────────────┘  └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Tables                           │
│                                                              │
│  tasks (wave_number, execution_order, lane)                 │
│  wave_runs (task_list_id, status, current_wave)            │
│  waves (run_id, wave_number, task_ids, status)             │
│  task_relationships (source_task_id, target_task_id)       │
│  task_state_history (state transition audit log)           │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

**1. Add `lane` column to tasks table**

```sql
-- Migration: 002_add_lane_column.sql
ALTER TABLE tasks ADD COLUMN lane TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane);
```

**2. Ensure indexes for query performance**

```sql
-- Migration: 003_queue_indexes.sql
CREATE INDEX IF NOT EXISTS idx_tasks_wave_number ON tasks(wave_number);
CREATE INDEX IF NOT EXISTS idx_tasks_execution_order ON tasks(execution_order);
CREATE INDEX IF NOT EXISTS idx_tasks_status_wave ON tasks(status, wave_number);
CREATE INDEX IF NOT EXISTS idx_wave_runs_active ON wave_runs(task_list_id, status) WHERE status IN ('planning', 'running');
```

### Core Module: QueueManager

**Location:** `parent-harness/orchestrator/src/queue/index.ts`

```typescript
import * as tasks from '../db/tasks.js';
import * as waves from '../waves/index.js';
import { query, run } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { bus } from '../events/bus.js';

export interface QueueConfig {
  autoCalculateWaves: boolean;
  autoAssignLanes: boolean;
  enableExecutionOrder: boolean;
}

export interface QueueStats {
  totalTasks: number;
  queuedTasks: number;
  runningTasks: number;
  completedTasks: number;
  wavesCount: number;
  currentWave: number;
  tasksPerWave: Record<number, number>;
}

/**
 * Lane category mapping
 */
const CATEGORY_TO_LANE: Record<string, string> = {
  feature: 'api',
  bug: 'types',
  documentation: 'ui',
  test: 'tests',
  infrastructure: 'infrastructure',
};

/**
 * Priority to wave offset (used as fallback if no dependencies)
 */
const PRIORITY_TO_WAVE_OFFSET: Record<string, number> = {
  P0: 0,
  P1: 0,
  P2: 1,
  P3: 2,
  P4: 3,
};

/**
 * Calculate wave numbers for tasks using topological sort
 */
export function calculateWaveNumbers(taskIds: string[]): Map<string, number> {
  const taskSet = new Set(taskIds);

  // Get all dependency relationships for these tasks
  const dependencies = query<{ source_task_id: string; target_task_id: string }>(
    `SELECT source_task_id, target_task_id
     FROM task_relationships
     WHERE relationship_type = 'depends_on'
     AND source_task_id IN (${taskIds.map(() => '?').join(',')})`,
    taskIds
  );

  // Build dependency map
  const dependsOn = new Map<string, Set<string>>();
  for (const dep of dependencies) {
    if (!dependsOn.has(dep.source_task_id)) {
      dependsOn.set(dep.source_task_id, new Set());
    }
    dependsOn.get(dep.source_task_id)!.add(dep.target_task_id);
  }

  // Calculate wave numbers using topological sort with memoization
  const waveAssignments = new Map<string, number>();
  const visited = new Set<string>();
  const inProgress = new Set<string>();

  function getWaveNumber(taskId: string): number {
    if (waveAssignments.has(taskId)) {
      return waveAssignments.get(taskId)!;
    }

    if (inProgress.has(taskId)) {
      // Cycle detected
      throw new Error(`Circular dependency detected involving task ${taskId}`);
    }

    inProgress.add(taskId);

    const deps = dependsOn.get(taskId);
    if (!deps || deps.size === 0) {
      // No dependencies - assign to wave 0
      waveAssignments.set(taskId, 0);
      inProgress.delete(taskId);
      return 0;
    }

    // Get max wave of all dependencies
    let maxDepWave = -1;
    for (const depId of deps) {
      // Skip dependencies not in our task set (external dependencies)
      if (!taskSet.has(depId)) continue;
      maxDepWave = Math.max(maxDepWave, getWaveNumber(depId));
    }

    const wave = maxDepWave + 1;
    waveAssignments.set(taskId, wave);
    inProgress.delete(taskId);
    return wave;
  }

  // Calculate wave for each task
  for (const taskId of taskIds) {
    if (!waveAssignments.has(taskId)) {
      getWaveNumber(taskId);
    }
  }

  return waveAssignments;
}

/**
 * Assign lane to a task based on category
 */
export function assignLane(category: string | null): string {
  if (!category) return 'general';
  return CATEGORY_TO_LANE[category] || 'general';
}

/**
 * Calculate execution order within a wave
 */
export function calculateExecutionOrder(
  tasksInWave: Array<{ id: string; priority: string; created_at: string; category: string | null }>
): Map<string, number> {
  // Sort by: priority (P0 first), then category (group similar), then creation time
  const sorted = tasksInWave.sort((a, b) => {
    // Priority comparison
    const priorityA = a.priority || 'P2';
    const priorityB = b.priority || 'P2';
    if (priorityA !== priorityB) {
      return priorityA.localeCompare(priorityB);
    }

    // Category comparison (group related tasks)
    const categoryA = a.category || 'zzz';
    const categoryB = b.category || 'zzz';
    if (categoryA !== categoryB) {
      return categoryA.localeCompare(categoryB);
    }

    // Creation time comparison
    return a.created_at.localeCompare(b.created_at);
  });

  const executionOrders = new Map<string, number>();
  sorted.forEach((task, index) => {
    executionOrders.set(task.id, index);
  });

  return executionOrders;
}

/**
 * Process new tasks: calculate waves, assign lanes, set execution order
 */
export async function processNewTasks(taskIds: string[]): Promise<void> {
  if (taskIds.length === 0) return;

  console.log(`🔄 Processing ${taskIds.length} new tasks for queue...`);

  // Calculate wave numbers
  let waveAssignments: Map<string, number>;
  try {
    waveAssignments = calculateWaveNumbers(taskIds);
  } catch (err) {
    console.error('❌ Failed to calculate wave numbers:', err);
    // Assign all to wave 0 as fallback
    waveAssignments = new Map(taskIds.map(id => [id, 0]));
  }

  // Group tasks by wave
  const tasksByWave = new Map<number, string[]>();
  for (const [taskId, wave] of waveAssignments.entries()) {
    if (!tasksByWave.has(wave)) {
      tasksByWave.set(wave, []);
    }
    tasksByWave.get(wave)!.push(taskId);
  }

  // Update tasks with wave numbers, lanes, and execution order
  for (const [wave, waveTaskIds] of tasksByWave.entries()) {
    // Get full task details for execution order calculation
    const waveTasks = tasks.getTasks({}).filter(t => waveTaskIds.includes(t.id));
    const executionOrders = calculateExecutionOrder(waveTasks);

    for (const task of waveTasks) {
      const lane = assignLane(task.category);
      const executionOrder = executionOrders.get(task.id)!;

      run(
        `UPDATE tasks
         SET wave_number = ?, lane = ?, execution_order = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [wave, lane, executionOrder, task.id]
      );
    }
  }

  console.log(`✅ Processed tasks: ${tasksByWave.size} waves, ${taskIds.length} tasks`);

  // Emit event
  bus.emit('queue:tasks_processed', {
    taskIds,
    wavesCount: tasksByWave.size,
    tasksPerWave: Object.fromEntries(
      Array.from(tasksByWave.entries()).map(([wave, ids]) => [wave, ids.length])
    ),
  });
}

/**
 * Initialize queue on orchestrator startup
 * - Finds tasks without wave numbers and processes them
 * - Restores active wave runs
 */
export async function initializeQueue(): Promise<QueueStats> {
  console.log('🚀 Initializing task queue...');

  // Find tasks without wave numbers
  const tasksWithoutWaves = query<{ id: string }>(
    `SELECT id FROM tasks WHERE wave_number IS NULL AND status != 'completed'`
  );

  if (tasksWithoutWaves.length > 0) {
    console.log(`📋 Found ${tasksWithoutWaves.length} tasks without wave numbers`);
    await processNewTasks(tasksWithoutWaves.map(t => t.id));
  }

  // Restore active wave runs
  const activeRuns = query<{ id: string; task_list_id: string; current_wave: number }>(
    `SELECT id, task_list_id, current_wave
     FROM wave_runs
     WHERE status IN ('planning', 'running')`
  );

  for (const run of activeRuns) {
    console.log(`🌊 Restoring wave run ${run.id} at wave ${run.current_wave}`);
    // Check if current wave is complete
    waves.checkWaveCompletion(run.id);
  }

  // Calculate stats
  const stats = getQueueStats();

  console.log(`✅ Queue initialized: ${stats.totalTasks} tasks, ${stats.wavesCount} waves`);

  return stats;
}

/**
 * Get current queue statistics
 */
export function getQueueStats(): QueueStats {
  const allTasks = tasks.getTasks({});

  const waveGroups = new Map<number, number>();
  let currentWave = 0;

  for (const task of allTasks) {
    if (task.wave_number !== null) {
      const count = waveGroups.get(task.wave_number) || 0;
      waveGroups.set(task.wave_number, count + 1);
      currentWave = Math.max(currentWave, task.wave_number);
    }
  }

  return {
    totalTasks: allTasks.length,
    queuedTasks: allTasks.filter(t => t.status === 'pending').length,
    runningTasks: allTasks.filter(t => t.status === 'in_progress').length,
    completedTasks: allTasks.filter(t => t.status === 'completed').length,
    wavesCount: waveGroups.size,
    currentWave,
    tasksPerWave: Object.fromEntries(waveGroups.entries()),
  };
}

export default {
  calculateWaveNumbers,
  assignLane,
  calculateExecutionOrder,
  processNewTasks,
  initializeQueue,
  getQueueStats,
};
```

### Integration Points

**1. Orchestrator Startup** (`parent-harness/orchestrator/src/orchestrator/index.ts`)

```typescript
import * as queue from '../queue/index.js';

export async function startOrchestrator(): Promise<void> {
  if (isRunning) {
    console.warn('⚠️ Orchestrator already running');
    return;
  }

  isRunning = true;
  console.log('🎯 Orchestrator started');

  // NEW: Initialize queue and restore state
  await queue.initializeQueue();

  // ... existing startup logic
}
```

**2. Task Creation Hook** (`parent-harness/orchestrator/src/db/tasks.ts`)

```typescript
import * as queue from '../queue/index.js';

export function createTask(input: CreateTaskInput & { wave_number?: number }): Task {
  const id = uuidv4();

  // ... existing creation logic

  const task = getTask(id)!;

  // NEW: Process task for wave/lane assignment if not manually set
  if (!input.wave_number) {
    queue.processNewTasks([id]).catch(err =>
      console.warn('Failed to process task for queue:', err)
    );
  }

  return task;
}
```

**3. Task List Planning** (`parent-harness/orchestrator/src/planning/index.ts`)

```typescript
import * as queue from '../queue/index.js';

export async function createTasksFromPlan(plan: TaskPlan): Promise<void> {
  const createdTaskIds: string[] = [];

  // Create all tasks
  for (const taskSpec of plan.tasks) {
    const task = tasks.createTask({
      display_id: taskSpec.id,
      title: taskSpec.title,
      // ... other fields
    });
    createdTaskIds.push(task.id);
  }

  // NEW: Process all tasks in batch for wave assignment
  await queue.processNewTasks(createdTaskIds);

  // Create wave run for execution
  const run = waves.planWaves(plan.taskListId);
  console.log(`📋 Created wave run ${run.id} with ${run.total_waves} waves`);
}
```

**4. Dashboard API** (`parent-harness/orchestrator/src/api/queue.ts` - NEW)

```typescript
import { Router } from 'express';
import * as queue from '../queue/index.js';

export const queueRouter = Router();

/**
 * GET /api/queue/stats
 * Get current queue statistics
 */
queueRouter.get('/stats', (_req, res) => {
  const stats = queue.getQueueStats();
  res.json(stats);
});

/**
 * POST /api/queue/process
 * Manually trigger queue processing for specific tasks
 */
queueRouter.post('/process', async (req, res) => {
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds)) {
    return res.status(400).json({ error: 'taskIds must be an array' });
  }

  await queue.processNewTasks(taskIds);
  res.json({ processed: taskIds.length });
});

/**
 * POST /api/queue/initialize
 * Re-initialize queue (useful for recovery)
 */
queueRouter.post('/initialize', async (_req, res) => {
  const stats = await queue.initializeQueue();
  res.json(stats);
});
```

**5. Frontend Dashboard Updates** (`parent-harness/dashboard/src/utils/task-pipeline.ts`)

```typescript
// SIMPLIFIED - now just reads from database instead of calculating

export function generateWavesFromTasks(tasks: Task[]): Wave[] {
  // Group by wave_number (now comes from database)
  const waveMap = new Map<number, { total: number; completed: number; running: number; blocked: number }>();

  tasks.forEach(task => {
    const waveNum = task.wave_number ?? 0;
    const existing = waveMap.get(waveNum) || { total: 0, completed: 0, running: 0, blocked: 0 };
    existing.total++;
    if (task.status === 'completed') existing.completed++;
    if (task.status === 'in_progress') existing.running++;
    if (task.status === 'blocked') existing.blocked++;
    waveMap.set(waveNum, existing);
  });

  return Array.from(waveMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([waveNum, stats]) => ({
      id: `wave-${waveNum}`,
      waveNumber: waveNum,
      status: stats.completed === stats.total ? 'complete' as const :
              stats.running > 0 ? 'active' as const : 'pending' as const,
      tasksTotal: stats.total,
      tasksCompleted: stats.completed,
      tasksRunning: stats.running,
      tasksBlocked: stats.blocked,
      actualParallelism: stats.running,
    }));
}

export function generateLanesFromTasks(tasks: Task[]): Lane[] {
  // Group by lane (now comes from database)
  const laneMap = new Map<string, { name: string; tasks: Task[] }>();

  tasks.forEach(task => {
    const laneId = task.lane || 'general';
    const existing = laneMap.get(laneId) || {
      name: laneId.charAt(0).toUpperCase() + laneId.slice(1),
      tasks: [],
    };
    existing.tasks.push(task);
    laneMap.set(laneId, existing);
  });

  // ... rest of mapping logic (unchanged)
}
```

---

## Pass Criteria

All criteria must pass for task completion:

**PC-1: Wave Number Calculation**
- ✅ `calculateWaveNumbers()` correctly assigns wave 0 to tasks with no dependencies
- ✅ Tasks depending on wave N tasks are assigned to wave N+1
- ✅ Circular dependencies detected and throw error
- ✅ 100 tasks with complex dependencies processed in < 500ms

**PC-2: Lane Assignment**
- ✅ `assignLane()` maps categories to correct lanes per CATEGORY_TO_LANE
- ✅ Unknown categories default to 'general' lane
- ✅ Lane persisted to `tasks.lane` column

**PC-3: Execution Order**
- ✅ `calculateExecutionOrder()` sorts tasks by priority, category, then creation time
- ✅ Execution order persisted to `tasks.execution_order` column
- ✅ Tasks in same wave have unique execution_order values

**PC-4: Queue Processing**
- ✅ `processNewTasks()` updates all tasks with wave_number, lane, execution_order
- ✅ Database updates succeed in transaction (all or nothing)
- ✅ Event emitted on successful processing

**PC-5: Queue Initialization**
- ✅ `initializeQueue()` finds and processes tasks without wave numbers
- ✅ Active wave runs restored and resumed
- ✅ Initialization completes in < 2s for 1000 tasks
- ✅ Returns accurate QueueStats

**PC-6: Orchestrator Integration**
- ✅ Orchestrator calls `initializeQueue()` on startup
- ✅ New tasks automatically processed for wave assignment
- ✅ Task creation hook does not block (async processing)

**PC-7: Database Schema**
- ✅ Migration adds `lane` column to tasks table
- ✅ Indexes created for wave_number, execution_order, lane
- ✅ Existing data migration runs successfully

**PC-8: API Endpoints**
- ✅ `GET /api/queue/stats` returns current queue statistics
- ✅ `POST /api/queue/process` manually processes task IDs
- ✅ `POST /api/queue/initialize` re-initializes queue

**PC-9: Frontend Updates**
- ✅ `generateWavesFromTasks()` reads wave_number from database
- ✅ `generateLanesFromTasks()` reads lane from database
- ✅ Dashboard correctly displays wave/lane assignments

**PC-10: Error Handling**
- ✅ Circular dependency errors logged and reported
- ✅ Failed queue processing falls back gracefully (wave 0 assignment)
- ✅ Partial failures don't break orchestrator startup

**PC-11: Testing**
- ✅ Unit tests for wave calculation with dependencies
- ✅ Unit tests for lane assignment
- ✅ Unit tests for execution order calculation
- ✅ Integration test: create tasks → verify waves assigned
- ✅ Integration test: restart orchestrator → verify queue restored
- ✅ E2E test: full planning → wave execution → completion

---

## Dependencies

**Blocks:**
- PHASE3-TASK-02: Dashboard Real-time Updates (needs queue stats API)
- PHASE3-TASK-03: Agent Assignment Algorithm (needs wave/lane data)
- PHASE4-TASK-01: Parallel Execution (needs lanes for scheduling)

**Blocked By:**
- None (foundational infrastructure)

**Related:**
- PHASE2-TASK-04: Task State Machine (uses state transitions, shares event bus)
- PHASE2-TASK-01: Spec Agent (creates tasks that need wave assignment)

---

## Implementation Notes

### Migration Strategy

1. **Create migration files:**
   - `002_add_lane_column.sql` - Add lane column
   - `003_queue_indexes.sql` - Add performance indexes

2. **Backfill existing tasks:**
   - Run `initializeQueue()` during first startup after migration
   - Logs which tasks were processed
   - No data loss - idempotent operation

3. **Frontend compatibility:**
   - Old frontend code still works (reads from database)
   - New frontend simplified (no client-side calculation)

### Performance Optimizations

1. **Batch processing:** Process multiple tasks in single transaction
2. **Memoization:** Cache wave numbers during topological sort
3. **Lazy execution:** Wave assignment runs async, doesn't block task creation
4. **Index usage:** All queries use indexes for fast lookups

### Testing Strategy

**Unit Tests:**
```typescript
describe('QueueManager', () => {
  describe('calculateWaveNumbers', () => {
    it('assigns wave 0 to tasks with no dependencies');
    it('assigns wave N+1 to tasks depending on wave N');
    it('throws error on circular dependencies');
    it('handles complex dependency graphs');
  });

  describe('assignLane', () => {
    it('maps categories to correct lanes');
    it('defaults to general lane for unknown categories');
  });

  describe('calculateExecutionOrder', () => {
    it('sorts by priority first');
    it('groups by category second');
    it('sorts by creation time third');
  });
});
```

**Integration Tests:**
```typescript
describe('Queue Persistence', () => {
  it('processes new tasks with wave/lane assignment');
  it('initializes queue on startup');
  it('restores active wave runs');
  it('handles queue recovery after crash');
});
```

**E2E Tests:**
```typescript
describe('End-to-End Queue Flow', () => {
  it('creates task list → assigns waves → executes in order');
  it('restarts orchestrator mid-wave → resumes correctly');
  it('completes wave → advances to next wave');
});
```

### Rollback Plan

If issues discovered post-deployment:

1. **Revert migration:** Drop `lane` column, remove indexes
2. **Disable queue init:** Comment out `initializeQueue()` call
3. **Frontend fallback:** Use old client-side calculation
4. **Wave runs:** Manually create via `planWaves()` API

---

## Success Metrics

**Reliability:**
- ✅ 0 queue state loss incidents after orchestrator restarts
- ✅ 100% wave number assignment success rate (no nulls)

**Performance:**
- ✅ Queue initialization < 2s for 1000 tasks
- ✅ Wave calculation < 500ms for 100 tasks

**Correctness:**
- ✅ 0 circular dependency errors in production
- ✅ 100% correct wave progression (no wave skips)

**Adoption:**
- ✅ Dashboard uses database-driven waves (not client calculation)
- ✅ All new tasks automatically processed

---

## Future Enhancements

**Phase 4+:**
- Dynamic re-planning: Adjust waves when dependencies added/removed
- Wave priority: High-priority waves execute before low-priority
- Lane limits: Max concurrent tasks per lane
- Wave visualization: Dependency graph UI in dashboard
- Queue metrics: Time in queue, wave transition times, bottleneck detection

---

## References

- **Existing Wave System:** `parent-harness/orchestrator/src/waves/index.ts`
- **Task Schema:** `parent-harness/orchestrator/src/db/tasks.ts`
- **Frontend Utils:** `parent-harness/dashboard/src/utils/task-pipeline.ts`
- **Strategic Plan:** `STRATEGIC_PLAN.md` - Phase 3 objectives
- **Related Spec:** `PHASE2-TASK-04-task-state-machine-retry-recovery.md`
