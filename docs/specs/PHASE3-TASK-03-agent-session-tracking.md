# PHASE3-TASK-03: Agent Session Tracking (Startup, Heartbeat, Completion)

**Status:** Specification
**Priority:** P1 (Phase 3 Core Infrastructure)
**Effort:** Medium
**Created:** 2026-02-08
**Model:** Sonnet (Spec Agent)
**Agent Type:** spec_agent

---

## Overview

Implement comprehensive agent session lifecycle tracking with startup detection, periodic heartbeat monitoring, and completion handling. The system provides real-time agent health monitoring, stuck session detection, automatic session recovery, and WebSocket event broadcasting to enable reliable autonomous agent orchestration with full observability.

**Problem:** Current session tracking exists but lacks structured heartbeat monitoring and stuck detection. The `agent_sessions` table stores session state, but there's no systematic heartbeat mechanism to detect when agents become unresponsive. The `agent_heartbeats` table exists in the schema but isn't actively used. Sessions can hang indefinitely without detection, and there's no automatic recovery for stuck agents.

**Solution:** Implement structured session lifecycle tracking with three phases: **startup** (session initialization with metadata), **heartbeat** (periodic health signals with progress updates), and **completion** (graceful or forced termination with result capture). Integrate stuck detection using heartbeat timeouts and automatic recovery workflows.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Session Database Module** (`parent-harness/orchestrator/src/db/sessions.ts`)
   - ✅ Session CRUD: `createSession()`, `getSession()`, `getSessions()`, `updateSessionStatus()`
   - ✅ Session states: running, completed, failed, paused, terminated
   - ✅ Iteration logging: `logIteration()` tracks iteration-level progress
   - ✅ Session queries: Filter by agentId, taskId, status
   - ✅ Relationship tracking: Links session → agent → task
   - ❌ **Gap:** No heartbeat fields (last_heartbeat_at, heartbeat_interval)
   - ❌ **Gap:** Sessions start directly in 'running' status (no 'pending' startup phase)

2. **Agent Database Module** (`parent-harness/orchestrator/src/db/agents.ts`)
   - ✅ Agent status tracking: idle, working, error, stuck, stopped
   - ✅ Heartbeat update: `updateHeartbeat(agentId)` sets last_heartbeat timestamp
   - ✅ Agent → session link: `current_session_id` field
   - ✅ Counters: `tasks_completed`, `tasks_failed`
   - ✅ Running instance counts: Query active sessions per agent type
   - ❌ **Gap:** Heartbeat stored at agent level, not session level
   - ❌ **Gap:** No stuck detection logic

3. **Database Schema** (`parent-harness/database/schema.sql`)
   - ✅ `agent_sessions` table: id, agent_id, task_id, status, timestamps, iteration counts
   - ✅ `agent_heartbeats` table: id, agent_id, session_id, iteration_number, status, progress_percent, current_step, last_tool_call, memory_mb, cpu_percent, recorded_at
   - ✅ `agents` table: last_heartbeat field
   - ❌ **Gap:** `agent_heartbeats` table defined but not actively populated
   - ❌ **Gap:** No heartbeat_interval or heartbeat_timeout in agent_sessions

4. **WebSocket Broadcasting** (`parent-harness/orchestrator/src/websocket.ts`)
   - ✅ Session events: `sessionStarted()`, `sessionUpdated()`, `sessionEnded()`
   - ✅ Agent events: `agentHeartbeat(agentId)`
   - ✅ Iteration events: `iterationLogged(iteration)`
   - ✅ Broadcast infrastructure: Connected clients receive real-time updates
   - ✅ Heartbeat placeholder: `agentHeartbeat()` exists but only takes agentId
   - ❌ **Gap:** No structured heartbeat event payload (progress, status, task)

5. **Agent Spawner** (`parent-harness/orchestrator/src/spawner/index.ts`)
   - ✅ Session creation: Creates session when spawning agent
   - ✅ WebSocket integration: Broadcasts session events
   - ✅ Budget checks: Validates token limits before spawning
   - ✅ Build health checks: Prevents spawning during build failures
   - ✅ Rate limiting: 5-hour rolling window with persisted spawn records
   - ❌ **Gap:** No heartbeat capture from spawned agent processes
   - ❌ **Gap:** No stuck detection or automatic termination

6. **Orchestrator Tick Loop** (`parent-harness/orchestrator/src/orchestrator/index.ts`)
   - ✅ Runs every 30 seconds (TICK_INTERVAL_MS)
   - ✅ Processes pending tasks and assigns to agents
   - ✅ Budget checks and observability stats
   - ❌ **Gap:** No stuck session detection in tick loop
   - ❌ **Gap:** No heartbeat validation or timeout checks

### Gaps Summary

```
MISSING:
- Heartbeat capture from agents (stdout parsing or activity inference)
- Heartbeat storage in agent_heartbeats table
- Stuck session detection (timeout checks)
- Automatic recovery (terminate stuck agents, retry tasks)
- Enhanced WebSocket events (heartbeat with progress/status)
- Session startup phase (pending → running transition)
```

---

## Requirements

### Functional Requirements

**FR-1: Session Startup Tracking**
- Sessions MUST transition through startup phase: pending → running
- MUST record startup metadata:
  - Agent configuration (model, type, capabilities)
  - Task context (task_id, title, description)
  - Environment state (cwd, git branch, build status)
  - Expected heartbeat interval (default: 60 seconds)
- MUST emit `session:started` event with full session + metadata
- MUST validate session prerequisites:
  - Agent exists and is available
  - Task is in pending/assigned state
  - Budget allows execution
  - Build health is passing
- MUST log startup activity to observability_events

**FR-2: Heartbeat Monitoring**
- Agents MUST send heartbeat signals at regular intervals (configurable, default 60s)
- Heartbeat payload MUST include:
  - Session ID, iteration number
  - Current status (running, waiting, working)
  - Progress percentage (0-100)
  - Current step description (e.g., "Reading schema files")
  - Last tool call (Read, Write, Edit, Bash)
  - Resource usage (memory MB, CPU %)
- Heartbeats stored in `agent_heartbeats` table
- MUST emit `agent:heartbeat` WebSocket event with full payload
- MUST update `agent_sessions.last_heartbeat_at` timestamp
- MUST track heartbeat sequence (detect missed heartbeats)

**FR-3: Stuck Session Detection**
- MUST check heartbeat freshness in orchestrator tick loop
- Stuck criteria:
  - No heartbeat for > heartbeat_timeout (default: 5 minutes)
  - Session status = 'running'
  - Process still exists (optional check)
- Stuck actions:
  - Mark agent status as 'stuck'
  - Emit `session:stuck` event
  - Notify via Telegram
  - Log warning to observability_events
- MUST NOT automatically terminate on first timeout (allow grace period)

**FR-4: Automatic Recovery Workflows**
- After stuck detection, apply recovery strategy:
  - **First timeout** (5 min): Mark stuck, emit warning
  - **Second timeout** (10 min): Attempt graceful termination (SIGTERM)
  - **Third timeout** (15 min): Force termination (SIGKILL)
  - **After termination**: Mark session as 'terminated', task as 'failed'
- Recovery action MUST be configurable:
  - Auto-terminate: yes/no (default: yes after 15 min)
  - Retry task: yes/no (default: yes with retry logic)
  - Notify human: yes/no (default: yes via Telegram)
- MUST preserve session state and logs for post-mortem analysis

**FR-5: Session Completion Tracking**
- MUST detect completion events:
  - Agent outputs TASK_COMPLETE or TASK_FAILED
  - Process exits (monitor exit code)
  - Session status updated to completed/failed
- Completion metadata MUST capture:
  - Exit code, exit reason
  - Total duration, iteration count
  - Token usage (input/output)
  - Cost (USD)
  - Final output or error message
- MUST emit `session:ended` event with full session + completion data
- MUST update agent counters (tasks_completed, tasks_failed)
- MUST trigger task state transitions (completed/failed)
- MUST log completion to observability_events

**FR-6: Session Query API**
- MUST provide queries:
  - Active sessions (status = running)
  - Stuck sessions (last_heartbeat > timeout)
  - Recent completions (last 24 hours)
  - Session with full heartbeat history
  - Session with iteration logs
- MUST expose via REST API:
  - `GET /api/sessions` - List sessions with filters
  - `GET /api/sessions/:id` - Session details + heartbeats
  - `GET /api/sessions/:id/heartbeats` - Heartbeat timeline
  - `POST /api/sessions/:id/terminate` - Manual termination

**FR-7: WebSocket Real-Time Updates**
- MUST broadcast session lifecycle events:
  - `session:started` - New session initialized
  - `session:updated` - Status or metadata changed
  - `session:heartbeat` - Heartbeat received (throttled to 1/min)
  - `session:stuck` - Stuck detection triggered
  - `session:recovered` - Stuck session recovered
  - `session:ended` - Session completed or terminated
- Event payloads MUST include full session object + contextual data
- MUST throttle heartbeat broadcasts to prevent spam (max 1/min per session)

### Non-Functional Requirements

**NFR-1: Performance**
- Heartbeat processing: < 50ms per heartbeat
- Stuck detection scan: < 500ms for 100 sessions
- Session startup: < 200ms
- Session completion: < 300ms
- Orchestrator tick overhead: < 1 second for all session checks

**NFR-2: Reliability**
- Session state persists across orchestrator restarts
- Heartbeat data survives orchestrator crashes
- Stuck detection resumes after restart
- No false positive stuck detections (< 1% error rate)
- Graceful degradation if heartbeat system fails (log errors, continue operation)

**NFR-3: Scalability**
- Support 100 concurrent sessions
- Store 1M+ heartbeat records (with cleanup)
- Heartbeat table cleanup: Delete records older than 7 days
- Efficient queries with proper indexes

**NFR-4: Observability**
- Log all session lifecycle events (startup, heartbeat, stuck, completion)
- Expose metrics: active sessions, stuck sessions, avg session duration, heartbeat rate
- Dashboard visualization: Session timeline, heartbeat graphs, stuck alerts
- Telegram notifications for stuck/failed sessions

**NFR-5: Maintainability**
- Clear separation: startup / heartbeat / completion modules
- Reusable heartbeat service (not agent-specific)
- TypeScript interfaces for all session/heartbeat data
- Comprehensive error handling and logging

---

## Technical Design

### Database Schema Changes

**Extend agent_sessions table:**
```sql
-- Add heartbeat tracking fields
ALTER TABLE agent_sessions ADD COLUMN last_heartbeat_at TEXT DEFAULT NULL;
ALTER TABLE agent_sessions ADD COLUMN heartbeat_interval INTEGER DEFAULT 60; -- seconds
ALTER TABLE agent_sessions ADD COLUMN heartbeat_timeout INTEGER DEFAULT 300; -- 5 minutes
ALTER TABLE agent_sessions ADD COLUMN heartbeat_missed_count INTEGER DEFAULT 0;
ALTER TABLE agent_sessions ADD COLUMN stuck_detected_at TEXT DEFAULT NULL;
ALTER TABLE agent_sessions ADD COLUMN recovery_attempts INTEGER DEFAULT 0;

-- Add startup metadata
ALTER TABLE agent_sessions ADD COLUMN startup_metadata TEXT DEFAULT NULL; -- JSON

-- Add completion metadata
ALTER TABLE agent_sessions ADD COLUMN exit_code INTEGER DEFAULT NULL;
ALTER TABLE agent_sessions ADD COLUMN exit_reason TEXT DEFAULT NULL;
ALTER TABLE agent_sessions ADD COLUMN total_duration_ms INTEGER DEFAULT NULL;
ALTER TABLE agent_sessions ADD COLUMN total_cost_usd REAL DEFAULT 0.0;
ALTER TABLE agent_sessions ADD COLUMN total_input_tokens INTEGER DEFAULT 0;
ALTER TABLE agent_sessions ADD COLUMN total_output_tokens INTEGER DEFAULT 0;

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sessions_heartbeat ON agent_sessions(last_heartbeat_at);
CREATE INDEX IF NOT EXISTS idx_sessions_stuck ON agent_sessions(status, last_heartbeat_at);
```

**Populate agent_heartbeats table:**
```sql
-- Already exists in schema, but add index for performance
CREATE INDEX IF NOT EXISTS idx_heartbeats_session ON agent_heartbeats(session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeats_agent ON agent_heartbeats(agent_id, recorded_at DESC);
```

**Session state transition:**
```sql
-- Add 'pending' to valid session states (not in schema yet)
-- Current: running, completed, failed, paused, terminated
-- Update constraint to include 'pending'
-- (Requires migration with transaction)
```

### Architecture

**New Module: `parent-harness/orchestrator/src/session-tracker/index.ts`**

```typescript
/**
 * Session Lifecycle Tracker
 *
 * Tracks agent sessions through startup, heartbeat monitoring, and completion.
 */

export interface SessionStartupOptions {
  agentId: string;
  taskId?: string;
  heartbeatInterval?: number; // seconds
  heartbeatTimeout?: number; // seconds
  metadata?: Record<string, unknown>;
}

export interface HeartbeatData {
  sessionId: string;
  iterationNumber?: number;
  status: 'running' | 'waiting' | 'working';
  progressPercent?: number;
  currentStep?: string;
  lastToolCall?: string;
  memoryMb?: number;
  cpuPercent?: number;
}

export interface SessionCompletionData {
  sessionId: string;
  exitCode?: number;
  exitReason?: string;
  output?: string;
  errorMessage?: string;
  tokenUsage?: {
    input: number;
    output: number;
    cost: number;
  };
}

// === Startup ===
export function startSession(options: SessionStartupOptions): AgentSession;
export function recordSessionStartup(sessionId: string, metadata: object): void;

// === Heartbeat ===
export function recordHeartbeat(data: HeartbeatData): void;
export function getSessionHeartbeats(sessionId: string, limit?: number): AgentHeartbeat[];
export function getLastHeartbeat(sessionId: string): AgentHeartbeat | undefined;

// === Stuck Detection ===
export function checkStuckSessions(): StuckSession[];
export function markSessionStuck(sessionId: string): void;
export function attemptRecovery(sessionId: string, strategy: RecoveryStrategy): void;

// === Completion ===
export function completeSession(data: SessionCompletionData): void;
export function terminateSession(sessionId: string, reason: string): void;

// === Queries ===
export function getActiveSessions(): AgentSession[];
export function getStuckSessions(): AgentSession[];
export function getRecentCompletions(hours: number): AgentSession[];
```

**Integration with Spawner:**

```typescript
// parent-harness/orchestrator/src/spawner/index.ts

import * as sessionTracker from '../session-tracker/index.js';

export async function spawnAgent(agentId: string, taskId?: string): Promise<SpawnResult> {
  // ... existing safety checks ...

  // Create session in 'pending' state
  const session = sessionTracker.startSession({
    agentId,
    taskId,
    heartbeatInterval: 60,
    heartbeatTimeout: 300,
    metadata: {
      cwd: CODEBASE_ROOT,
      gitBranch: git.getCurrentBranch(),
      buildHealth: getBuildHealth().status,
    },
  });

  // Spawn process
  const childProcess = spawn('claude', ['-a', '-t', prompt], { cwd: CODEBASE_ROOT });

  // Capture stdout for heartbeat detection
  childProcess.stdout.on('data', (data) => {
    const output = data.toString();

    // Parse for heartbeat signals (e.g., tool calls, progress indicators)
    const toolMatch = output.match(/📖 Read|📝 Write|✏️ Edit|⚡ Bash/);
    if (toolMatch) {
      sessionTracker.recordHeartbeat({
        sessionId: session.id,
        status: 'working',
        lastToolCall: toolMatch[0],
      });
    }

    // Parse for completion signals
    if (output.includes('TASK_COMPLETE') || output.includes('TASK_FAILED')) {
      const success = output.includes('TASK_COMPLETE');
      sessionTracker.completeSession({
        sessionId: session.id,
        exitReason: success ? 'completed' : 'failed',
        output: extractOutput(output),
      });
    }
  });

  // Monitor process exit
  childProcess.on('exit', (code) => {
    sessionTracker.completeSession({
      sessionId: session.id,
      exitCode: code ?? undefined,
      exitReason: code === 0 ? 'completed' : 'failed',
    });
  });

  // Transition to 'running' after process started
  sessions.updateSessionStatus(session.id, 'running');
  sessionTracker.recordSessionStartup(session.id, { pid: childProcess.pid });

  return { session, process: childProcess };
}
```

**Integration with Orchestrator:**

```typescript
// parent-harness/orchestrator/src/orchestrator/index.ts

import * as sessionTracker from '../session-tracker/index.js';

async function tick(): Promise<void> {
  // ... existing logic ...

  // Check for stuck sessions
  const stuckSessions = sessionTracker.checkStuckSessions();
  for (const stuck of stuckSessions) {
    console.warn(`⚠️ Session ${stuck.id} stuck (no heartbeat for ${stuck.stuckDurationMs}ms)`);

    // Apply recovery strategy
    if (stuck.recoveryAttempts === 0) {
      // First timeout: Mark stuck, emit warning
      sessionTracker.markSessionStuck(stuck.id);
      ws.broadcast('session:stuck', stuck);
      await notify(`⚠️ Session stuck: ${stuck.agent_id} - Task: ${stuck.task_id}`);
    } else if (stuck.recoveryAttempts === 1) {
      // Second timeout: Attempt graceful termination
      await sessionTracker.attemptRecovery(stuck.id, 'graceful_terminate');
    } else if (stuck.recoveryAttempts >= 2) {
      // Third timeout: Force termination
      await sessionTracker.attemptRecovery(stuck.id, 'force_terminate');
    }
  }

  // ... rest of tick logic ...
}
```

**WebSocket Event Enhancements:**

```typescript
// parent-harness/orchestrator/src/websocket.ts

export const ws = {
  // Enhanced session events
  sessionStarted: (session: AgentSession, metadata: object) =>
    broadcast('session:started', { session, metadata }),

  sessionHeartbeat: (sessionId: string, heartbeat: HeartbeatData) =>
    broadcast('session:heartbeat', { sessionId, heartbeat }),

  sessionStuck: (session: AgentSession, stuckDuration: number) =>
    broadcast('session:stuck', { session, stuckDurationMs: stuckDuration }),

  sessionRecovered: (session: AgentSession, recoveryAction: string) =>
    broadcast('session:recovered', { session, recoveryAction }),

  sessionEnded: (session: AgentSession, completion: SessionCompletionData) =>
    broadcast('session:ended', { session, completion }),

  // ... existing events ...
};
```

### Heartbeat Capture Strategies

**Strategy 1: Infer from Activity (Immediate Implementation)**
- Parse stdout for tool usage patterns
- Detect: Read, Write, Edit, Bash tool calls
- Assumption: Active tool usage = healthy session
- Advantage: No agent code changes needed
- Limitation: Won't detect stuck thinking loops

**Strategy 2: Explicit Heartbeat Messages (Future Enhancement)**
- Modify agent prompt to emit heartbeat signals
- Add to agent instructions: "Every 60s, output: [HEARTBEAT:iteration=N,progress=50]"
- Parse structured heartbeat messages from stdout
- Advantage: Explicit progress tracking
- Limitation: Requires agent prompt changes

**Strategy 3: Process Monitoring (Fallback)**
- Check process existence via PID
- Monitor CPU/memory usage
- Detect: Process crashed vs. stuck
- Advantage: Catches hard failures
- Limitation: Can't detect logical stuck states

**Implementation: Hybrid Approach**
- Primary: Infer from tool calls (Strategy 1)
- Supplement: Process monitoring (Strategy 3)
- Future: Explicit heartbeats (Strategy 2)

### Stuck Detection Algorithm

```typescript
function checkStuckSessions(): StuckSession[] {
  const stuckSessions: StuckSession[] = [];
  const now = Date.now();

  // Query running sessions with heartbeat data
  const runningSessions = query<AgentSession>(`
    SELECT * FROM agent_sessions
    WHERE status = 'running'
  `);

  for (const session of runningSessions) {
    // Calculate time since last heartbeat
    const lastHeartbeat = session.last_heartbeat_at
      ? new Date(session.last_heartbeat_at).getTime()
      : new Date(session.started_at).getTime();

    const timeSinceHeartbeat = now - lastHeartbeat;
    const timeout = (session.heartbeat_timeout || 300) * 1000; // Convert to ms

    // Check if stuck
    if (timeSinceHeartbeat > timeout) {
      stuckSessions.push({
        ...session,
        stuckDurationMs: timeSinceHeartbeat,
        recoveryAttempts: session.recovery_attempts || 0,
      });
    }
  }

  return stuckSessions;
}
```

### Recovery Strategy Implementation

```typescript
async function attemptRecovery(
  sessionId: string,
  strategy: 'graceful_terminate' | 'force_terminate' | 'retry'
): Promise<void> {
  const session = sessions.getSession(sessionId);
  if (!session) return;

  // Increment recovery attempts
  run(`UPDATE agent_sessions SET recovery_attempts = recovery_attempts + 1 WHERE id = ?`, [sessionId]);

  switch (strategy) {
    case 'graceful_terminate':
      console.log(`🔄 Attempting graceful termination: ${sessionId}`);
      // Find process and send SIGTERM
      const pid = getSessionPid(sessionId);
      if (pid) {
        process.kill(pid, 'SIGTERM');
        await wait(5000); // Wait 5s for graceful shutdown
      }
      ws.broadcast('session:recovered', { session, action: 'graceful_terminate' });
      break;

    case 'force_terminate':
      console.log(`💥 Force terminating stuck session: ${sessionId}`);
      const forcePid = getSessionPid(sessionId);
      if (forcePid) {
        try {
          process.kill(forcePid, 'SIGKILL');
        } catch (err) {
          console.error(`Failed to kill process ${forcePid}:`, err);
        }
      }
      // Mark session terminated
      sessions.updateSessionStatus(sessionId, 'terminated', undefined, 'Stuck session force terminated');
      // Mark task failed
      if (session.task_id) {
        tasks.failTask(session.task_id, 'Session stuck and terminated');
      }
      ws.broadcast('session:ended', {
        session: { ...session, status: 'terminated' },
        completion: { exitReason: 'stuck_terminated' }
      });
      break;

    case 'retry':
      console.log(`🔁 Retrying task after stuck session: ${sessionId}`);
      // Mark session failed
      sessions.updateSessionStatus(sessionId, 'failed', undefined, 'Stuck session - retrying task');
      // Trigger task retry (use existing retry logic)
      if (session.task_id) {
        tasks.retryTask(session.task_id);
      }
      break;
  }

  await notify(`🔄 Recovery action: ${strategy} on session ${sessionId} (agent: ${session.agent_id})`);
}
```

---

## Pass Criteria

### Implementation Completeness

1. ✅ **Session tracker module created** - `session-tracker/index.ts` with all exports
2. ✅ **Database schema updated** - Heartbeat fields added to agent_sessions
3. ✅ **Heartbeat recording** - `recordHeartbeat()` stores to agent_heartbeats table
4. ✅ **Stuck detection** - `checkStuckSessions()` finds timed-out sessions
5. ✅ **Recovery workflows** - `attemptRecovery()` implements termination strategies
6. ✅ **Spawner integration** - Captures heartbeats from agent stdout
7. ✅ **Orchestrator integration** - Tick loop runs stuck detection
8. ✅ **WebSocket events** - session:started, session:heartbeat, session:stuck, session:ended

### Functional Validation

9. ✅ **Session startup** - Sessions create in 'pending', transition to 'running'
10. ✅ **Heartbeat capture** - Tool calls trigger heartbeat storage
11. ✅ **Stuck detection accuracy** - Detects sessions with no heartbeat for >5 min
12. ✅ **Recovery execution** - Stuck sessions terminate after grace periods
13. ✅ **Completion tracking** - Sessions capture exit code, duration, token usage
14. ✅ **WebSocket updates** - Dashboard receives real-time session events
15. ✅ **Query API** - REST endpoints return active/stuck/completed sessions

### Testing

16. ✅ **Unit tests** - session-tracker functions tested in isolation
17. ✅ **Heartbeat test** - Spawn agent → verify heartbeats stored
18. ✅ **Stuck test** - Spawn agent → pause agent → verify stuck detection → verify termination
19. ✅ **Completion test** - Agent completes task → verify session marked completed with metadata
20. ✅ **Restart test** - Start orchestrator with stuck session → verify detection resumes
21. ✅ **Dashboard test** - Verify session timeline, heartbeat graphs, stuck alerts appear

### Performance

22. ✅ **Heartbeat processing** - <50ms per heartbeat
23. ✅ **Stuck scan** - <500ms for 100 sessions
24. ✅ **No blocking** - Session tracking doesn't delay orchestrator tick

---

## Dependencies

**Upstream (Must Complete First):**
- ✅ PHASE2-TASK-01: Spec Agent v0.1 (COMPLETED)
- ✅ Session database module exists (`db/sessions.ts`)
- ✅ Agent database module exists (`db/agents.ts`)
- ✅ WebSocket broadcasting exists (`websocket.ts`)
- ✅ Agent spawner exists (`spawner/index.ts`)

**Downstream (Depends on This):**
- PHASE3-TASK-04: Dashboard session visualization with heartbeat graphs
- PHASE4-TASK-02: Stuck agent recovery dashboard controls
- PHASE5-TASK-03: Session analytics and performance metrics

**Parallel Work (Can Develop Concurrently):**
- PHASE3-TASK-01: Task queue persistence with wave/lane generation (COMPLETED)
- PHASE3-TASK-02: Orchestrator cron loop with task dispatch (COMPLETED)
- PHASE2-TASK-05: Agent logging and error reporting

---

## Implementation Plan

### Phase 1: Database Schema (1 hour)
1. Create migration script for agent_sessions table extensions
2. Add heartbeat tracking fields (last_heartbeat_at, intervals, missed_count)
3. Add startup/completion metadata fields
4. Create indexes for efficient queries
5. Test migration on dev database

### Phase 2: Session Tracker Module (2.5 hours)
6. Create `session-tracker/index.ts` with TypeScript interfaces
7. Implement `startSession()` with pending state
8. Implement `recordHeartbeat()` to store in agent_heartbeats
9. Implement `checkStuckSessions()` with timeout logic
10. Implement `attemptRecovery()` with termination strategies
11. Implement `completeSession()` with metadata capture
12. Write unit tests for all functions

### Phase 3: Spawner Integration (1.5 hours)
13. Update spawner to create sessions in 'pending' state
14. Add stdout parser for tool call detection
15. Wire heartbeat recording on tool call detection
16. Wire completion recording on TASK_COMPLETE/FAILED
17. Wire completion recording on process exit
18. Test spawner creates sessions with heartbeats

### Phase 4: Orchestrator Integration (1 hour)
19. Add stuck detection to orchestrator tick loop
20. Implement recovery workflow (mark stuck → terminate → notify)
21. Add session health metrics to observability stats
22. Test orchestrator detects and recovers stuck sessions

### Phase 5: WebSocket Events (1 hour)
23. Enhance WebSocket event payloads (session + metadata)
24. Add heartbeat throttling (max 1/min per session)
25. Emit session:stuck and session:recovered events
26. Test dashboard receives all session events

### Phase 6: Testing & Documentation (1 hour)
27. Write integration tests (spawn → heartbeat → stuck → terminate)
28. Write restart resilience test (orchestrator restart with stuck session)
29. Update CLAUDE.md with session tracking usage
30. Add metrics logging for monitoring

**Total Estimated Effort:** 8 hours

---

## Testing Strategy

### Unit Tests

```typescript
// session-tracker/index.test.ts
describe('Session Tracker', () => {
  test('startSession creates session in pending state', () => {
    const session = startSession({ agentId: 'build_agent' });
    expect(session.status).toBe('pending');
    expect(session.heartbeat_interval).toBe(60);
  });

  test('recordHeartbeat stores to agent_heartbeats', () => {
    const session = startSession({ agentId: 'build_agent' });
    recordHeartbeat({
      sessionId: session.id,
      status: 'working',
      lastToolCall: 'Read',
    });
    const heartbeats = getSessionHeartbeats(session.id);
    expect(heartbeats.length).toBe(1);
    expect(heartbeats[0].last_tool_call).toBe('Read');
  });

  test('checkStuckSessions detects timed out sessions', () => {
    // Create session with old last_heartbeat
    const session = startSession({ agentId: 'build_agent' });
    // Set heartbeat to 10 minutes ago
    run(`UPDATE agent_sessions SET last_heartbeat_at = datetime('now', '-10 minutes') WHERE id = ?`, [session.id]);
    const stuck = checkStuckSessions();
    expect(stuck.length).toBeGreaterThan(0);
    expect(stuck[0].id).toBe(session.id);
  });
});
```

### Integration Tests

```typescript
// orchestrator/session-tracking.test.ts
describe('Session Tracking Integration', () => {
  test('spawned agent sends heartbeats', async () => {
    // Spawn agent with simple task
    const spawn = await spawnAgent('build_agent', 'test-task-id');

    // Wait for heartbeats
    await wait(5000);

    // Verify heartbeats stored
    const heartbeats = getSessionHeartbeats(spawn.session.id);
    expect(heartbeats.length).toBeGreaterThan(0);
  });

  test('stuck session detected and terminated', async () => {
    // Spawn agent
    const spawn = await spawnAgent('build_agent', 'test-task-id');

    // Pause agent process (simulate stuck)
    process.kill(spawn.process.pid!, 'SIGSTOP');

    // Wait for stuck detection (5 min timeout + grace period)
    await waitForStuck(spawn.session.id, 6 * 60 * 1000);

    // Verify stuck detected
    const session = getSession(spawn.session.id);
    expect(session?.stuck_detected_at).toBeTruthy();

    // Wait for termination (another 10 min)
    await waitForTermination(spawn.session.id, 10 * 60 * 1000);

    // Verify terminated
    const finalSession = getSession(spawn.session.id);
    expect(finalSession?.status).toBe('terminated');
  });

  test('session completion captures metadata', async () => {
    // Spawn agent with TASK_COMPLETE output
    const spawn = await spawnAgentWithCompletion('build_agent');

    // Wait for completion
    await waitForCompletion(spawn.session.id, 30000);

    // Verify completion metadata
    const session = getSession(spawn.session.id);
    expect(session?.status).toBe('completed');
    expect(session?.exit_code).toBe(0);
    expect(session?.total_duration_ms).toBeGreaterThan(0);
    expect(session?.total_input_tokens).toBeGreaterThan(0);
  });
});
```

### Manual Testing

1. **Heartbeat Monitoring:**
   - Spawn build agent with task
   - Open database and query agent_heartbeats table
   - Verify heartbeats appear every ~60 seconds
   - Verify last_tool_call field updates

2. **Stuck Detection:**
   - Spawn agent, wait for running state
   - Manually pause process: `kill -STOP <pid>`
   - Wait 5+ minutes
   - Verify stuck warning in logs
   - Verify Telegram notification
   - Wait 10+ minutes
   - Verify session terminated

3. **Dashboard Visualization:**
   - Open parent harness dashboard
   - Create task, spawn agent
   - Verify session appears in Sessions page
   - Verify heartbeat graph updates in real-time
   - Verify stuck alert appears when agent paused
   - Verify completion event updates status

---

## Rollback Plan

If implementation causes instability:

1. **Disable stuck detection:**
   - Add feature flag: `HARNESS_STUCK_DETECTION=false`
   - Orchestrator skips stuck checks if disabled
   - Heartbeat recording continues (for observability)

2. **Revert database changes:**
   - Heartbeat fields are nullable, safe to ignore
   - No data loss if rollback needed
   - Can re-apply migration later

3. **Remove session tracker module:**
   - Delete `session-tracker/` directory
   - Remove imports from spawner/orchestrator
   - System falls back to basic session tracking (existing behavior)

---

## Success Metrics

**Operational Metrics:**
- Heartbeat capture rate: >95% of active sessions
- Stuck detection accuracy: >98% (< 2% false positives)
- Recovery success rate: >90% (sessions terminate within 15 min)
- Session completion metadata: 100% captured

**Performance Metrics:**
- Heartbeat processing: <50ms
- Stuck detection scan: <500ms for 100 sessions
- Orchestrator tick overhead: <1 second

**Reliability Metrics:**
- Zero data loss during orchestrator restarts
- Stuck detection resumes within 1 tick after restart
- No zombie sessions (all eventually complete or terminate)

---

## Future Enhancements (Out of Scope)

1. **Explicit Heartbeat Protocol** - Agent prompt includes structured heartbeat messages
2. **Adaptive Timeouts** - Learn agent-specific timeout patterns (some agents take longer)
3. **Heartbeat Anomaly Detection** - Detect unusual patterns (rapid tool switching, memory spikes)
4. **Session Replay** - Reconstruct agent execution from heartbeat timeline
5. **Multi-Process Sessions** - Track sessions that spawn sub-agents
6. **Heartbeat Compression** - Compress old heartbeat data (>7 days) for storage efficiency

---

## References

- STRATEGIC_PLAN.md: Phase 3 orchestration requirements
- `parent-harness/orchestrator/src/db/sessions.ts`: Existing session module
- `parent-harness/orchestrator/src/db/agents.ts`: Existing agent module
- `parent-harness/database/schema.sql`: Database schema with agent_heartbeats table
- `parent-harness/orchestrator/src/spawner/index.ts`: Agent spawning logic
- `parent-harness/orchestrator/src/websocket.ts`: WebSocket broadcasting
- PHASE3-TASK-01: Task queue persistence (completed)
- PHASE2-TASK-04: Task state machine with retry logic
