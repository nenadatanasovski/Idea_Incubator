# Critical Evaluation: Rate Limit Fix Action Plan

**Date**: 2026-02-11
**Evaluator**: Claude Code (First Principles Analysis)
**Document Under Review**: RATE-LIMIT-FIX-ACTION-PLAN.md
**Status**: ⚠️ **MAJOR GAPS IDENTIFIED - DO NOT IMPLEMENT AS-IS**

---

## Executive Summary

The rate limit fix action plan is **fundamentally sound in concept** but has **20+ critical gaps** that will cause implementation failures, race conditions, and potential data loss. The plan makes several false assumptions about API limits, token tracking, and concurrent execution that must be addressed before implementation.

**Severity Breakdown:**

- 🔴 **CRITICAL (P0)**: 8 issues that will cause immediate failures
- 🟠 **HIGH (P1)**: 7 issues that will cause instability under load
- 🟡 **MEDIUM (P2)**: 5 issues that reduce effectiveness
- 🔵 **LOW (P3)**: 4 issues that are cosmetic or minor

**Recommendation**: Fix P0 and P1 issues before any implementation. P2 issues should be addressed during implementation. P3 can be deferred.

---

## 🔴 CRITICAL ISSUES (P0 - Must Fix Before Implementation)

### 1. **Token Estimation Paradox**

**Location**: Phase 1, Step 1.2, Line 360

**Issue**: The plan calls `rateLimiter.recordSpawnEnd(inputTokens + outputTokens)` but these values are only known AFTER the spawn completes. Per-minute TPM enforcement requires knowing token usage BEFORE spawning.

**Current Code**:

```typescript
rateLimiter.recordSpawnEnd(inputTokens + outputTokens);
```

**Problem**: This records tokens retroactively, but `canSpawn()` checks `window.tokens >= maxTokensPerMinute` BEFORE spawning. The tokens from in-progress spawns aren't counted, allowing TPM overruns.

**Impact**: System can burst 3 concurrent spawns at 10K tokens each = 30K TPM, but only records them after completion. During the spawn, the rate limiter thinks TPM is 0.

**Fix Required**:

1. Add token estimation based on prompt size before spawn
2. Record estimated tokens in `recordSpawnStart(estimatedTokens)`
3. Adjust estimate with actual tokens in `recordSpawnEnd(actualTokens, estimatedTokens)`

```typescript
// In spawner, before spawn:
const estimatedTokens = estimateTokens(prompt, systemPrompt);
rateLimiter.recordSpawnStart(estimatedTokens);

// After spawn completes:
const actualTokens = inputTokens + outputTokens;
rateLimiter.recordSpawnEnd(actualTokens, estimatedTokens);

// In rate-limiter.ts:
recordSpawnStart(estimatedTokens: number): void {
  const window = this.getWindow(this.getCurrentMinute());
  window.requests++;
  window.tokens += estimatedTokens; // Add estimated tokens
  window.spawnsStarted++;
  this.concurrentActive++;
}

recordSpawnEnd(actualTokens: number, estimatedTokens: number): void {
  const window = this.getWindow(this.getCurrentMinute());
  // Adjust: remove estimate, add actual
  window.tokens = window.tokens - estimatedTokens + actualTokens;
  this.concurrentActive = Math.max(0, this.concurrentActive - 1);
}
```

---

### 2. **Circular Dependency Introduced**

**Location**: Phase 2, Step 2.3, Line 537

**Issue**: Plan imports orchestrator from spawner: `await import("../orchestrator/index.js")`. But orchestrator already imports spawner. This creates a circular dependency that can cause initialization failures.

**Current Dependency Chain**:

```
orchestrator/index.ts → spawner/index.ts
spawner/index.ts → orchestrator/index.ts (NEW)
```

**Problem**: Circular dependencies in ES modules can cause:

- Undefined values during initialization
- Race conditions on module load
- Unpredictable behavior across Node.js versions

**Fix Required**: Extract backoff state to a separate module that both can import:

```typescript
// Create: orchestrator/src/rate-limit/backoff-state.ts
let rateLimitBackoffUntil = 0;
let rateLimitBackoffMs = 60000;

export function setRateLimitBackoff(durationMs: number): void {
  rateLimitBackoffUntil = Date.now() + durationMs;
  console.log(`⏸️ Rate limit backoff set: ${durationMs / 1000}s`);
}

export function isRateLimited(): boolean {
  return Date.now() < rateLimitBackoffUntil;
}

// Import in both:
// spawner/index.ts
import { setRateLimitBackoff } from "../rate-limit/backoff-state.js";

// orchestrator/index.ts
import { isRateLimited } from "../rate-limit/backoff-state.js";
```

---

### 3. **Minute Window Boundary Gaming**

**Location**: Phase 1, rate-limiter.ts, Line 130

**Issue**: Discrete minute buckets using `Math.floor(Date.now() / 60000)` allow boundary gaming.

**Scenario**:

- 11:59:59.500 - Spawn 35 requests (minute bucket 100)
- 12:00:00.500 - Spawn 35 requests (minute bucket 101)
- **Result**: 70 requests in 1 second, but appears as 35/min in each bucket

**Problem**: Anthropic enforces per-minute limits with sliding windows or sub-minute granularity. Discrete buckets allow 2x bursts at boundaries.

**Fix Required**: Implement sliding window or smaller buckets:

```typescript
// Option 1: Sliding window (preferred)
class MinuteWindowTracker {
  private requests: Array<{ timestamp: number, tokens: number }> = [];

  canSpawn(): { allowed: boolean, reason?: string } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove requests older than 1 minute
    this.requests = this.requests.filter(r => r.timestamp > oneMinuteAgo);

    // Count in last minute
    const requestsInLastMinute = this.requests.length;
    const tokensInLastMinute = this.requests.reduce((sum, r) => sum + r.tokens, 0);

    if (requestsInLastMinute >= this.limits.maxRequestsPerMinute) {
      return { allowed: false, reason: 'Requests per minute exceeded' };
    }

    if (tokensInLastMinute >= this.limits.maxTokensPerMinute) {
      return { allowed: false, reason: 'Tokens per minute exceeded' };
    }

    return { allowed: true };
  }

  recordSpawnStart(estimatedTokens: number): void {
    this.requests.push({ timestamp: Date.now(), tokens: estimatedTokens });
    this.concurrentActive++;
  }
}

// Option 2: 10-second buckets (simpler)
private getCurrentBucket(): number {
  return Math.floor(Date.now() / 10000); // 10-second buckets
}

// Check last 6 buckets (60 seconds)
canSpawn(): { allowed: boolean, reason?: string } {
  const currentBucket = this.getCurrentBucket();
  let totalRequests = 0;
  let totalTokens = 0;

  for (let i = 0; i < 6; i++) {
    const bucket = this.windows.get(currentBucket - i);
    if (bucket) {
      totalRequests += bucket.requests;
      totalTokens += bucket.tokens;
    }
  }

  // Check totals
  if (totalRequests >= this.limits.maxRequestsPerMinute) {
    return { allowed: false, reason: 'RPM limit' };
  }

  if (totalTokens >= this.limits.maxTokensPerMinute) {
    return { allowed: false, reason: 'TPM limit' };
  }

  return { allowed: true };
}
```

---

### 4. **Race Condition in Concurrent Counter**

**Location**: Phase 1, rate-limiter.ts, Lines 199-206, 211-218

**Issue**: The `concurrentActive` counter has no mutex/lock for concurrent access.

**Scenario**:

```
Time T0: Task A calls canSpawn() → concurrentActive = 2 (allowed)
Time T1: Task B calls canSpawn() → concurrentActive = 2 (allowed)
Time T2: Task A calls recordSpawnStart() → concurrentActive = 3
Time T3: Task B calls recordSpawnStart() → concurrentActive = 4
```

**Problem**: Both tasks saw `concurrentActive = 2` and thought they could spawn, but now it's 4, exceeding limit of 3.

**Fix Required**: Use atomic compare-and-swap or mutex:

```typescript
// Option 1: Atomic reserve pattern
private concurrentReserved = 0; // Track reserved slots

canSpawnAndReserve(): { allowed: boolean, reason?: string, reservationId?: string } {
  if (this.concurrentReserved >= this.limits.maxConcurrent) {
    return { allowed: false, reason: 'Concurrent limit' };
  }

  // Atomically reserve slot
  this.concurrentReserved++;
  const reservationId = `${Date.now()}-${Math.random()}`;

  return { allowed: true, reservationId };
}

confirmSpawn(reservationId: string, estimatedTokens: number): void {
  // Confirm the reservation
  this.concurrentActive++;
  // reservationId used for cleanup if spawn fails before confirmation
}

releaseReservation(reservationId: string): void {
  this.concurrentReserved = Math.max(0, this.concurrentReserved - 1);
}

// Option 2: Separate reservation and execution
// In spawner:
const reservation = rateLimiter.canSpawnAndReserve();
if (!reservation.allowed) {
  return { success: false, error: reservation.reason };
}

try {
  rateLimiter.confirmSpawn(reservation.reservationId, estimatedTokens);
  // ... actual spawn
} catch (err) {
  rateLimiter.releaseReservation(reservation.reservationId);
  throw err;
}
```

---

### 5. **State Cleanup Loses Work**

**Location**: Phase 3, Step 3.1, Lines 628-636

**Issue**: State cleanup releases task to `pending` even if agent already started working.

**Scenario**:

```
1. Agent starts working on task (creates files, modifies code)
2. Mid-work, hits rate limit error
3. Cleanup sets task to 'pending', assigns to different agent
4. New agent starts from scratch, conflicts with partial work
```

**Problem**: No distinction between "spawn failed before agent started" vs "agent started but hit rate limit mid-work".

**Fix Required**: Add session state tracking:

```typescript
// In sessions table, add column:
agent_started_work BOOLEAN DEFAULT FALSE

// In spawner, when agent first outputs:
if (!session.agent_started_work && hasAgentOutput) {
  sessions.updateSession(session.id, { agent_started_work: true });
}

// In cleanup:
const session = sessions.getSession(sessionId);

if (rateLimit) {
  if (session.agent_started_work) {
    // Agent made progress - mark task as 'blocked', not 'pending'
    // Keep assignment to same agent to resume
    tasks.updateTask(taskId, {
      status: 'blocked',
      block_reason: 'rate_limit_mid_work',
      // Keep assigned_agent_id to resume with same agent
    });
    console.log(`⏸️ ${task.display_id} blocked mid-work (rate limit, will resume with same agent)`);
  } else {
    // Agent never started - safe to release
    tasks.updateTask(taskId, {
      status: 'pending',
      assigned_agent_id: null
    });
    agents.updateAgentStatus(agentId, 'idle', null, null);
    console.log(`⏸️ ${task.display_id} released (rate limit before start)`);
  }
}
```

---

### 6. **No Retry-After Header Parsing**

**Location**: Phase 2, Step 2.3, Line 568 and Phase 4

**Issue**: Plan hardcodes 60-second backoff, but Anthropic 429 responses include `Retry-After` header indicating exact wait time.

**Missing**: Header parsing from Claude API responses.

**Fix Required**: Parse Retry-After from 429 responses:

```typescript
// In spawner, enhance isRateLimitError:
interface RateLimitInfo {
  isRateLimit: boolean;
  retryAfterSeconds?: number;
}

function parseRateLimitError(output: string, headers?: any): RateLimitInfo {
  const isRateLimit = isRateLimitError(output);

  if (!isRateLimit) {
    return { isRateLimit: false };
  }

  // Parse Retry-After header
  let retryAfterSeconds = 60; // default

  if (headers?.["retry-after"]) {
    const retryAfter = headers["retry-after"];
    // Can be seconds (number) or HTTP date
    if (typeof retryAfter === "number") {
      retryAfterSeconds = retryAfter;
    } else if (typeof retryAfter === "string" && /^\d+$/.test(retryAfter)) {
      retryAfterSeconds = parseInt(retryAfter, 10);
    }
  }

  // Also parse from error message: "rate limit: retry after 120 seconds"
  const retryMatch = output.match(/retry after (\d+) seconds?/i);
  if (retryMatch) {
    retryAfterSeconds = parseInt(retryMatch[1], 10);
  }

  return {
    isRateLimit: true,
    retryAfterSeconds: Math.max(1, Math.min(retryAfterSeconds, 900)), // Clamp 1-900s
  };
}

// Use in backoff:
const rateLimitInfo = parseRateLimitError(rawOutput, responseHeaders);
if (rateLimitInfo.isRateLimit) {
  const backoffMs = rateLimitInfo.retryAfterSeconds * 1000;
  setRateLimitBackoff(backoffMs);
}
```

---

### 7. **False Assumption: Anthropic API Tier Limits**

**Location**: Phase 1, rate-limiter.ts, Lines 109-114

**Issue**: Plan assumes "Build tier: 50 RPM, 40K TPM, 5 concurrent" without verification.

**Problem**:

- API tier limits change based on account usage history
- Different models have different limits
- No code to detect actual tier

**Fix Required**: Add tier detection or make limits configurable:

```typescript
// Option 1: Auto-detect from 429 headers (best)
interface ApiTierLimits {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrent: number;
  detected: boolean;
}

let detectedLimits: ApiTierLimits | null = null;

function parseRateLimitHeaders(headers: any): Partial<ApiTierLimits> {
  const limits: Partial<ApiTierLimits> = {};

  // Anthropic returns rate limit headers:
  // x-ratelimit-limit-requests: "50"
  // x-ratelimit-limit-tokens: "40000"

  if (headers["x-ratelimit-limit-requests"]) {
    limits.requestsPerMinute = parseInt(
      headers["x-ratelimit-limit-requests"],
      10,
    );
  }

  if (headers["x-ratelimit-limit-tokens"]) {
    limits.tokensPerMinute = parseInt(headers["x-ratelimit-limit-tokens"], 10);
  }

  return limits;
}

// On first successful spawn, detect limits:
if (!detectedLimits && responseHeaders) {
  const detected = parseRateLimitHeaders(responseHeaders);
  if (detected.requestsPerMinute && detected.tokensPerMinute) {
    detectedLimits = {
      requestsPerMinute: detected.requestsPerMinute,
      tokensPerMinute: detected.tokensPerMinute,
      concurrent: 5, // Still need to guess this one
      detected: true,
    };

    // Apply 70% safety margin
    rateLimiter.updateLimits({
      maxRequestsPerMinute: Math.floor(detected.requestsPerMinute * 0.7),
      maxTokensPerMinute: Math.floor(detected.tokensPerMinute * 0.7),
    });

    console.log("📊 Auto-detected API tier limits:", detectedLimits);
  }
}

// Option 2: Make it loudly fail if wrong
const LIMITS_VERIFICATION_REQUIRED = true;

if (LIMITS_VERIFICATION_REQUIRED) {
  console.warn("⚠️ VERIFY API TIER LIMITS BEFORE DEPLOYMENT");
  console.warn("   Current assumption: 50 RPM / 40K TPM / 5 concurrent");
  console.warn("   Check: https://console.anthropic.com/settings/limits");
}
```

---

### 8. **Database Backup Incomplete**

**Location**: Pre-Implementation Checklist, Line 43

**Issue**: Backup command only copies main database file, not WAL (Write-Ahead Log) files.

**Problem**: SQLite in WAL mode stores recent transactions in `.db-wal` file. Backing up only `.db` loses recent writes.

**Current**:

```bash
cp parent-harness/data/harness.db parent-harness/data/harness.db.backup-$(date +%Y%m%d_%H%M%S)
```

**Fix Required**:

```bash
# Option 1: SQLite checkpoint before backup (flushes WAL to main db)
cd parent-harness/data
sqlite3 harness.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp harness.db harness.db.backup-$(date +%Y%m%d_%H%M%S)

# Option 2: Backup all files (main + WAL + SHM)
cd parent-harness/data
tar -czf harness.db.backup-$(date +%Y%m%d_%H%M%S).tar.gz harness.db*

# Option 3: Use SQLite backup API (best)
sqlite3 harness.db ".backup harness.db.backup-$(date +%Y%m%d_%H%M%S)"
```

---

## 🟠 HIGH PRIORITY ISSUES (P1 - Fix During Implementation)

### 9. **Exponential Backoff Doesn't Escalate**

**Location**: Phase 4, Step 4.1, Lines 783-786

**Issue**: Backoff resets if >5min since last rate limit, but doesn't track rate limit frequency.

**Scenario**:

- Hit rate limit at T+0, backoff 60s
- Hit rate limit at T+6min, backoff resets to 60s (not 120s)
- Hit rate limit at T+12min, backoff still 60s
- **Result**: System hits rate limits every 6 minutes forever, never escalates

**Problem**: Time-based reset doesn't distinguish between "one-off rate limit" and "persistent overload."

**Fix Required**: Track rate limit frequency, not just time:

```typescript
let rateLimitHistory: number[] = []; // timestamps of rate limits
const ESCALATION_WINDOW = 300000; // 5 minutes
const ESCALATION_THRESHOLD = 3; // 3 rate limits in 5 min = escalate

export function setRateLimitBackoff(durationMs?: number): void {
  const now = Date.now();

  // Add to history
  rateLimitHistory.push(now);

  // Keep only last 5 minutes
  rateLimitHistory = rateLimitHistory.filter(
    (t) => now - t < ESCALATION_WINDOW,
  );

  // Count rate limits in window
  const rateLimitsInWindow = rateLimitHistory.length;

  // Escalate if frequent
  if (rateLimitsInWindow >= ESCALATION_THRESHOLD) {
    consecutiveRateLimits++;
  } else {
    consecutiveRateLimits = 1; // Reset to 1, not 0 (still rate limited)
  }

  // Calculate backoff
  const calculatedBackoff = Math.min(
    60000 * Math.pow(2, consecutiveRateLimits - 1),
    MAX_BACKOFF_MS,
  );

  const backoff = durationMs || calculatedBackoff;
  rateLimitBackoffUntil = now + backoff;

  console.log(
    `⏸️ Rate limit backoff #${consecutiveRateLimits} (${rateLimitsInWindow} in 5min): ${backoff / 1000}s`,
  );
}
```

---

### 10. **No Task Queue During Backoff**

**Location**: Phase 2, Step 2.2, Lines 492-502

**Issue**: When rate limited, `assignTasks()` returns 0, but pending tasks aren't queued. When backoff clears, all pending tasks rush to spawn simultaneously.

**Problem**: Creates assignment storm when rate limit expires.

**Scenario**:

```
T+0: Rate limited, 50 pending tasks
T+0 to T+60: Tasks keep getting added, now 80 pending
T+60: Backoff clears, all 80 tasks try to spawn at once
T+60.1: Hit rate limit again from burst
```

**Fix Required**: Queue tasks during backoff, release gradually:

```typescript
// Add queue state
let rateLimitQueue: number[] = []; // task IDs waiting for rate limit
let queueDrainRate = 1; // tasks per tick when recovering

async function assignTasks(): Promise<number> {
  let assigned = 0;

  if (isSpawningPaused()) {
    return assigned;
  }

  // If rate limited, queue pending tasks
  if (isRateLimited()) {
    const remainingMs = rateLimitBackoffUntil - Date.now();
    const remainingSec = Math.ceil(remainingMs / 1000);

    // Add pending tasks to queue (don't spam, just new ones)
    const pending = tasks.getPendingTasks();
    for (const task of pending) {
      if (!rateLimitQueue.includes(task.id)) {
        rateLimitQueue.push(task.id);
      }
    }

    if (tickCount % 10 === 0) {
      console.log(
        `⏸️ Rate limited - ${rateLimitQueue.length} tasks queued, ${remainingSec}s remaining`,
      );
    }

    return 0;
  }

  // Backoff cleared - drain queue gradually
  if (rateLimitQueue.length > 0) {
    console.log(
      `🔄 Rate limit cleared - draining ${rateLimitQueue.length} queued tasks at rate ${queueDrainRate}/tick`,
    );

    // Take N tasks from queue
    const tasksToDrain = rateLimitQueue.splice(0, queueDrainRate);

    for (const taskId of tasksToDrain) {
      const task = tasks.getTask(taskId);
      if (task && task.status === "pending") {
        const agent = findBestAgent(task);
        if (agent) {
          await assignTask(task, agent);
          assigned++;
        }
      }
    }

    // Increase drain rate if going well (gradually resume normal operations)
    if (assigned === queueDrainRate) {
      queueDrainRate = Math.min(queueDrainRate + 1, 5); // Max 5 per tick during recovery
    }

    return assigned;
  }

  // Normal operation - reset drain rate
  queueDrainRate = 1;

  // Continue with normal assignment logic...
}
```

---

### 11. **Config Wiring May Fail**

**Location**: Phase 5, Step 5.3, Lines 965-996

**Issue**: Top-level `await` in module scope requires ES2022 and may not work in all environments.

**Problem**: If config loading fails, rate limiter uses hardcoded defaults silently.

**Fix Required**: Handle config loading failures explicitly:

```typescript
// Don't use top-level await, use initialization function
let configInitialized = false;

export async function initializeRateLimiter(): Promise<void> {
  if (configInitialized) return;

  try {
    const config = await import("../config/index.js");
    const cfg = config.getConfig();

    if (cfg.rate_limit) {
      rateLimiter.updateLimits({
        maxRequestsPerMinute: cfg.rate_limit.max_requests_per_minute || 35,
        maxTokensPerMinute: cfg.rate_limit.max_tokens_per_minute || 28000,
        maxConcurrent: cfg.rate_limit.max_concurrent || 3,
      });

      console.log(
        "📊 Rate limiter initialized from config:",
        rateLimiter.getStats().limits,
      );
    } else {
      throw new Error("rate_limit config missing");
    }

    config.onConfigChange((newConfig) => {
      if (newConfig.rate_limit) {
        console.log("📊 Updating rate limiter from config");
        rateLimiter.updateLimits({
          maxRequestsPerMinute:
            newConfig.rate_limit.max_requests_per_minute || 35,
          maxTokensPerMinute:
            newConfig.rate_limit.max_tokens_per_minute || 28000,
          maxConcurrent: newConfig.rate_limit.max_concurrent || 3,
        });
      }
    });

    configInitialized = true;
  } catch (err) {
    console.error("❌ CRITICAL: Failed to load rate limiter config:", err);
    console.error("   Using defaults: 35 RPM / 28K TPM / 3 concurrent");
    console.error("   This may not match your API tier - verify limits!");
    throw err; // Fail loudly
  }
}

// Call from server startup:
// In server.ts or orchestrator startup:
await initializeRateLimiter();
```

---

### 12. **No Priority-Based Load Shedding**

**Location**: Missing from entire plan

**Issue**: When approaching rate limits, all tasks are treated equally. P0 critical tasks blocked same as P3 nice-to-have.

**Problem**: Rate limiting should preferentially allow high-priority work.

**Fix Required**: Add priority-aware spawning:

```typescript
// In rate-limiter, add priority to canSpawn:
canSpawn(priority?: 'P0' | 'P1' | 'P2' | 'P3'): {
  allowed: boolean;
  reason?: string;
} {
  const currentMinute = this.getCurrentMinute();
  const window = this.getWindow(currentMinute);

  // Calculate utilization
  const requestUtilization = window.requests / this.limits.maxRequestsPerMinute;
  const tokenUtilization = window.tokens / this.limits.maxTokensPerMinute;
  const maxUtilization = Math.max(requestUtilization, tokenUtilization);

  // Priority-based thresholds
  const thresholds = {
    P0: 0.95, // P0 can spawn up to 95% utilization
    P1: 0.85, // P1 blocked at 85%
    P2: 0.70, // P2 blocked at 70%
    P3: 0.50, // P3 blocked at 50%
  };

  const threshold = thresholds[priority || 'P2'];

  if (maxUtilization >= threshold) {
    return {
      allowed: false,
      reason: `Priority ${priority || 'P2'} blocked at ${Math.round(maxUtilization * 100)}% utilization (threshold: ${threshold * 100}%)`
    };
  }

  // Other checks...
  return { allowed: true };
}

// In assignTasks, prefer P0 tasks:
const pending = tasks.getPendingTasks();
const sortedByPriority = pending.sort((a, b) => {
  const priorityWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };
  return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
});
```

---

### 13. **Test Coverage Inadequate**

**Location**: Phase 6, Testing section

**Issue**: Unit tests don't cover critical scenarios:

- Minute boundary transitions
- Concurrent spawn race conditions
- Token estimation accuracy
- Circular dependency scenarios

**Missing Tests**:

```typescript
// Missing: Boundary transition test
it("should enforce limits across minute boundaries", async () => {
  // Set time to 59.9 seconds
  jest.setSystemTime(new Date("2024-01-01T00:00:59.900Z"));

  // Fill up current minute
  for (let i = 0; i < 35; i++) {
    rateLimiter.recordSpawnStart(100);
    rateLimiter.recordSpawnEnd(100, 100);
  }

  expect(rateLimiter.canSpawn().allowed).toBe(false);

  // Advance to next minute
  jest.setSystemTime(new Date("2024-01-01T00:01:00.100Z"));

  // Should allow spawns in new minute
  expect(rateLimiter.canSpawn().allowed).toBe(true);
});

// Missing: Race condition test
it("should prevent concurrent counter race condition", async () => {
  const spawns = [];

  // Attempt 10 concurrent spawns (limit is 3)
  for (let i = 0; i < 10; i++) {
    spawns.push(
      (async () => {
        const check = rateLimiter.canSpawn();
        if (check.allowed) {
          rateLimiter.recordSpawnStart(100);
          await new Promise((r) => setTimeout(r, 10)); // Simulate spawn
          rateLimiter.recordSpawnEnd(100, 100);
          return "spawned";
        }
        return "blocked";
      })(),
    );
  }

  const results = await Promise.all(spawns);
  const spawned = results.filter((r) => r === "spawned").length;

  // Should only allow 3
  expect(spawned).toBeLessThanOrEqual(3);
});

// Missing: Token estimation accuracy test
it("should accurately estimate tokens", () => {
  const prompt = "Write a function that..."; // ~5 tokens
  const systemPrompt = "You are a helpful assistant..."; // ~5 tokens

  const estimated = estimateTokens(prompt, systemPrompt);

  // Should be within 20% of actual
  expect(estimated).toBeGreaterThan(8);
  expect(estimated).toBeLessThan(12);
});
```

**Fix Required**: Add comprehensive test suite before implementation.

---

### 14. **SQLite Concurrent Write Safety**

**Location**: Throughout plan - rate limiter writes to in-memory state, spawner writes to DB

**Issue**: Plan doesn't address SQLite concurrent write limitations.

**Problem**: SQLite can only have one writer at a time. If orchestrator tick, spawner, and rate limiter all write simultaneously, one will get `SQLITE_BUSY`.

**Current State**: Unknown if existing code handles `SQLITE_BUSY` retries.

**Fix Required**: Add database write retry logic:

```typescript
// In database/db.ts or wherever DB wrapper is
export async function writeWithRetry<T>(
  fn: () => T,
  maxRetries = 5,
  delayMs = 50,
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return fn();
    } catch (err) {
      if (err.code === "SQLITE_BUSY" && attempt < maxRetries - 1) {
        // Exponential backoff
        const delay = delayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Database write retry exhausted");
}

// Wrap critical writes:
await writeWithRetry(() => {
  tasks.updateTask(taskId, { status: "pending", assigned_agent_id: null });
});
```

---

### 15. **Rollback Plan Loses Uncommitted Work**

**Location**: Rollback Plan, Lines 1410-1413

**Issue**: `git reset --hard HEAD~1` loses any uncommitted changes or unfinished work.

**Problem**: If implementation is partially complete, rollback destroys debugging context.

**Fix Required**: Safer rollback strategy:

```bash
# DON'T DO THIS (loses work):
git reset --hard HEAD~1

# DO THIS (preserves work):
# Option 1: Stash current work
git stash push -m "rate-limit-fix-rollback-$(date +%Y%m%d_%H%M%S)"
git checkout main
# Work is saved in stash for later analysis

# Option 2: Create rollback branch
git checkout -b rate-limit-fix-failed-$(date +%Y%m%d_%H%M%S)
git commit -am "WIP: Rate limit fix before rollback (FAILED)"
git checkout main
# Failed implementation preserved in branch for debugging

# Option 3: Revert commits (keeps history)
git revert HEAD~1..HEAD
# Creates new commits that undo changes, preserves history
```

---

## 🟡 MEDIUM PRIORITY ISSUES (P2 - Fix During Implementation)

### 16. **Cost Tracking Mismatch**

**Location**: Phase 5, Config, Lines 913-914

**Issue**: Config tracks both `max_spawns_per_window` (150) and `max_cost_per_window_usd` ($5), but doesn't specify which takes precedence.

**Problem**: 150 spawns might cost more or less than $5 depending on model/tokens. Conflicting limits could:

- Block spawns when under budget (if spawn count hits first)
- Overspend if cost hits first but spawn count still allows

**Fix Required**: Clarify precedence and check both:

```typescript
// In spawner, check both limits:
function checkBudgetAllowsSpawn(estimatedCostUsd: number): boolean {
  const window = getSpawnWindow();

  // Check spawn count
  if (window.spawnCount >= config.rate_limit.max_spawns_per_window) {
    console.warn(
      `⏸️ Spawn count limit (${window.spawnCount}/${config.rate_limit.max_spawns_per_window})`,
    );
    return false;
  }

  // Check cost
  if (
    window.totalCost + estimatedCostUsd >=
    config.rate_limit.max_cost_per_window_usd
  ) {
    console.warn(
      `⏸️ Cost limit ($${window.totalCost.toFixed(2)}/${config.rate_limit.max_cost_per_window_usd})`,
    );
    return false;
  }

  return true; // Both limits OK
}

// Document: Both limits are enforced, whichever hits first blocks spawning
```

---

### 17. **Dashboard Polling Load**

**Location**: Phase 7, Step 7.2, Line 1322

**Issue**: Dashboard polls `/api/rate-limit/status` every 5 seconds. If multiple users open dashboard, polling itself could contribute to server load.

**Problem**: Not a rate limit issue (internal API), but adds unnecessary load.

**Fix Required**: Use WebSocket streaming instead:

```typescript
// In websocket.ts, add rate limit broadcasts:
export function broadcastRateLimitStatus(): void {
  const stats = rateLimiter.getStats();
  const backoff = orchestrator.getRateLimitStatus();

  const payload = {
    type: "rate_limit_status",
    data: {
      perMinute: {
        /* stats */
      },
      backoff: {
        /* backoff */
      },
      status: backoff.isLimited ? "paused" : "active",
    },
    timestamp: Date.now(),
  };

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  });
}

// Call from rate limiter on changes:
// After recordSpawnStart/End, check if utilization crossed threshold and broadcast
if (utilizationChanged) {
  broadcastRateLimitStatus();
}

// In dashboard, use WebSocket instead of polling:
const ws = new WebSocket("ws://localhost:3333");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "rate_limit_status") {
    setStatus(msg.data);
  }
};
```

---

### 18. **No Distributed Rate Limiting**

**Location**: Missing from entire plan

**Issue**: If multiple orchestrator instances run (future scaling), each tracks rate limits independently.

**Problem**: Two instances could each think they're at 50% utilization, both spawn, totaling 100% → rate limit.

**Not Urgent**: Only matters if running multiple orchestrators, which plan doesn't mention.

**Fix Required** (future): Use shared state (Redis) for rate tracking:

```typescript
// If multiple orchestrators in future, use Redis:
import Redis from "ioredis";
const redis = new Redis();

class DistributedRateLimiter {
  async canSpawn(): Promise<boolean> {
    const minute = Math.floor(Date.now() / 60000);
    const key = `rate_limit:${minute}`;

    // Atomic increment
    const requests = await redis.incr(`${key}:requests`);
    await redis.expire(`${key}:requests`, 120); // 2 min TTL

    if (requests > this.limits.maxRequestsPerMinute) {
      return false;
    }

    return true;
  }
}
```

**Defer** until multi-instance deployment needed.

---

### 19. **No Historical Rate Limit Analytics**

**Location**: Phase 7 (Observability) doesn't include long-term tracking

**Issue**: Can't answer questions like:

- "How often do we hit rate limits?"
- "What times of day are problematic?"
- "Is the pattern improving over time?"

**Fix Required**: Add metrics collection:

```typescript
// Store rate limit events in observability_events:
events.rateLimitHit({
  minute: currentMinute,
  requests: window.requests,
  tokens: window.tokens,
  concurrent: concurrent,
  backoffMs: backoffMs,
  consecutiveCount: consecutiveCount
});

// Query for analytics:
SELECT
  DATE(created_at) as date,
  COUNT(*) as rate_limit_count,
  AVG(JSON_EXTRACT(payload, '$.backoffMs')) as avg_backoff_ms
FROM observability_events
WHERE event_type = 'rate_limit:hit'
  AND created_at > DATE('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

### 20. **Manual Soak Test Not Sustainable**

**Location**: Phase 6.4, Lines 1153-1230

**Issue**: "Run for 24 hours" with manual monitoring is not practical for CI/CD.

**Problem**: Requires human to watch logs for 24 hours. Not repeatable, not automatable.

**Fix Required**: Automated soak test:

```typescript
// Create: tests/soak/rate-limit-soak.test.ts
import { describe, it, beforeAll, afterAll } from "vitest";

describe("Rate Limit Soak Test (24h)", () => {
  let metricsCollector: NodeJS.Timeout;
  let metrics: any[] = [];

  beforeAll(async () => {
    // Start orchestrator
    await startOrchestrator();

    // Collect metrics every 5 minutes
    metricsCollector = setInterval(
      async () => {
        const snapshot = await collectMetrics();
        metrics.push(snapshot);

        // Check invariants
        if (snapshot.assignment_amplification > 1.5) {
          throw new Error(
            `Assignment amplification too high: ${snapshot.assignment_amplification}`,
          );
        }

        if (snapshot.session_task_diff > 0) {
          throw new Error(`Session-task desync: ${snapshot.session_task_diff}`);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes
  }, 30000);

  afterAll(async () => {
    clearInterval(metricsCollector);
    await stopOrchestrator();

    // Generate report
    await generateSoakReport(metrics);
  });

  it(
    "should run for 24 hours without failures",
    async () => {
      // Wait 24 hours
      await new Promise((r) => setTimeout(r, 24 * 60 * 60 * 1000));

      // Check final metrics
      const finalMetrics = await collectMetrics();

      expect(finalMetrics.api_429_errors).toBe(0);
      expect(finalMetrics.assignment_amplification).toBeLessThanOrEqual(1.5);
      expect(finalMetrics.session_task_diff).toBe(0);
    },
    24 * 60 * 60 * 1000 + 10000,
  ); // 24h + buffer
});
```

---

## 🔵 LOW PRIORITY ISSUES (P3 - Nice to Have)

### 21. **Hardcoded Magic Numbers**

**Location**: Throughout plan (60000, 35, 28000, etc.)

**Issue**: Magic numbers scattered through code make it hard to understand and maintain.

**Fix**: Extract to constants:

```typescript
// rate-limiter-constants.ts
export const TIME_CONSTANTS = {
  MILLISECONDS_PER_MINUTE: 60000,
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
} as const;

export const DEFAULT_BACKOFF = {
  INITIAL_MS: 60000, // 1 minute
  MAX_MS: 900000, // 15 minutes
  RESET_WINDOW_MS: 300000, // 5 minutes
  MULTIPLIER: 2,
} as const;

export const DEFAULT_SAFETY_MARGINS = {
  RPM_PERCENT: 0.7, // 70% of tier limit
  TPM_PERCENT: 0.7,
  CONCURRENT_PERCENT: 0.6, // 60% of tier limit
} as const;
```

---

### 22. **Error Messages Not User-Friendly**

**Location**: Throughout plan

**Issue**: Error messages like "Per-minute request limit" don't explain to users what to do.

**Fix**: Add actionable messages:

```typescript
// Before:
reason: "Per-minute request limit";

// After:
reason: "Rate limit: Too many requests per minute (35/35). System will automatically retry in 60 seconds. To avoid this, reduce concurrent agents or increase spawn cooldown in config.";

// Even better: Include help links
reason: `Rate limit: Requests per minute exceeded (${stats.requests}/${limits.maxRequestsPerMinute}). ` +
  `System will retry automatically. ` +
  `See: https://docs.yourproject.com/rate-limiting for tuning guide.`;
```

---

### 23. **No Graceful Shutdown**

**Location**: Missing from entire plan

**Issue**: If orchestrator is stopped mid-spawn, rate limiter state (concurrent counter) is lost.

**Fix**: Add graceful shutdown:

```typescript
// In server.ts
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received, graceful shutdown...");

  // Stop accepting new spawns
  isShuttingDown = true;

  // Wait for in-flight spawns to complete (max 5 min)
  const waitForCompletion = async (timeoutMs = 300000) => {
    const start = Date.now();
    while (rateLimiter.getStats().concurrent > 0) {
      if (Date.now() - start > timeoutMs) {
        console.warn("⚠️ Timeout waiting for spawns, forcing shutdown");
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  };

  await waitForCompletion();

  console.log("✅ All spawns completed, exiting");
  process.exit(0);
});
```

---

### 24. **Metrics Don't Include Throughput**

**Location**: Success Metrics, Lines 1465-1488

**Issue**: Success metrics track "assignments per task" and "session-task sync" but not actual productivity.

**Missing Metric**: Tasks completed per hour.

**Scenario**: System could have perfect metrics but complete 0 tasks/hour if all assignments fail.

**Fix**: Add throughput metrics:

```typescript
// Add to success metrics:
| Throughput              | Unknown | >10/hour | `SELECT COUNT(*) FROM tasks WHERE status='completed' AND completed_at > datetime('now', '-1 hour')` |
| Median completion time  | Unknown | <30min   | `SELECT MEDIAN(JULIANDAY(completed_at) - JULIANDAY(created_at)) * 24 * 60 FROM tasks WHERE status='completed'` |
| Agent utilization       | Unknown | >60%     | `(time_working / (time_working + time_idle + time_rate_limited)) * 100` |
```

---

## Summary of Required Changes

### Before Implementation

1. **Add token estimation** (Critical #1)
2. **Fix circular dependency** (Critical #2)
3. **Implement sliding window** (Critical #3)
4. **Add concurrent counter mutex** (Critical #4)
5. **Fix state cleanup** (Critical #5)
6. **Parse Retry-After header** (Critical #6)
7. **Detect API tier limits** (Critical #7)
8. **Fix database backup** (Critical #8)

### During Implementation

9. **Fix backoff escalation** (High #9)
10. **Add task queue** (High #10)
11. **Fix config wiring** (High #11)
12. **Add priority load shedding** (High #12)
13. **Add comprehensive tests** (High #13)
14. **Add SQLite write retry** (High #14)
15. **Fix rollback plan** (High #15)

### Nice to Have

16-24: Medium and low priority improvements

---

## Recommendation

**DO NOT IMPLEMENT THE PLAN AS-IS.** Fix the 8 critical issues first, then implement with the 7 high-priority fixes integrated. The plan is 70% correct but the 30% that's wrong will cause:

- Rate limit overruns (token estimation missing)
- Deployment failures (circular dependencies)
- Race conditions (concurrent counter)
- Data loss (state cleanup bug)
- Assignment storms (no queue during backoff)

**Estimated Additional Effort**: 1-2 days to fix issues before starting implementation.

**Total Revised Estimate**: 3-5 days (2 days fixes + 1-3 days implementation + testing)

---

## Next Steps

1. **Review this evaluation** with team
2. **Prioritize fixes** - which P0 issues to address first
3. **Update action plan** with fixes integrated
4. **Re-estimate timeline** with fixes included
5. **Begin implementation** only after P0 issues resolved

Would you like me to:

- Create fixed versions of specific files (rate-limiter.ts with token estimation + sliding window)?
- Generate comprehensive test suite?
- Write detailed fix for any specific issue?
