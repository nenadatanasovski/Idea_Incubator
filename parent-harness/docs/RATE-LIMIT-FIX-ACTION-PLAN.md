# Rate Limit Fix - Action Plan

**Date**: 2026-02-11
**Priority**: P0 - Critical System Stability Issue
**Estimated Effort**: 2-3 days

---

## Executive Summary

The parent harness rate limit protection is fundamentally broken. It monitors 5-hour windows while Anthropic enforces per-minute limits, causing:

- 429 rate limit errors despite being "under budget"
- Assignment storms (8.12 assignments/task, should be 1.0)
- State desync (140 running sessions, 0 in_progress tasks)
- Death spiral under load

**Root Cause**: Monitoring without enforcement - alerts trigger but don't block actions.

**Solution**: Add per-minute tracking, gate assignments when rate limited, clean state on spawn failures.

---

## Table of Contents

1. [Pre-Implementation Checklist](#pre-implementation-checklist)
2. [Phase 1: Per-Minute Rate Tracking (P0)](#phase-1-per-minute-rate-tracking-p0)
3. [Phase 2: Assignment Gate (P0)](#phase-2-assignment-gate-p0)
4. [Phase 3: State Cleanup (P0)](#phase-3-state-cleanup-p0)
5. [Phase 4: Exponential Backoff (P1)](#phase-4-exponential-backoff-p1)
6. [Phase 5: Config Reduction (P1)](#phase-5-config-reduction-p1)
7. [Phase 6: Testing & Validation](#phase-6-testing--validation)
8. [Phase 7: Observability (P2)](#phase-7-observability-p2)
9. [Rollback Plan](#rollback-plan)
10. [Success Metrics](#success-metrics)

---

## Pre-Implementation Checklist

### Backup & Safety

- [ ] **Backup database**: `cp parent-harness/data/harness.db parent-harness/data/harness.db.backup-$(date +%Y%m%d_%H%M%S)`
- [ ] **Create feature branch**: `git checkout -b fix/rate-limit-enforcement`
- [ ] **Stop orchestrator**: Ensure no running processes that could interfere
- [ ] **Document current config**: `cat ~/.harness/config.json > /tmp/harness-config-backup.json`

### Baseline Metrics

Run these queries to establish baseline (save results):

```bash
cd parent-harness/orchestrator
sqlite3 ../data/harness.db <<EOF
-- Current state
SELECT COUNT(*) as running_sessions FROM agent_sessions WHERE status='running';
SELECT COUNT(*) as in_progress_tasks FROM tasks WHERE status='in_progress';

-- Assignment amplification
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT task_id) as distinct_tasks,
  CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) as avg_per_task
FROM observability_events
WHERE event_type='task:assigned'
  AND created_at > datetime('now', '-1 hour');

-- Recent rate limit errors
SELECT COUNT(*) FROM observability_events
WHERE event_type='system:error'
  AND payload LIKE '%rate%limit%'
  AND created_at > datetime('now', '-24 hours');
EOF
```

Save output to `baseline-metrics.txt`.

---

## Phase 1: Per-Minute Rate Tracking (P0)

**File**: `parent-harness/orchestrator/src/spawner/rate-limiter.ts` (NEW FILE)

### Step 1.1: Create Rate Limiter Module

Create new file with minute-window tracking:

```typescript
/**
 * Per-Minute Rate Limiter
 *
 * Tracks requests and tokens per minute to prevent Anthropic API 429 errors.
 * Uses conservative limits (70% of API tier limits) for safety margin.
 */

export interface MinuteWindow {
  minute: number; // Minute timestamp (Math.floor(Date.now() / 60000))
  requests: number; // Request count this minute
  tokens: number; // Token count this minute (input + output)
  spawnsStarted: number; // Concurrent spawns started but not finished
}

export interface RateLimitConfig {
  maxRequestsPerMinute: number;
  maxTokensPerMinute: number;
  maxConcurrent: number;
}

// Conservative limits (70% of Anthropic Build tier: 50 RPM, 40K TPM, 5 concurrent)
const DEFAULT_LIMITS: RateLimitConfig = {
  maxRequestsPerMinute: 35, // 70% of 50 RPM
  maxTokensPerMinute: 28000, // 70% of 40K TPM
  maxConcurrent: 3, // 60% of 5 concurrent
};

class MinuteWindowTracker {
  private windows: Map<number, MinuteWindow> = new Map();
  private limits: RateLimitConfig;
  private concurrentActive = 0;
  private lastCleanup = 0;

  constructor(limits: RateLimitConfig = DEFAULT_LIMITS) {
    this.limits = limits;
  }

  /**
   * Get current minute timestamp
   */
  private getCurrentMinute(): number {
    return Math.floor(Date.now() / 60000);
  }

  /**
   * Get or create window for current minute
   */
  private getWindow(minute: number): MinuteWindow {
    if (!this.windows.has(minute)) {
      this.windows.set(minute, {
        minute,
        requests: 0,
        tokens: 0,
        spawnsStarted: 0,
      });
    }
    return this.windows.get(minute)!;
  }

  /**
   * Check if we can spawn right now (without recording)
   */
  canSpawn(): {
    allowed: boolean;
    reason?: string;
    stats: MinuteWindow & { concurrent: number };
  } {
    const currentMinute = this.getCurrentMinute();
    const window = this.getWindow(currentMinute);

    const stats = {
      ...window,
      concurrent: this.concurrentActive,
    };

    // Check concurrent limit
    if (this.concurrentActive >= this.limits.maxConcurrent) {
      return {
        allowed: false,
        reason: `Concurrent limit reached (${this.concurrentActive}/${this.limits.maxConcurrent})`,
        stats,
      };
    }

    // Check per-minute request limit
    if (window.requests >= this.limits.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute request limit (${window.requests}/${this.limits.maxRequestsPerMinute})`,
        stats,
      };
    }

    // Check per-minute token limit
    if (window.tokens >= this.limits.maxTokensPerMinute) {
      return {
        allowed: false,
        reason: `Per-minute token limit (${window.tokens}/${this.limits.maxTokensPerMinute})`,
        stats,
      };
    }

    return { allowed: true, stats };
  }

  /**
   * Record a spawn attempt (call BEFORE spawning)
   */
  recordSpawnStart(): void {
    const currentMinute = this.getCurrentMinute();
    const window = this.getWindow(currentMinute);

    window.requests++;
    window.spawnsStarted++;
    this.concurrentActive++;

    this.cleanup();
  }

  /**
   * Record spawn completion with actual token usage
   */
  recordSpawnEnd(tokensUsed: number): void {
    const currentMinute = this.getCurrentMinute();
    const window = this.getWindow(currentMinute);

    window.tokens += tokensUsed;
    this.concurrentActive = Math.max(0, this.concurrentActive - 1);

    this.cleanup();
  }

  /**
   * Get current usage stats for monitoring
   */
  getStats(): {
    currentMinute: MinuteWindow;
    limits: RateLimitConfig;
    concurrent: number;
    utilizationPercent: {
      requests: number;
      tokens: number;
      concurrent: number;
    };
  } {
    const currentMinute = this.getCurrentMinute();
    const window = this.getWindow(currentMinute);

    return {
      currentMinute: window,
      limits: this.limits,
      concurrent: this.concurrentActive,
      utilizationPercent: {
        requests: (window.requests / this.limits.maxRequestsPerMinute) * 100,
        tokens: (window.tokens / this.limits.maxTokensPerMinute) * 100,
        concurrent: (this.concurrentActive / this.limits.maxConcurrent) * 100,
      },
    };
  }

  /**
   * Update limits (for config changes)
   */
  updateLimits(limits: Partial<RateLimitConfig>): void {
    this.limits = { ...this.limits, ...limits };
  }

  /**
   * Clean up old windows (keep last 5 minutes for debugging)
   */
  private cleanup(): void {
    const now = Date.now();

    // Only cleanup once per minute max
    if (now - this.lastCleanup < 60000) return;
    this.lastCleanup = now;

    const currentMinute = this.getCurrentMinute();
    const cutoff = currentMinute - 5;

    for (const [minute] of this.windows) {
      if (minute < cutoff) {
        this.windows.delete(minute);
      }
    }
  }

  /**
   * Reset all state (for testing)
   */
  reset(): void {
    this.windows.clear();
    this.concurrentActive = 0;
  }
}

// Singleton instance
export const rateLimiter = new MinuteWindowTracker();

export default rateLimiter;
```

### Step 1.2: Integrate into Spawner

**File**: `parent-harness/orchestrator/src/spawner/index.ts`

Add import at top:

```typescript
import rateLimiter from "./rate-limiter.js";
```

**Location**: Line ~906, in `spawnAgentSession()` function, **BEFORE** any spawn attempt checks

Add this code right after the function starts:

```typescript
export async function spawnAgentSession(options: SpawnOptions): Promise<SpawnResult> {
  const { taskId, agentId, timeout = 300 } = options;

  // Get agent data first to check type
  const agentData = agents.getAgent(agentId);
  const taskData = tasks.getTask(taskId);

  if (!taskData || !agentData) {
    return { success: false, sessionId: '', error: 'Task or agent not found' };
  }

  // ============ NEW: PER-MINUTE RATE LIMIT CHECK ============
  const rateLimitCheck = rateLimiter.canSpawn();
  if (!rateLimitCheck.allowed) {
    const { stats } = rateLimitCheck;
    console.warn(`⏸️ Rate limit: ${rateLimitCheck.reason}`);
    console.warn(`   Stats: ${stats.requests}/${rateLimiter.getStats().limits.maxRequestsPerMinute} req/min, ` +
                 `${stats.tokens}/${rateLimiter.getStats().limits.maxTokensPerMinute} tok/min, ` +
                 `${stats.concurrent} concurrent`);

    // Don't queue or claim - just reject
    return {
      success: false,
      sessionId: '',
      error: rateLimitCheck.reason || 'Per-minute rate limit',
    };
  }

  // Record spawn start (increments concurrent counter)
  rateLimiter.recordSpawnStart();
  // ============ END RATE LIMIT CHECK ============

  // ... rest of existing function
```

**Location**: Line ~730-736, in `finishSession()` callback, when tokens are recorded

After this line:

```typescript
// Record in rolling window for rate limit protection
recordSpawnInWindow({
  timestamp: Date.now(),
  inputTokens,
  outputTokens,
  costUsd,
  model,
});
```

Add:

```typescript
// Record in per-minute tracker
rateLimiter.recordSpawnEnd(inputTokens + outputTokens);
```

**Location**: Line ~888-895, in error handler where spawn fails early

In the `.catch()` block:

```typescript
}).catch(err => {
  console.error(`❌ Spawn error for ${agent.name}:`, err);

  // ============ NEW: Decrement concurrent on error ============
  rateLimiter.recordSpawnEnd(0); // No tokens used, but free up concurrent slot
  // ============ END ============

  // Also release claim on exception
  const currentTask = tasks.getTask(task.id);
  // ... rest of existing code
```

### Step 1.3: Test Per-Minute Tracking

Create test file: `parent-harness/orchestrator/src/spawner/rate-limiter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import rateLimiter from "./rate-limiter.js";

describe("MinuteWindowTracker", () => {
  beforeEach(() => {
    rateLimiter.reset();
  });

  it("should allow spawns under limit", () => {
    const check = rateLimiter.canSpawn();
    expect(check.allowed).toBe(true);
  });

  it("should block when concurrent limit reached", () => {
    // Start 3 spawns (limit is 3)
    rateLimiter.recordSpawnStart();
    rateLimiter.recordSpawnStart();
    rateLimiter.recordSpawnStart();

    const check = rateLimiter.canSpawn();
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("Concurrent limit");
  });

  it("should block when request limit reached", () => {
    // Record 35 requests (limit is 35/min)
    for (let i = 0; i < 35; i++) {
      rateLimiter.recordSpawnStart();
      rateLimiter.recordSpawnEnd(100); // Simulate completion
    }

    const check = rateLimiter.canSpawn();
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("request limit");
  });

  it("should allow spawns in new minute", async () => {
    // Max out current minute
    for (let i = 0; i < 35; i++) {
      rateLimiter.recordSpawnStart();
      rateLimiter.recordSpawnEnd(100);
    }

    expect(rateLimiter.canSpawn().allowed).toBe(false);

    // Wait for next minute (mock time in real impl)
    // For now, just verify logic exists
  });
});
```

Run test:

```bash
cd parent-harness/orchestrator
npm test -- rate-limiter.test.ts
```

---

## Phase 2: Assignment Gate (P0)

**File**: `parent-harness/orchestrator/src/orchestrator/index.ts`

### Step 2.1: Add Global Backoff State

**Location**: Top of file, after imports (~line 37, after existing global state)

```typescript
// ============ RATE LIMIT BACKOFF STATE ============
// Global pause when rate limited - prevents assignment storms
let rateLimitBackoffUntil = 0;
let rateLimitBackoffMs = 60000; // Start with 1 minute
const MAX_BACKOFF_MS = 900000; // Max 15 minutes

export function setRateLimitBackoff(durationMs: number): void {
  rateLimitBackoffUntil = Date.now() + durationMs;
  rateLimitBackoffMs = Math.min(durationMs * 2, MAX_BACKOFF_MS); // Exponential
  console.log(`⏸️ Rate limit backoff set: ${durationMs / 1000}s`);
}

export function clearRateLimitBackoff(): void {
  rateLimitBackoffUntil = 0;
  rateLimitBackoffMs = 60000; // Reset to 1 minute
  console.log(`✅ Rate limit backoff cleared`);
}

export function isRateLimited(): boolean {
  return Date.now() < rateLimitBackoffUntil;
}
// ============ END BACKOFF STATE ============
```

### Step 2.2: Gate Assignment Function

**Location**: `assignTasks()` function (~line 724), **at the very start**

```typescript
async function assignTasks(): Promise<number> {
  let assigned = 0;

  // Existing check
  if (isSpawningPaused()) {
    return assigned;
  }

  // ============ NEW: RATE LIMIT GATE ============
  if (isRateLimited()) {
    const remainingMs = rateLimitBackoffUntil - Date.now();
    const remainingSec = Math.ceil(remainingMs / 1000);

    // Log every 10 ticks to avoid spam
    if (tickCount % 10 === 0) {
      console.log(`⏸️ Rate limited - assignments paused for ${remainingSec}s more`);
    }

    return 0; // Don't assign anything
  }
  // ============ END GATE ============

  // Get pending tasks (with no unmet dependencies)
  let pendingTasks = tasks.getPendingTasks();
  // ... rest of existing function
```

### Step 2.3: Detect Rate Limits in Spawner

**File**: `parent-harness/orchestrator/src/spawner/index.ts`

**Location**: The existing `isRateLimitError()` function (~line 254) is already good. We need to USE it.

**Location**: In `spawnAgentSession()`, when spawn is rejected by rate limiter (~line 920, where we added the check)

Modify the rate limit rejection block:

```typescript
// ============ NEW: PER-MINUTE RATE LIMIT CHECK ============
const rateLimitCheck = rateLimiter.canSpawn();
if (!rateLimitCheck.allowed) {
  const { stats } = rateLimitCheck;
  console.warn(`⏸️ Rate limit: ${rateLimitCheck.reason}`);
  console.warn(
    `   Stats: ${stats.requests}/${rateLimiter.getStats().limits.maxRequestsPerMinute} req/min, ` +
      `${stats.tokens}/${rateLimiter.getStats().limits.maxTokensPerMinute} tok/min, ` +
      `${stats.concurrent} concurrent`,
  );

  // ============ NEW: Signal orchestrator to back off ============
  // Import at top: import * as orchestrator from '../orchestrator/index.js';
  const backoffMs = 60000; // 1 minute
  try {
    // Set backoff in orchestrator (stop assignments)
    const { setRateLimitBackoff } = await import("../orchestrator/index.js");
    setRateLimitBackoff(backoffMs);
  } catch (err) {
    console.warn("Failed to set rate limit backoff:", err);
  }
  // ============ END SIGNAL ============

  // Don't queue or claim - just reject
  return {
    success: false,
    sessionId: "",
    error: rateLimitCheck.reason || "Per-minute rate limit",
  };
}
```

**Location**: Also detect 429 errors from Claude API in `finishSession()` (~line 692-861)

After the line:

```typescript
const rateLimit = isRateLimitError(rawOutput);
```

Add:

```typescript
// If rate limit detected, signal orchestrator
if (rateLimit) {
  try {
    const { setRateLimitBackoff } = await import("../orchestrator/index.js");
    setRateLimitBackoff(60000); // 1 minute backoff
    console.log(`⏸️ 429 detected - triggering orchestrator backoff`);
  } catch (err) {
    console.warn("Failed to set rate limit backoff:", err);
  }
}
```

---

## Phase 3: State Cleanup (P0)

**File**: `parent-harness/orchestrator/src/spawner/index.ts`

### Step 3.1: Fix Session Cleanup Logic

**Location**: `finishSession()` callback (~line 811-861), in the `else` block (failure case)

**Current code** (around line 828-848):

```typescript
} else {
  sessions.updateSessionStatus(session.id, 'failed', output, errorMsg);
  const normalizedError = normalizeFailureReason(errorMsg || extractError(output) || output);
  // ...

  // Don't fail the task yet if it's a rate limit - caller will retry
  if (!rateLimit) {
    tasks.failTaskWithContext(taskId, {...});
    agents.incrementTasksFailed(agentId);
    events.taskFailed(...);
    ws.taskFailed(...);
    notify.taskFailed(...);
  }
  // ...
}
```

**Replace with**:

```typescript
} else {
  // Session failed
  sessions.updateSessionStatus(session.id, 'failed', output, errorMsg);
  const normalizedError = normalizeFailureReason(errorMsg || extractError(output) || output);

  try {
    sessions.logIteration(session.id, 1, {
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      cost: costUsd,
      durationMs: Date.now() - sessionStartTime,
      status: 'failed',
      errorMessage: normalizedError,
      outputMessage: output.slice(0, 2000),
    });
  } catch {
    // Non-fatal: iteration logging should not block failure handling.
  }

  // ============ NEW: ALWAYS CLEAN UP STATE ============
  // Even for rate limits, we must release the task/agent

  // 1. Release task claim (back to pending)
  tasks.updateTask(taskId, {
    status: 'pending',
    assigned_agent_id: null as any
  });

  // 2. Free agent
  agents.updateAgentStatus(agentId, 'idle', null, null);

  // 3. Only increment failure counter if NOT a rate limit
  //    (rate limits are system issues, not agent failures)
  if (!rateLimit) {
    agents.incrementTasksFailed(agentId);
  }

  // 4. Log events differently for rate limits vs real failures
  if (rateLimit) {
    // Rate limit - don't count as task failure
    events.systemWarning?.('rate_limiter', `Task ${task.display_id} paused due to rate limit`);
    console.log(`⏸️ ${task.display_id} released (rate limited, will retry)`);
  } else {
    // Real failure - log as task failed
    tasks.failTaskWithContext(taskId, {
      error: normalizedError,
      agentId,
      sessionId: session.id,
      source: 'spawner',
    });
    events.taskFailed(taskId, agentId, task.title, normalizedError, {
      source: 'spawner',
      taskDisplayId: task.display_id,
      sessionId: session.id,
    });
    ws.taskFailed(tasks.getTask(taskId), normalizedError);
    notify.taskFailed(agent.type, task.display_id, normalizedError, {
      taskId: task.id,
      taskDisplayId: task.display_id,
      sessionId: session.id,
      agentId: agent.id,
    }).catch(() => {});
  }
  // ============ END STATE CLEANUP ============

  // Update execution record for failure
  if (execution) {
    try {
      executions.failExecution(execution.id, normalizedError);
      activities.logTaskFailed(agentId, taskId, session.id, normalizedError);
    } catch (err) {
      console.warn('Failed to update execution record:', err);
    }
  }

  console.log(`❌ ${agent.name} failed ${task.display_id}: ${normalizedError.slice(0, 100)}`);
  resolve({
    success: false,
    sessionId: session.id,
    error: normalizedError,
    output,
    filesModified,
    isRateLimit: rateLimit
  });
}
```

### Step 3.2: Fix Early Spawn Failure Cleanup

**Location**: Line ~878-895, where spawn promise is handled

The existing cleanup is ALMOST correct, but needs to also decrement concurrent counter:

```typescript
}).then(result => {
  if (result.success) {
    console.log(`✅ ${agent.name} completed ${task.display_id}`);
  } else {
    console.log(`❌ ${agent.name} failed ${task.display_id}: ${result.error}`);
    // CRITICAL: Release task claim if spawn failed early (before agent started)
    // This prevents orphaned in_progress tasks
    const currentTask = tasks.getTask(task.id);
    if (currentTask && currentTask.status === 'in_progress' && !result.sessionId) {
      console.log(`🔓 Releasing claim on ${task.display_id} (spawn failed before start)`);
      // Use null to clear assigned_agent_id (undefined means "don't update")
      tasks.updateTask(task.id, { status: 'pending', assigned_agent_id: null as any });

      // ============ NEW: Also decrement concurrent ============
      rateLimiter.recordSpawnEnd(0); // Free concurrent slot
      // ============ END ============
    }
  }
}).catch(err => {
  console.error(`❌ Spawn error for ${agent.name}:`, err);

  // ============ NEW: Decrement concurrent on exception ============
  rateLimiter.recordSpawnEnd(0);
  // ============ END ============

  // Also release claim on exception
  const currentTask = tasks.getTask(task.id);
  if (currentTask && currentTask.status === 'in_progress') {
    console.log(`🔓 Releasing claim on ${task.display_id} (spawn exception)`);
    tasks.updateTask(task.id, { status: 'pending', assigned_agent_id: null as any });
  }
});
```

### Step 3.3: Add Event Type for Rate Limit

**File**: `parent-harness/orchestrator/src/db/events.ts`

**Location**: In the events object, add new event type:

```typescript
export const events = {
  // ... existing events ...

  systemWarning: (component: string, message: string) => {
    logEvent({
      event_type: "system:warning",
      component,
      message,
      payload: JSON.stringify({ component, message }),
    });
  },

  // ... rest of events
};
```

---

## Phase 4: Exponential Backoff (P1)

**File**: `parent-harness/orchestrator/src/orchestrator/index.ts`

### Step 4.1: Enhance Backoff Logic

**Location**: Replace the basic `setRateLimitBackoff()` we added in Phase 2 with this enhanced version:

```typescript
// ============ RATE LIMIT BACKOFF STATE (ENHANCED) ============
let rateLimitBackoffUntil = 0;
let rateLimitBackoffMs = 60000; // Start with 1 minute
let consecutiveRateLimits = 0;
let lastRateLimitTime = 0;
const MAX_BACKOFF_MS = 900000; // Max 15 minutes
const BACKOFF_RESET_WINDOW = 300000; // Reset counter after 5 min of success

export function setRateLimitBackoff(durationMs?: number): void {
  const now = Date.now();

  // Reset consecutive counter if we've had 5+ minutes of success
  if (now - lastRateLimitTime > BACKOFF_RESET_WINDOW) {
    consecutiveRateLimits = 0;
    rateLimitBackoffMs = 60000; // Reset to 1 minute
  }

  // Increment consecutive counter
  consecutiveRateLimits++;
  lastRateLimitTime = now;

  // Calculate exponential backoff: 1min, 2min, 4min, 8min, max 15min
  const calculatedBackoff = Math.min(
    60000 * Math.pow(2, consecutiveRateLimits - 1),
    MAX_BACKOFF_MS,
  );

  const backoff = durationMs || calculatedBackoff;
  rateLimitBackoffUntil = now + backoff;
  rateLimitBackoffMs = backoff;

  console.log(
    `⏸️ Rate limit backoff #${consecutiveRateLimits}: ${backoff / 1000}s`,
  );

  // Notify via Telegram on severe cases
  if (consecutiveRateLimits >= 3) {
    notify
      .forwardError(
        "rate_limit",
        `⚠️ Repeated rate limits (${consecutiveRateLimits}x) - backed off ${backoff / 1000}s`,
      )
      .catch(() => {});
  }
}

export function clearRateLimitBackoff(): void {
  const wasLimited = rateLimitBackoffUntil > 0;
  rateLimitBackoffUntil = 0;

  if (wasLimited) {
    console.log(
      `✅ Rate limit backoff cleared (was ${consecutiveRateLimits} consecutive)`,
    );
  }

  // Don't reset consecutiveRateLimits here - let time-based reset handle it
}

export function isRateLimited(): boolean {
  const limited = Date.now() < rateLimitBackoffUntil;

  // Auto-clear when backoff expires
  if (!limited && rateLimitBackoffUntil > 0) {
    clearRateLimitBackoff();
  }

  return limited;
}

export function getRateLimitStatus(): {
  isLimited: boolean;
  backoffUntil: number;
  remainingMs: number;
  consecutiveCount: number;
} {
  const now = Date.now();
  return {
    isLimited: isRateLimited(),
    backoffUntil: rateLimitBackoffUntil,
    remainingMs: Math.max(0, rateLimitBackoffUntil - now),
    consecutiveCount: consecutiveRateLimits,
  };
}
// ============ END BACKOFF STATE ============
```

---

## Phase 5: Config Reduction (P1)

**File**: `parent-harness/orchestrator/src/config/index.ts`

### Step 5.1: Update Default Config

**Location**: `DEFAULT_CONFIG` object (~line 73-121)

**Change these values**:

```typescript
const DEFAULT_CONFIG: HarnessConfig = {
  planning: {
    interval_hours: 24,
    model: "haiku",
    timeout_minutes: 15,
    enabled: true,
  },
  agents: {
    model: "opus",
    model_fallback: ["opus", "sonnet", "haiku"],
    timeout_minutes: 5,
    max_concurrent: 1, // ⬅️ CHANGED from 2 to 1 (ultra conservative)
    max_output_tokens: 16000,
    enabled: true,
  },
  budget: {
    daily_token_limit: 500000,
    warn_thresholds: [50, 80, 100],
    pause_at_limit: false,
    notify_telegram: true,
    p0_reserve_percent: 20,
  },
  cleanup: {
    retention_days: 7,
    auto_cleanup: true,
  },
  qa: {
    enabled: true,
    every_n_ticks: 10,
  },
  retry: {
    max_attempts: 5,
    backoff_base_ms: 30000,
    backoff_multiplier: 2,
    max_backoff_ms: 3600000,
  },
  circuit_breaker: {
    enabled: true,
    failure_threshold: 5,
    window_minutes: 30,
    cooldown_minutes: 60,
  },
  rate_limit: {
    max_spawns_per_window: 150, // ⬅️ CHANGED from 400 to 150
    max_cost_per_window_usd: 5, // ⬅️ CHANGED from 20 to 5
    spawn_cooldown_ms: 10000, // ⬅️ CHANGED from 5000 to 10000
    block_threshold_percent: 70, // ⬅️ CHANGED from 80 to 70
  },
};
```

### Step 5.2: Add Per-Minute Limits to Config Schema

**Location**: Config interface (~line 20-68), add new fields to `rate_limit`:

```typescript
rate_limit: {
  max_spawns_per_window: number; // Max spawns per 5-hour window
  max_cost_per_window_usd: number; // Max cost per 5-hour window
  spawn_cooldown_ms: number; // Min delay between spawns
  block_threshold_percent: number; // Block spawning at this %

  // ⬇️ NEW: Per-minute limits
  max_requests_per_minute: number; // Hard cap per minute
  max_tokens_per_minute: number; // Hard cap TPM
  max_concurrent: number; // Max concurrent spawns
}
```

And update defaults:

```typescript
rate_limit: {
  max_spawns_per_window: 150,
  max_cost_per_window_usd: 5,
  spawn_cooldown_ms: 10000,
  block_threshold_percent: 70,
  max_requests_per_minute: 35,   // ⬅️ NEW: 70% of 50 RPM
  max_tokens_per_minute: 28000,  // ⬅️ NEW: 70% of 40K TPM
  max_concurrent: 3,              // ⬅️ NEW: 60% of 5 concurrent
},
```

### Step 5.3: Wire Config to Rate Limiter

**File**: `parent-harness/orchestrator/src/spawner/rate-limiter.ts`

**Location**: After creating the singleton, add config watcher:

```typescript
// Singleton instance
export const rateLimiter = new MinuteWindowTracker();

// ⬇️ NEW: Wire to config system
try {
  const config = await import("../config/index.js");
  const cfg = config.getConfig();

  // Update limiter with config values
  if (cfg.rate_limit) {
    rateLimiter.updateLimits({
      maxRequestsPerMinute: cfg.rate_limit.max_requests_per_minute || 35,
      maxTokensPerMinute: cfg.rate_limit.max_tokens_per_minute || 28000,
      maxConcurrent: cfg.rate_limit.max_concurrent || 3,
    });
  }

  // Listen for config changes
  config.onConfigChange((newConfig) => {
    if (newConfig.rate_limit) {
      console.log("📊 Updating rate limiter from config");
      rateLimiter.updateLimits({
        maxRequestsPerMinute:
          newConfig.rate_limit.max_requests_per_minute || 35,
        maxTokensPerMinute: newConfig.rate_limit.max_tokens_per_minute || 28000,
        maxConcurrent: newConfig.rate_limit.max_concurrent || 3,
      });
    }
  });
} catch (err) {
  console.warn(
    "⚠️ Failed to load config for rate limiter, using defaults:",
    err,
  );
}
// ⬆️ END CONFIG WIRING

export default rateLimiter;
```

---

## Phase 6: Testing & Validation

### Step 6.1: Unit Tests

Run existing tests:

```bash
cd parent-harness/orchestrator
npm test
```

Expected: All existing tests pass + new rate-limiter tests pass.

### Step 6.2: Integration Test - Simulated Rate Limit

Create test file: `parent-harness/orchestrator/tests/rate-limit-integration.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import rateLimiter from "../src/spawner/rate-limiter.js";
import * as orchestrator from "../src/orchestrator/index.js";

describe("Rate Limit Integration", () => {
  beforeEach(() => {
    rateLimiter.reset();
    orchestrator.clearRateLimitBackoff();
  });

  it("should block assignments when per-minute limit hit", async () => {
    // Simulate hitting request limit
    for (let i = 0; i < 35; i++) {
      rateLimiter.recordSpawnStart();
      rateLimiter.recordSpawnEnd(100);
    }

    // Verify rate limiter blocks
    const check = rateLimiter.canSpawn();
    expect(check.allowed).toBe(false);

    // Verify orchestrator would skip assignments
    expect(orchestrator.isRateLimited()).toBe(false); // Not set yet

    // Trigger backoff
    orchestrator.setRateLimitBackoff(5000);
    expect(orchestrator.isRateLimited()).toBe(true);
  });

  it("should auto-clear backoff after expiry", async () => {
    orchestrator.setRateLimitBackoff(100); // 100ms
    expect(orchestrator.isRateLimited()).toBe(true);

    await new Promise((r) => setTimeout(r, 150)); // Wait for expiry

    expect(orchestrator.isRateLimited()).toBe(false);
  });

  it("should exponentially increase backoff on repeated limits", () => {
    const status1 = orchestrator.getRateLimitStatus();
    expect(status1.consecutiveCount).toBe(0);

    orchestrator.setRateLimitBackoff(); // 1min
    const status2 = orchestrator.getRateLimitStatus();
    expect(status2.consecutiveCount).toBe(1);

    orchestrator.setRateLimitBackoff(); // 2min
    const status3 = orchestrator.getRateLimitStatus();
    expect(status3.consecutiveCount).toBe(2);

    orchestrator.setRateLimitBackoff(); // 4min
    const status4 = orchestrator.getRateLimitStatus();
    expect(status4.consecutiveCount).toBe(3);
  });
});
```

Run:

```bash
npm test -- rate-limit-integration.test.ts
```

### Step 6.3: Manual E2E Test

#### Test Scenario: Artificial Rate Limit

1. **Lower limits drastically** (force rate limiting):

```bash
# Edit ~/.harness/config.json
cat > ~/.harness/config.json <<EOF
{
  "rate_limit": {
    "max_requests_per_minute": 5,
    "max_tokens_per_minute": 5000,
    "max_concurrent": 1
  },
  "agents": {
    "max_concurrent": 1
  }
}
EOF
```

2. **Create test tasks**:

```bash
cd parent-harness/orchestrator
npm run seed-tests
```

3. **Start orchestrator** and watch logs:

```bash
npm run dev 2>&1 | tee rate-limit-test.log
```

4. **Expected behavior**:
   - First 5 spawns succeed in minute 1
   - 6th spawn blocked with "Per-minute request limit"
   - Orchestrator sets backoff (60s)
   - Assignment loop pauses (logs "Rate limited - assignments paused")
   - After 60s, assignments resume
   - If limits hit again, backoff increases to 120s

5. **Verify metrics**:

```bash
sqlite3 ../data/harness.db <<EOF
-- Should see declining assignment amplification
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT task_id) as distinct_tasks,
  CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) as avg_per_task
FROM observability_events
WHERE event_type='task:assigned'
  AND created_at > datetime('now', '-10 minutes');

-- Should see no zombie sessions
SELECT COUNT(*) as running_sessions FROM agent_sessions WHERE status='running';
SELECT COUNT(*) as in_progress_tasks FROM tasks WHERE status='in_progress';
EOF
```

**Success criteria**:

- `avg_per_task` ≤ 1.5 (down from 8.12)
- `running_sessions` = `in_progress_tasks` (no desync)
- No 429 errors in logs
- Backoff triggers and clears properly

### Step 6.4: Soak Test (24 hours)

After manual test passes:

1. **Reset to production limits**:

```bash
cat > ~/.harness/config.json <<EOF
{
  "rate_limit": {
    "max_requests_per_minute": 35,
    "max_tokens_per_minute": 28000,
    "max_concurrent": 3
  },
  "agents": {
    "max_concurrent": 1
  }
}
EOF
```

2. **Run for 24 hours** with monitoring:

```bash
npm run dev 2>&1 | tee soak-test-$(date +%Y%m%d).log
```

3. **Check metrics every 6 hours**:

```bash
# Save as check-metrics.sh
#!/bin/bash
sqlite3 ../data/harness.db <<EOF
SELECT datetime('now') as timestamp;

-- Assignment health
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT task_id) as distinct_tasks,
  CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) as avg_per_task
FROM observability_events
WHERE event_type='task:assigned'
  AND created_at > datetime('now', '-6 hours');

-- State sync
SELECT
  (SELECT COUNT(*) FROM agent_sessions WHERE status='running') as running_sessions,
  (SELECT COUNT(*) FROM tasks WHERE status='in_progress') as in_progress_tasks;

-- Rate limit events
SELECT COUNT(*) as rate_limit_warnings
FROM observability_events
WHERE event_type='system:warning'
  AND message LIKE '%rate limit%'
  AND created_at > datetime('now', '-6 hours');

-- 429 errors
SELECT COUNT(*) as api_429_errors
FROM observability_events
WHERE event_type='system:error'
  AND payload LIKE '%429%'
  AND created_at > datetime('now', '-6 hours');
EOF
```

Run every 6 hours:

```bash
chmod +x check-metrics.sh
watch -n 21600 ./check-metrics.sh
```

**Success criteria over 24h**:

- Zero 429 errors
- avg_per_task ≤ 1.5
- running_sessions = in_progress_tasks
- rate_limit_warnings present but no cascading failures

---

## Phase 7: Observability (P2)

### Step 7.1: Add Rate Limit Status to API

**File**: `parent-harness/orchestrator/src/api/spawn.ts` (or create if missing)

```typescript
import { Router } from "express";
import rateLimiter from "../spawner/rate-limiter.js";
import * as orchestrator from "../orchestrator/index.js";

const router = Router();

/**
 * GET /api/rate-limit/status
 *
 * Returns current rate limit status
 */
router.get("/rate-limit/status", (req, res) => {
  const stats = rateLimiter.getStats();
  const backoffStatus = orchestrator.getRateLimitStatus();

  res.json({
    perMinute: {
      requests: {
        current: stats.currentMinute.requests,
        limit: stats.limits.maxRequestsPerMinute,
        percent: stats.utilizationPercent.requests,
      },
      tokens: {
        current: stats.currentMinute.tokens,
        limit: stats.limits.maxTokensPerMinute,
        percent: stats.utilizationPercent.tokens,
      },
      concurrent: {
        current: stats.concurrent,
        limit: stats.limits.maxConcurrent,
        percent: stats.utilizationPercent.concurrent,
      },
    },
    backoff: {
      isActive: backoffStatus.isLimited,
      until: backoffStatus.backoffUntil,
      remainingMs: backoffStatus.remainingMs,
      consecutiveCount: backoffStatus.consecutiveCount,
    },
    status: backoffStatus.isLimited ? "paused" : "active",
  });
});

export default router;
```

**File**: `parent-harness/orchestrator/src/server.ts`

Add route:

```typescript
import rateLimitRouter from "./api/spawn.js";

// ... in app setup
app.use("/api", rateLimitRouter);
```

### Step 7.2: Add Dashboard Widget

**File**: `parent-harness/dashboard/src/pages/Dashboard.tsx`

Add rate limit status card (location: in the grid near budget/health cards):

```tsx
import { useState, useEffect } from "react";

function RateLimitStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/rate-limit/status");
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error("Failed to fetch rate limit status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Update every 5s

    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const isWarning =
    status.perMinute.requests.percent > 70 ||
    status.perMinute.tokens.percent > 70 ||
    status.backoff.isActive;

  return (
    <div className={`card ${isWarning ? "border-warning" : "border-success"}`}>
      <h3>Rate Limit Status</h3>

      <div className="status-badge">
        {status.status === "paused" ? "⏸️ PAUSED" : "✅ Active"}
      </div>

      {status.backoff.isActive && (
        <div className="backoff-notice">
          Backoff active: {Math.ceil(status.backoff.remainingMs / 1000)}s
          remaining (#{status.backoff.consecutiveCount} consecutive)
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <label>Requests/min:</label>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${status.perMinute.requests.percent}%`,
                backgroundColor:
                  status.perMinute.requests.percent > 80
                    ? "#dc3545"
                    : "#28a745",
              }}
            />
          </div>
          <span>
            {status.perMinute.requests.current} /{" "}
            {status.perMinute.requests.limit}
          </span>
        </div>

        <div className="metric">
          <label>Tokens/min:</label>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{
                width: `${status.perMinute.tokens.percent}%`,
                backgroundColor:
                  status.perMinute.tokens.percent > 80 ? "#dc3545" : "#28a745",
              }}
            />
          </div>
          <span>
            {status.perMinute.tokens.current.toLocaleString()} /{" "}
            {status.perMinute.tokens.limit.toLocaleString()}
          </span>
        </div>

        <div className="metric">
          <label>Concurrent:</label>
          <span>
            {status.perMinute.concurrent.current} /{" "}
            {status.perMinute.concurrent.limit}
          </span>
        </div>
      </div>
    </div>
  );
}
```

---

## Rollback Plan

### If Implementation Causes Issues

1. **Immediate rollback** (5 minutes):

```bash
cd parent-harness
git reset --hard HEAD~1  # Undo last commit
npm run dev              # Restart with old code
```

2. **Partial rollback** (disable new features):

```bash
# Disable per-minute checks (revert to rolling window only)
# Edit spawner/index.ts, comment out rate limiter check:

/*
const rateLimitCheck = rateLimiter.canSpawn();
if (!rateLimitCheck.allowed) {
  // ... disabled
}
*/
```

3. **Config-only rollback** (keep code, raise limits):

```bash
cat > ~/.harness/config.json <<EOF
{
  "rate_limit": {
    "max_requests_per_minute": 1000,  # Effectively disabled
    "max_tokens_per_minute": 1000000,
    "max_concurrent": 10
  }
}
EOF
```

### Rollback Triggers

Rollback if any of these occur:

- **Critical**: Orchestrator crashes repeatedly (>3 in 10 min)
- **Critical**: Zero tasks complete in 1 hour (total blockage)
- **High**: Assignment rate drops to 0 for >30 min (over-gating)
- **High**: Database corruption events
- **Medium**: Tasks stuck in `in_progress` for >2 hours

Monitor with:

```bash
# Watch for crashes
journalctl -u harness -f

# Watch for zero throughput
watch -n 60 "sqlite3 ../data/harness.db \"SELECT COUNT(*) FROM tasks WHERE status='completed' AND completed_at > datetime('now', '-1 hour')\""
```

---

## Success Metrics

### Must Achieve (P0)

| Metric                   | Baseline  | Target    | Measurement                                                                                                                     |
| ------------------------ | --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Assignment amplification | 8.12/task | ≤1.5/task | `SELECT CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) FROM observability_events WHERE event_type='task:assigned'`            |
| Session-task sync        | 140 vs 0  | Equal     | `SELECT (SELECT COUNT(*) FROM agent_sessions WHERE status='running') - (SELECT COUNT(*) FROM tasks WHERE status='in_progress')` |
| 429 errors               | Unknown   | 0         | `SELECT COUNT(*) FROM observability_events WHERE payload LIKE '%429%' AND created_at > datetime('now', '-24 hours')`            |
| Max requests/min         | Unknown   | <35       | Monitor via dashboard                                                                                                           |

### Should Achieve (P1)

- Backoff triggers on rate limit detection
- Backoff clears after expiry
- Consecutive backoffs increase exponentially
- Telegram alerts sent on 3+ consecutive rate limits

### Nice to Have (P2)

- Dashboard shows real-time rate limit status
- Per-minute utilization visible in UI
- Historical rate limit events tracked

---

## Implementation Checklist

### Pre-Implementation

- [ ] Backup database
- [ ] Create feature branch
- [ ] Record baseline metrics
- [ ] Stop orchestrator

### Phase 1: Per-Minute Rate Tracking

- [ ] Create `rate-limiter.ts` module
- [ ] Add unit tests for rate limiter
- [ ] Integrate into spawner `canSpawn()` check
- [ ] Record spawn start/end with tokens
- [ ] Test: Verify concurrent limit blocks spawns
- [ ] Test: Verify request limit blocks spawns

### Phase 2: Assignment Gate

- [ ] Add global backoff state to orchestrator
- [ ] Gate `assignTasks()` function
- [ ] Signal backoff from spawner on rate limit
- [ ] Test: Verify assignments pause when rate limited

### Phase 3: State Cleanup

- [ ] Fix `finishSession()` cleanup for rate limits
- [ ] Always release task on spawn failure
- [ ] Always free agent on spawn failure
- [ ] Add `system:warning` event type
- [ ] Test: Verify no zombie sessions after rate limit

### Phase 4: Exponential Backoff

- [ ] Enhance backoff with consecutive counter
- [ ] Calculate exponential backoff (1m, 2m, 4m...)
- [ ] Reset counter after 5min success window
- [ ] Add Telegram alert on 3+ consecutive
- [ ] Test: Verify backoff increases correctly

### Phase 5: Config Reduction

- [ ] Update default config values
- [ ] Add per-minute limits to config schema
- [ ] Wire config to rate limiter
- [ ] Test: Verify config changes apply

### Phase 6: Testing & Validation

- [ ] Run unit tests (all pass)
- [ ] Run integration tests
- [ ] Manual E2E test with artificial limits
- [ ] 24-hour soak test
- [ ] Verify success metrics achieved

### Phase 7: Observability

- [ ] Add `/api/rate-limit/status` endpoint
- [ ] Add dashboard widget
- [ ] Test: Verify dashboard shows correct status

### Final Steps

- [ ] Update documentation
- [ ] Create PR with test results
- [ ] Get review + approval
- [ ] Merge to main
- [ ] Deploy to production
- [ ] Monitor for 48 hours

---

## Questions & Support

### Common Issues

**Q: Rate limiter blocks spawns but we're under budget**
A: This is correct behavior - per-minute limits are stricter than 5-hour limits. Check current minute stats via `/api/rate-limit/status`.

**Q: Assignments paused for >5 minutes**
A: Exponential backoff may have triggered. Check `getRateLimitStatus().consecutiveCount`. May need manual reset via Telegram `/start` command.

**Q: Tasks stuck in `pending` after rate limit clears**
A: Normal - they'll be picked up on next tick (30s). If stuck >2 min, check orchestrator is running.

**Q: Tests fail with "rateLimiter is not defined"**
A: Import order issue. Ensure `rate-limiter.ts` is imported before use. Check for circular dependencies.

### Debug Commands

```bash
# Check current rate limit status
curl http://localhost:3333/api/rate-limit/status | jq

# Check state sync
sqlite3 ../data/harness.db "SELECT
  (SELECT COUNT(*) FROM agent_sessions WHERE status='running') as sessions,
  (SELECT COUNT(*) FROM tasks WHERE status='in_progress') as tasks"

# Check recent assignments
sqlite3 ../data/harness.db "SELECT
  task_id,
  COUNT(*) as assignments,
  MIN(created_at) as first,
  MAX(created_at) as last
FROM observability_events
WHERE event_type='task:assigned'
  AND created_at > datetime('now', '-1 hour')
GROUP BY task_id
HAVING COUNT(*) > 2
ORDER BY assignments DESC"
```

### Contact

For issues during implementation:

- Check logs: `tail -f orchestrator.log`
- Check DB state: queries above
- Create issue: Include error logs + metrics

---

## Appendix A: File Change Summary

| File                            | Changes                                | Lines Modified |
| ------------------------------- | -------------------------------------- | -------------- |
| `spawner/rate-limiter.ts`       | NEW FILE                               | +200           |
| `spawner/index.ts`              | Add rate checks, cleanup               | +50, -20       |
| `orchestrator/index.ts`         | Add backoff state, gate assignments    | +80, -5        |
| `config/index.ts`               | Update defaults, add per-minute fields | +10, -5        |
| `api/spawn.ts`                  | NEW FILE (status endpoint)             | +50            |
| `db/events.ts`                  | Add system:warning event               | +10            |
| `dashboard/pages/Dashboard.tsx` | Add rate limit widget                  | +60            |

**Total**: ~460 lines added, ~30 lines removed

---

## Appendix B: Configuration Reference

### Recommended Production Config

```json
{
  "planning": {
    "interval_hours": 24,
    "model": "haiku",
    "timeout_minutes": 15,
    "enabled": true
  },
  "agents": {
    "model": "opus",
    "model_fallback": ["opus", "sonnet", "haiku"],
    "timeout_minutes": 5,
    "max_concurrent": 1,
    "max_output_tokens": 16000,
    "enabled": true
  },
  "budget": {
    "daily_token_limit": 500000,
    "warn_thresholds": [50, 80, 100],
    "pause_at_limit": false,
    "notify_telegram": true,
    "p0_reserve_percent": 20
  },
  "rate_limit": {
    "max_spawns_per_window": 150,
    "max_cost_per_window_usd": 5,
    "spawn_cooldown_ms": 10000,
    "block_threshold_percent": 70,
    "max_requests_per_minute": 35,
    "max_tokens_per_minute": 28000,
    "max_concurrent": 3
  },
  "retry": {
    "max_attempts": 5,
    "backoff_base_ms": 30000,
    "backoff_multiplier": 2,
    "max_backoff_ms": 3600000
  },
  "circuit_breaker": {
    "enabled": true,
    "failure_threshold": 5,
    "window_minutes": 30,
    "cooldown_minutes": 60
  }
}
```

Save to: `~/.harness/config.json`

---

**End of Action Plan**

Implementation time estimate: 2-3 days (1 day dev, 1-2 days testing)
