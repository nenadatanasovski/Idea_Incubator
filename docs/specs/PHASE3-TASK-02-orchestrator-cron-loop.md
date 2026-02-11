# PHASE3-TASK-02: Orchestrator Cron Loop (60-Second Intervals) Managing Task Dispatch

**Status:** Specification
**Priority:** P1 (Critical Path - Phase 3)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Optimize and enhance the orchestrator's main tick loop to run at 60-second intervals with improved task dispatch coordination, rate limit monitoring, wave progression tracking, and health checks. The system ensures reliable autonomous task execution through coordinated agent assignment, proactive resource monitoring, and graceful failure recovery.

**Problem:** The current orchestrator runs at 30-second intervals (`TICK_INTERVAL_MS = 30_000`), which causes excessive overhead and rapid polling. While the core tick infrastructure exists, it needs optimization for better resource utilization, clearer separation of concerns, and enhanced observability. The tick loop currently handles multiple responsibilities without clear prioritization or timing guarantees.

**Solution:** Increase tick interval to 60 seconds, implement prioritized tick phases, enhance rate limit monitoring, add tick performance metrics, and ensure all critical orchestration tasks complete reliably within each tick cycle.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Orchestrator Tick Loop** (`parent-harness/orchestrator/src/orchestrator/index.ts`)
   - ✅ Main loop: `tick()` runs every 30 seconds
   - ✅ Start/stop control: `startOrchestrator()`, `stopOrchestrator()`, `isOrchestratorRunning()`
   - ✅ Pause mechanism: `isOrchestratorPaused()` checks system_state table
   - ✅ Manual trigger: `manualTick()` for API/cron invocation
   - ✅ Tick counter: Tracks tick number for periodic tasks
   - ✅ Crash protection: `crashProtect()` wrapper for all tick phases
   - ❌ **Gap:** 30-second interval too aggressive, no tick performance metrics

2. **Tick Phases** (current execution order in `tick()`)
   - ✅ **Phase 0:** Rate limit monitoring (`checkRateLimitsProactively()`)
   - ✅ **Phase 0.5:** Approved plan checking (`checkForApprovedPlans()`)
   - ✅ **Phase 1:** Agent health (`checkAgentHealth()`)
   - ✅ **Phase 2:** QA verification (every 10th tick via `QA_EVERY_N_TICKS`)
   - ✅ **Phase 3:** Failed task retry (every 5th tick via `processFailedTasks()`)
   - ✅ **Phase 4:** Wave progression (`checkWaveProgress()`)
   - ✅ **Phase 5:** Task assignment (`assignTasks()`)
   - ✅ **Phase 6:** Event logging (`events.cronTick()`)
   - ✅ **Phase 7:** Stability tracking (`recordTick()`)
   - ❌ **Gap:** No timing metrics per phase, unclear critical path

3. **Rate Limit Monitoring** (lines 36-117)
   - ✅ Proactive alerts: 60%, 80%, 95% thresholds
   - ✅ Rolling window: 5-hour window tracking
   - ✅ Telegram notifications: Direct messages via `directNotify.forwardError()`
   - ✅ Alert deduplication: `rateLimitAlertedThresholds` Set
   - ✅ Window reset detection: Clears alerts when window rolls
   - ✅ Periodic logging: Every 10 ticks shows status
   - ❌ **Gap:** No cost-per-tick metrics, unclear spawn prevention logic

4. **Agent Health Monitoring** (lines 519-592)
   - ✅ Heartbeat checking: Detects stale agents (15min threshold)
   - ✅ Stuck agent recovery: Marks stuck → cleans up after 30min
   - ✅ Task re-queuing: Returns in-progress tasks to pending
   - ✅ Session cleanup: Terminates stuck agent sessions
   - ✅ Grace periods: 15min stuck threshold, 30min cleanup threshold
   - ✅ Idle heartbeat cleanup: Clears ancient heartbeats (60min)
   - ❌ **Gap:** No agent health dashboard metrics

5. **Task Assignment** (lines 661-848)
   - ✅ Atomic task claiming: `atomicClaimTask()` prevents race conditions
   - ✅ Dependency resolution: `getPendingTasks()` checks task_relationships
   - ✅ Retry cooldown: Exponential backoff (60s → 10min)
   - ✅ Priority sorting: P0 > P1 > P2 > P3 > P4
   - ✅ Agent type matching: feature→build, test→qa, documentation→spec
   - ✅ Test task filtering: Skips test tasks to save tokens
   - ✅ Rate worker limit: Only uses build/qa/spec agents (excludes SIA/validation)
   - ❌ **Gap:** No parallel assignment metrics, unclear assignment timing

6. **Wave Progression** (lines 496-515)
   - ✅ Active run tracking: Finds running wave_runs
   - ✅ Completion checking: `checkWaveCompletion()` per active run
   - ✅ Wave advancement: Auto-starts next wave
   - ✅ Telegram notifications: `waveStarted`, `waveCompleted` events
   - ✅ Task state updates: Sets wave tasks to pending
   - ❌ **Gap:** No wave timing metrics, unclear parallelism metrics

7. **Planning System** (lines 195-328)
   - ✅ Strategic planning: `runStrategicPlanning()` generates high-level phases
   - ✅ Clarification loop: `requestPlanApproval()` waits for human approval
   - ✅ Tactical planning: `runTacticalPlanning()` creates atomic tasks
   - ✅ Wave execution: `planWaves()`, `startWaveRun()`
   - ✅ Cached approval: Skips re-approval on restart
   - ✅ Feature flags: `RUN_PLANNING`, `SPAWN_AGENTS`, `RUN_QA`
   - ❌ **Gap:** Runs at 24-hour intervals, unclear when to trigger

8. **Event System** (`parent-harness/orchestrator/src/db/events.ts`)
   - ✅ Event logging: `cronTick()`, `taskAssigned()`, `taskCompleted()`, `taskFailed()`
   - ✅ Planning events: `planningCompleted()`
   - ✅ Error events: `agentError()`
   - ✅ Recovery events: `systemRecovery()`
   - ❌ **Gap:** No tick performance metrics, unclear tick duration tracking

9. **Stability Monitoring** (`parent-harness/orchestrator/src/stability/index.ts`)
   - ✅ Tick recording: `recordTick()` logs successful ticks
   - ✅ Crash protection: `crashProtect()` wraps tick phases
   - ✅ Error recovery: Continues tick execution even if phase fails
   - ❌ **Gap:** No tick duration metrics, unclear performance tracking

10. **WebSocket Broadcasting** (`parent-harness/orchestrator/src/websocket.ts`)
    - ✅ Task events: `taskAssigned()`, `taskCompleted()`, `taskFailed()`
    - ✅ Agent events: `agentStatusChanged()`
    - ✅ Session events: `sessionStarted()`
    - ✅ Wave events: Via `ws.broadcast()` generic function
    - ❌ **Gap:** No tick status events, unclear real-time tick visibility

### Integration Points

```
Orchestrator Tick Loop (60 seconds)
    ↓
Phase 0: Proactive Rate Limit Check
    ↓ (monitors)
Spawner Rolling Window Stats
    ↓ (alerts via)
Telegram Direct Notifications
    ↓
Phase 0.5: Approved Plan Check
    ↓ (reads)
~/.harness/approved-plan.json
    ↓ (creates)
Tasks from Plan Deliverables
    ↓
Phase 1: Agent Health Monitoring
    ↓ (checks)
Agent Heartbeats (15min threshold)
    ↓ (recovers)
Stuck Agents (30min threshold)
    ↓ (re-queues)
Orphaned Tasks → Pending
    ↓
Phase 2: QA Verification (every 10th tick)
    ↓ (runs)
QA Cycle (qa.runQACycle)
    ↓
Phase 3: Failed Task Retry (every 5th tick)
    ↓ (processes)
Self-Improvement Retry Logic
    ↓
Phase 4: Wave Progression
    ↓ (checks)
Active Wave Runs
    ↓ (advances)
Next Wave if Current Complete
    ↓
Phase 5: Task Assignment
    ↓ (assigns)
Pending Tasks → Idle Agents
    ↓ (spawns)
Agent Sessions via Spawner
    ↓
Phase 6: Event Logging
    ↓ (logs)
cronTick Event
    ↓
Phase 7: Stability Recording
    ↓ (tracks)
Successful Tick Counter
    ↓
WebSocket Broadcast
    ↓
Dashboard Real-Time Updates
```

---

## Requirements

### Functional Requirements

**FR-1: Tick Interval Optimization**

- MUST run tick loop at 60-second intervals (change from 30 seconds)
- MUST complete all tick phases within 10 seconds (leave 50s buffer)
- MUST skip tick if previous tick still running (prevent overlap)
- MUST log warning if tick exceeds 10-second threshold
- SHOULD adjust interval dynamically if system is overloaded (future enhancement)

**FR-2: Phase Prioritization**

- MUST execute phases in priority order:
  1. **Critical:** Rate limit check, agent health, task assignment
  2. **Important:** Wave progression, QA verification
  3. **Periodic:** Retry processing, planning
- MUST NOT block critical phases on periodic phase failures
- MUST execute all phases with crash protection
- SHOULD skip non-critical phases if tick is running long (>8s elapsed)

**FR-3: Rate Limit Monitoring**

- MUST check rate limits proactively every tick
- MUST alert at 60%, 80%, 95% thresholds (existing behavior)
- MUST reset alerts when rolling window expires
- SHOULD expose rate limit metrics via API
- SHOULD track cost-per-tick for budget planning

**FR-4: Agent Health Coordination**

- MUST check all agent heartbeats every tick
- MUST mark agents stuck after 15 minutes without heartbeat
- MUST clean up stuck agents after 30 minutes
- MUST re-queue orphaned tasks from stuck agents
- SHOULD expose agent health metrics via API

**FR-5: Task Dispatch Coordination**

- MUST atomically claim tasks before spawning agents
- MUST respect task dependencies (via `getPendingTasks()`)
- MUST apply retry cooldown (exponential backoff)
- MUST filter test tasks (save tokens)
- MUST prioritize tasks: P0 > P1 > P2 > P3 > P4
- MUST match agent types to task categories
- SHOULD track assignment metrics (tasks assigned per tick)

**FR-6: Wave Progression Management**

- MUST check active wave runs every tick
- MUST advance wave when current wave completes
- MUST notify via Telegram on wave completion
- SHOULD track wave metrics (tasks per wave, completion time)
- SHOULD detect stalled waves (no progress in 30min)

**FR-7: Tick Performance Metrics**

- MUST record tick duration for each tick
- MUST record phase durations within tick
- MUST expose tick metrics via API endpoint
- SHOULD alert if tick duration > 10 seconds
- SHOULD track average tick duration over 1-hour window

**FR-8: Pause/Resume Control**

- MUST respect pause state (via `/stop` command)
- MUST skip all phases when paused (except status check)
- MUST log paused status every 10th tick
- MUST resume immediately on `/start` command
- SHOULD expose pause state via API

**FR-9: Real-Time Observability**

- MUST broadcast tick status via WebSocket
- MUST emit events: `tick:started`, `tick:completed`, `tick:phase:completed`
- MUST include tick metrics in events (duration, phase durations)
- SHOULD batch events to prevent spam (one tick summary per tick)

**FR-10: Graceful Failure Handling**

- MUST continue tick execution if any phase fails
- MUST log phase failures with stack traces
- MUST track consecutive phase failures
- MUST alert via Telegram if phase fails 3+ times consecutively
- SHOULD expose phase failure metrics via API

### Non-Functional Requirements

**NFR-1: Performance**

- Tick duration MUST NOT exceed 10 seconds under normal load
- Phase execution MUST be async (don't block)
- Database queries MUST use indexes
- Task assignment MUST complete in <2 seconds for 100 pending tasks
- Wave progression MUST complete in <1 second for 10 active runs

**NFR-2: Reliability**

- Tick loop MUST survive phase failures (crash protection)
- Tick state MUST survive orchestrator restarts
- Agent health recovery MUST NOT corrupt task state
- Rate limit tracking MUST survive process crashes
- No data loss during tick execution

**NFR-3: Observability**

- MUST log tick start/end with duration
- MUST log phase execution times
- MUST expose tick metrics via `/api/orchestrator/metrics`
- MUST emit WebSocket events for dashboard updates
- SHOULD provide Prometheus-compatible metrics (future)

**NFR-4: Resource Efficiency**

- 60-second interval reduces CPU overhead by 50%
- Phase skipping reduces unnecessary work
- Atomic task claiming prevents duplicate spawns
- Test task filtering saves token costs
- Rate limit monitoring prevents overspend

**NFR-5: Maintainability**

- Tick phases clearly separated and documented
- Each phase has single responsibility
- Crash protection centralizes error handling
- Configuration via environment variables
- TypeScript types for all tick state

---

## Technical Design

### Configuration Changes

**Update tick interval in `orchestrator/index.ts`:**

```typescript
// Change from 30 seconds to 60 seconds
const TICK_INTERVAL_MS = 60_000; // 60 seconds (was 30_000)
```

**New configuration constants:**

```typescript
const MAX_TICK_DURATION_MS = 10_000; // 10 seconds
const WARN_TICK_DURATION_MS = 8_000; // 8 seconds (80% threshold)
const SKIP_TICK_IF_RUNNING = true; // Prevent overlap
const ENABLE_TICK_METRICS = true; // Track performance
```

### Enhanced Tick Execution

**New tick state tracking:**

```typescript
interface TickState {
  tickNumber: number;
  startTime: number;
  isRunning: boolean;
  currentPhase: string | null;
  phaseDurations: Map<string, number>;
  errors: Array<{ phase: string; error: string }>;
}

let currentTickState: TickState | null = null;
```

**Enhanced tick function with metrics:**

```typescript
async function tick(): Promise<void> {
  tickCount++;
  const startTime = Date.now();

  // Prevent overlapping ticks
  if (SKIP_TICK_IF_RUNNING && currentTickState?.isRunning) {
    console.warn(`⚠️ Tick #${tickCount} skipped - previous tick still running`);
    return;
  }

  // Initialize tick state
  currentTickState = {
    tickNumber: tickCount,
    startTime,
    isRunning: true,
    currentPhase: null,
    phaseDurations: new Map(),
    errors: [],
  };

  // Broadcast tick start
  ws.broadcast({
    type: "tick:started",
    tickNumber: tickCount,
    timestamp: new Date(startTime).toISOString(),
  });

  try {
    // Check if paused
    if (isOrchestratorPaused()) {
      if (tickCount % 10 === 0) {
        console.log(
          `⏸️ Orchestrator paused (tick #${tickCount}). Use /start to resume.`,
        );
      }
      return;
    }

    // Execute tick phases with timing
    await executePhase("rate_limit_check", () => checkRateLimitsProactively());
    await executePhase("approved_plan_check", () => checkForApprovedPlans());
    await executePhase("agent_health", () => checkAgentHealth());

    // Periodic phases
    if (RUN_QA && tickCount % QA_EVERY_N_TICKS === 0) {
      await executePhase("qa_verification", () => qa.runQACycle());
    }

    if (tickCount % 5 === 0) {
      await executePhase("retry_processing", async () => {
        const retried = await selfImprovement.processFailedTasks();
        if (retried && retried > 0) {
          console.log(`🔄 Queued ${retried} tasks for retry`);
        }
      });
    }

    // Critical path phases
    await executePhase("wave_progression", () => checkWaveProgress());
    await executePhase("task_assignment", () => assignTasks());

    // Event logging
    const workingAgents = agents.getWorkingAgents();
    const idleAgents = agents.getIdleAgents();
    events.cronTick(tickCount, workingAgents.length, idleAgents.length);

    // Record successful tick
    recordTick(tickCount);

    // Calculate total duration
    const duration = Date.now() - startTime;

    // Warn if tick took too long
    if (duration > WARN_TICK_DURATION_MS) {
      console.warn(
        `⚠️ Tick #${tickCount} took ${duration}ms (threshold: ${WARN_TICK_DURATION_MS}ms)`,
      );

      // Log slow phases
      const slowPhases = Array.from(currentTickState.phaseDurations.entries())
        .filter(([_, dur]) => dur > 1000)
        .sort((a, b) => b[1] - a[1]);

      if (slowPhases.length > 0) {
        console.warn(
          `   Slow phases: ${slowPhases.map(([p, d]) => `${p}(${d}ms)`).join(", ")}`,
        );
      }
    }

    console.log(
      `⏰ Tick #${tickCount}: ${workingAgents.length} working, ${idleAgents.length} idle (${duration}ms)`,
    );

    // Broadcast tick completion with metrics
    ws.broadcast({
      type: "tick:completed",
      tickNumber: tickCount,
      duration,
      workingAgents: workingAgents.length,
      idleAgents: idleAgents.length,
      phaseDurations: Object.fromEntries(currentTickState.phaseDurations),
      errors: currentTickState.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Tick error:", error);
    events.cronTick(tickCount, 0, 0);

    // Broadcast tick error
    ws.broadcast({
      type: "tick:failed",
      tickNumber: tickCount,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
  } finally {
    currentTickState.isRunning = false;
  }
}
```

**Phase execution wrapper with timing:**

```typescript
async function executePhase(
  phaseName: string,
  phaseFunc: () => Promise<void> | void,
): Promise<void> {
  const phaseStart = Date.now();
  currentTickState!.currentPhase = phaseName;

  try {
    await crashProtect(phaseFunc, phaseName);

    const duration = Date.now() - phaseStart;
    currentTickState!.phaseDurations.set(phaseName, duration);

    // Log slow phases
    if (duration > 2000) {
      console.warn(`⚠️ Phase ${phaseName} took ${duration}ms`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    currentTickState!.errors.push({ phase: phaseName, error: errorMsg });
    console.error(`❌ Phase ${phaseName} failed:`, error);
  } finally {
    currentTickState!.currentPhase = null;
  }
}
```

### API Endpoint for Tick Metrics

**New endpoint: `GET /api/orchestrator/tick-metrics`**

```typescript
// In parent-harness/orchestrator/src/api/orchestrator.ts
router.get("/tick-metrics", (req, res) => {
  const metrics = getTickMetrics();
  res.json(metrics);
});

function getTickMetrics(): TickMetrics {
  // Return last N ticks with durations, phase breakdowns, errors
  return {
    currentTick: tickCount,
    isRunning: isRunning,
    isPaused: isOrchestratorPaused(),
    lastTickDuration: currentTickState
      ? Date.now() - currentTickState.startTime
      : null,
    recentTicks: getRecentTickHistory(20), // Last 20 ticks
    averageDuration: calculateAverageDuration(),
    slowestPhases: getSlowPhaseStats(),
    phaseFailures: getPhaseFailureStats(),
  };
}
```

### WebSocket Events

**New event types:**

```typescript
// Tick lifecycle events
ws.broadcast({
  type: "tick:started",
  tickNumber: number,
  timestamp: string,
});

ws.broadcast({
  type: "tick:completed",
  tickNumber: number,
  duration: number, // milliseconds
  workingAgents: number,
  idleAgents: number,
  phaseDurations: Record<string, number>, // phase → duration
  errors: Array<{ phase: string; error: string }>,
  timestamp: string,
});

ws.broadcast({
  type: "tick:failed",
  tickNumber: number,
  error: string,
  timestamp: string,
});

ws.broadcast({
  type: "tick:phase:completed",
  tickNumber: number,
  phase: string,
  duration: number,
  timestamp: string,
});
```

### Tick Metrics Storage

**New table: tick_history (optional, for analytics)**

```sql
CREATE TABLE IF NOT EXISTS tick_history (
  id TEXT PRIMARY KEY,
  tick_number INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  working_agents INTEGER DEFAULT 0,
  idle_agents INTEGER DEFAULT 0,
  phases_executed TEXT, -- JSON: [{ phase, duration, error }]
  error_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tick_history_tick_number ON tick_history(tick_number);
CREATE INDEX IF NOT EXISTS idx_tick_history_started_at ON tick_history(started_at);
```

**Tick history persistence:**

```typescript
function recordTickHistory(tickState: TickState, duration: number): void {
  if (!ENABLE_TICK_METRICS) return;

  const db = getDb();
  db.prepare(
    `
    INSERT INTO tick_history (
      id, tick_number, started_at, completed_at, duration_ms,
      working_agents, idle_agents, phases_executed, error_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    uuidv4(),
    tickState.tickNumber,
    new Date(tickState.startTime).toISOString(),
    new Date(tickState.startTime + duration).toISOString(),
    duration,
    agents.getWorkingAgents().length,
    agents.getIdleAgents().length,
    JSON.stringify(
      Array.from(tickState.phaseDurations.entries()).map(([phase, dur]) => ({
        phase,
        duration: dur,
        error: tickState.errors.find((e) => e.phase === phase)?.error,
      })),
    ),
    tickState.errors.length,
  );

  // Clean up old history (keep last 1000 ticks)
  db.prepare(
    `
    DELETE FROM tick_history
    WHERE tick_number < (SELECT MAX(tick_number) - 1000 FROM tick_history)
  `,
  ).run();
}
```

### Migration Script

**Add tick_history table in migration:**

```sql
-- File: parent-harness/orchestrator/database/migrations/071_tick_history.sql
CREATE TABLE IF NOT EXISTS tick_history (
  id TEXT PRIMARY KEY,
  tick_number INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  working_agents INTEGER DEFAULT 0,
  idle_agents INTEGER DEFAULT 0,
  phases_executed TEXT,
  error_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tick_history_tick_number ON tick_history(tick_number);
CREATE INDEX IF NOT EXISTS idx_tick_history_started_at ON tick_history(started_at);
```

---

## Pass Criteria

### Implementation Completeness

1. ✅ **Tick interval updated** - `TICK_INTERVAL_MS = 60_000` (60 seconds)
2. ✅ **Tick state tracking** - `TickState` interface tracks execution
3. ✅ **Phase timing** - `executePhase()` wrapper measures duration
4. ✅ **Overlap prevention** - Skip tick if previous still running
5. ✅ **Tick metrics API** - `/api/orchestrator/tick-metrics` returns stats
6. ✅ **WebSocket events** - tick:started, tick:completed, tick:failed emitted
7. ✅ **Tick history table** - Optional persistence for analytics
8. ✅ **Slow tick warnings** - Log if tick > 8 seconds

### Functional Validation

9. ✅ **60-second interval** - Ticks run every 60 seconds (verify via logs)
10. ✅ **Phase execution order** - Critical phases run first, periodic phases conditional
11. ✅ **Rate limit monitoring** - Runs every tick, alerts at thresholds
12. ✅ **Agent health checks** - Detects stuck agents, re-queues tasks
13. ✅ **Task assignment** - Atomic claiming, priority sorting, agent matching
14. ✅ **Wave progression** - Advances waves when complete
15. ✅ **Pause/resume** - Respects pause state, skips phases when paused
16. ✅ **Metrics accuracy** - Tick metrics reflect actual execution times

### Performance Validation

17. ✅ **Tick duration** - 95% of ticks complete in <10 seconds
18. ✅ **No overlap** - No concurrent ticks under normal load
19. ✅ **Phase efficiency** - No phase exceeds 5 seconds regularly
20. ✅ **Database performance** - Queries use indexes, no table scans
21. ✅ **Memory efficiency** - No memory leaks over 1000 ticks

### Observability Validation

22. ✅ **Tick logging** - Start/end logged with duration
23. ✅ **Phase logging** - Slow phases logged with duration
24. ✅ **Error tracking** - Phase failures logged and counted
25. ✅ **Dashboard updates** - WebSocket events received in real-time
26. ✅ **Metrics API** - Returns accurate tick statistics

### Testing

27. ✅ **Unit tests** - Phase execution, timing, error handling
28. ✅ **Integration test** - Full tick cycle with all phases
29. ✅ **Performance test** - 100 ticks complete without degradation
30. ✅ **Overlap test** - Verify second tick skipped if first still running
31. ✅ **Pause test** - Verify tick skips phases when paused
32. ✅ **Metrics test** - Verify API returns accurate statistics

---

## Dependencies

**Upstream (Must Complete First):**

- ✅ PHASE2-TASK-04: Task state machine with retry logic (COMPLETED)
- ✅ Wave system (`waves/index.ts`) exists
- ✅ Task assignment logic (`assignTasks()`) exists
- ✅ Agent health monitoring (`checkAgentHealth()`) exists

**Downstream (Depends on This):**

- PHASE3-TASK-01: Queue persistence (benefits from tick metrics)
- PHASE3-TASK-03: Session tracking (uses tick events)
- PHASE3-TASK-05: Dashboard updates (displays tick metrics)

**Parallel Work (Can Develop Concurrently):**

- PHASE3-TASK-04: Agent logging
- PHASE4-TASK-01: Knowledge base system

---

## Implementation Plan

### Phase 1: Tick Interval & State Tracking (1 hour)

1. Update `TICK_INTERVAL_MS` from 30_000 to 60_000
2. Add `TickState` interface and `currentTickState` variable
3. Add overlap prevention check
4. Add tick start/end logging with duration
5. Test tick runs every 60 seconds

### Phase 2: Phase Timing & Metrics (1.5 hours)

6. Implement `executePhase()` wrapper with timing
7. Track phase durations in `TickState.phaseDurations`
8. Log slow phases (>2 seconds)
9. Warn if total tick >8 seconds
10. Test phase timing accuracy

### Phase 3: WebSocket Events (1 hour)

11. Add `tick:started`, `tick:completed`, `tick:failed` event types
12. Broadcast tick events with metrics
13. Include phase durations in tick:completed
14. Test dashboard receives events
15. Verify event payload structure

### Phase 4: Metrics API (1.5 hours)

16. Create `/api/orchestrator/tick-metrics` endpoint
17. Implement `getTickMetrics()` function
18. Add recent tick history (in-memory, last 20 ticks)
19. Calculate average duration, slowest phases
20. Test API returns accurate data

### Phase 5: Optional Persistence (1 hour)

21. Create migration `071_tick_history.sql`
22. Implement `recordTickHistory()` function
23. Add cleanup logic (keep last 1000 ticks)
24. Make persistence optional via config flag
25. Test history table population

### Phase 6: Testing & Documentation (1 hour)

26. Write unit tests for phase timing
27. Write integration test for full tick cycle
28. Write performance test (100 ticks)
29. Update CLAUDE.md with tick interval change
30. Add tick metrics to monitoring docs

**Total Estimated Effort:** 7 hours

---

## Testing Strategy

### Unit Tests

```typescript
// orchestrator/tick.test.ts
describe('Orchestrator Tick Loop', () => {
  test('executePhase tracks duration accurately', async () => {
    const state: TickState = { phaseDurations: new Map(), ... };
    await executePhase('test_phase', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });
    expect(state.phaseDurations.get('test_phase')).toBeGreaterThan(90);
  });

  test('tick skips if previous tick still running', async () => {
    currentTickState = { isRunning: true, ... };
    const startCount = tickCount;
    await tick();
    expect(tickCount).toBe(startCount + 1); // Incremented but skipped
  });

  test('tick respects pause state', async () => {
    setPaused(true);
    const assignedBefore = await countTaskAssignments();
    await tick();
    const assignedAfter = await countTaskAssignments();
    expect(assignedAfter).toBe(assignedBefore); // No assignments
  });
});
```

### Integration Tests

```typescript
// orchestrator/tick-integration.test.ts
describe("Tick Integration", () => {
  test("full tick cycle completes all phases", async () => {
    const events: string[] = [];
    ws.on("broadcast", (event) => events.push(event.type));

    await tick();

    expect(events).toContain("tick:started");
    expect(events).toContain("tick:completed");
    // Verify all critical phases executed
  });

  test("tick metrics API returns accurate data", async () => {
    await tick();
    const response = await fetch("/api/orchestrator/tick-metrics");
    const metrics = await response.json();

    expect(metrics.currentTick).toBeGreaterThan(0);
    expect(metrics.recentTicks).toHaveLength(1);
    expect(metrics.recentTicks[0].duration).toBeGreaterThan(0);
  });
});
```

### Performance Tests

```typescript
// orchestrator/tick-performance.test.ts
describe("Tick Performance", () => {
  test("100 ticks complete without degradation", async () => {
    const durations: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await tick();
      durations.push(Date.now() - start);
    }

    const avgDuration = durations.reduce((a, b) => a + b) / durations.length;
    const maxDuration = Math.max(...durations);

    expect(avgDuration).toBeLessThan(10000); // <10s average
    expect(maxDuration).toBeLessThan(15000); // <15s max
  });

  test("no memory leaks over 1000 ticks", async () => {
    const initialMemory = process.memoryUsage().heapUsed;

    for (let i = 0; i < 1000; i++) {
      await tick();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const growth = (finalMemory - initialMemory) / initialMemory;

    expect(growth).toBeLessThan(0.5); // <50% growth
  });
});
```

### Manual Testing

1. **Tick Interval Verification:**
   - Start orchestrator
   - Watch logs for tick messages
   - Verify ticks occur every 60 seconds (not 30)

2. **Tick Metrics Dashboard:**
   - Open `/api/orchestrator/tick-metrics` in browser
   - Verify shows recent ticks with durations
   - Refresh after 60 seconds, verify new tick added

3. **Phase Timing:**
   - Create 100 pending tasks
   - Trigger tick
   - Verify logs show phase durations
   - Verify task_assignment phase completes in <5s

4. **Overlap Prevention:**
   - Artificially slow down a phase (add sleep)
   - Verify next tick skips if previous still running
   - Verify warning logged

---

## Rollback Plan

If tick optimization causes instability:

1. **Revert tick interval:**
   - Change `TICK_INTERVAL_MS` back to 30_000
   - Restart orchestrator
   - System reverts to 30-second polling

2. **Disable tick metrics:**
   - Set `ENABLE_TICK_METRICS = false`
   - Remove `recordTickHistory()` calls
   - Reduce overhead if metrics cause slowdown

3. **Disable overlap prevention:**
   - Set `SKIP_TICK_IF_RUNNING = false`
   - Allow concurrent ticks if needed
   - May cause duplicate work but system remains operational

4. **Remove tick history table:**
   - `DROP TABLE tick_history;`
   - Remove persistence if causing DB issues

---

## Success Metrics

**Operational Metrics:**

- Average tick duration: <5 seconds
- P95 tick duration: <10 seconds
- P99 tick duration: <15 seconds
- Tick overlap rate: 0%
- Phase failure rate: <1%

**Resource Efficiency:**

- CPU reduction: ~50% (vs 30-second interval)
- Database query count: Same per tick
- Memory growth: <10% per 1000 ticks
- Network bandwidth: Same (WebSocket events)

**Observability Metrics:**

- Tick metrics API latency: <100ms
- WebSocket event delivery: <500ms
- Dashboard update latency: <1 second
- Metric accuracy: 100% (no missing ticks)

**Quality Metrics:**

- Zero tick skips (except when paused)
- 100% phase execution (crash-protected)
- Zero data corruption
- TypeScript compilation success

---

## Future Enhancements (Out of Scope)

1. **Adaptive tick interval** - Adjust based on system load (30s-120s)
2. **Phase prioritization** - Skip low-priority phases if tick running long
3. **Distributed orchestration** - Multiple orchestrators with leader election
4. **Tick scheduling** - Different intervals for different phase types
5. **Prometheus metrics** - Export tick metrics in Prometheus format
6. **Tick replay** - Replay failed ticks for debugging

---

## References

- `parent-harness/orchestrator/src/orchestrator/index.ts`: Current tick loop
- `parent-harness/orchestrator/src/waves/index.ts`: Wave progression
- `parent-harness/orchestrator/src/db/tasks.ts`: Task assignment
- `parent-harness/orchestrator/src/stability/index.js`: Crash protection
- PHASE2-TASK-04: Task state machine specification
- PHASE3-TASK-01: Queue persistence specification
