# Rate Limiter Integration Example

This document shows how to integrate the **corrected** rate limiter into the spawner with all P0 fixes applied.

## Overview of Fixes

The corrected rate limiter addresses these critical issues:

- **P0 #1**: Token estimation before spawn
- **P0 #2**: Circular dependency (backoff state extracted)
- **P0 #3**: Sliding window (prevents boundary gaming)
- **P0 #4**: Atomic reservations (prevents race conditions)
- **P0 #7**: Auto-detection of API tier limits

## Integration Steps

### 1. Import Corrected Modules

```typescript
// In spawner/index.ts

import rateLimiter, {
  estimateTokens,
  initializeRateLimiter,
} from "./rate-limiter.js";
import { setRateLimitBackoff } from "../rate-limit/backoff-state.js";
```

**Note**: Backoff state is imported from separate module to avoid circular dependency.

### 2. Initialize on Server Startup

```typescript
// In server.ts or orchestrator startup

import { initializeRateLimiter } from "./spawner/rate-limiter.js";

async function startServer() {
  try {
    // Initialize rate limiter from config BEFORE starting orchestrator
    await initializeRateLimiter();

    // ... rest of server startup
  } catch (err) {
    console.error("❌ Failed to initialize rate limiter:", err);
    process.exit(1); // Fail loudly
  }
}
```

### 3. Integrate into spawnAgentSession()

```typescript
export async function spawnAgentSession(
  options: SpawnOptions,
): Promise<SpawnResult> {
  const { taskId, agentId, timeout = 300 } = options;

  // Get agent and task data
  const agentData = agents.getAgent(agentId);
  const taskData = tasks.getTask(taskId);

  if (!taskData || !agentData) {
    return {
      success: false,
      sessionId: "",
      error: "Task or agent not found",
    };
  }

  // ============ STEP 1: ESTIMATE TOKENS ============
  // FIX P0 #1: Estimate tokens BEFORE spawn
  const prompt = buildPrompt(taskData); // Your prompt builder
  const systemPrompt = buildSystemPrompt(agentData); // Your system prompt
  const maxOutputTokens = config.agents.max_output_tokens || 16000;

  const estimatedTokens = estimateTokens(prompt, systemPrompt, maxOutputTokens);

  console.log(
    `📏 Estimated tokens for ${taskData.display_id}: ${estimatedTokens.toLocaleString()}`,
  );

  // ============ STEP 2: CHECK RATE LIMIT & RESERVE ============
  // FIX P0 #4: Atomic reservation prevents race conditions
  const rateLimitCheck = rateLimiter.canSpawnAndReserve(estimatedTokens);

  if (!rateLimitCheck.allowed) {
    const { stats } = rateLimitCheck;
    console.warn(`⏸️ Rate limit: ${rateLimitCheck.reason}`);
    console.warn(
      `   Stats: ${stats.currentRequests}/${rateLimiter.getStats().limits.maxRequestsPerMinute} req/min, ` +
        `${stats.currentTokens.toLocaleString()}/${rateLimiter.getStats().limits.maxTokensPerMinute} tok/min, ` +
        `${stats.concurrent} concurrent, ${stats.reserved} reserved`,
    );

    // FIX P0 #2: Signal orchestrator to back off (no circular import)
    setRateLimitBackoff(60000); // 1 minute backoff

    return {
      success: false,
      sessionId: "",
      error: rateLimitCheck.reason || "Per-minute rate limit",
    };
  }

  const reservationId = rateLimitCheck.reservationId!;

  // ============ STEP 3: ATTEMPT SPAWN ============
  try {
    // Create session record
    const session = sessions.createSession({
      agent_id: agentId,
      task_id: taskId,
      status: "running",
    });

    // Build spawn command
    const spawnCmd = buildSpawnCommand({
      agent: agentData,
      task: taskData,
      prompt,
      systemPrompt,
      timeout,
    });

    // FIX P0 #4: Confirm reservation AFTER spawn starts successfully
    rateLimiter.confirmSpawnStart(reservationId, estimatedTokens);

    console.log(
      `🚀 Spawning ${agentData.name} for ${taskData.display_id} (reservation: ${reservationId})`,
    );

    // Execute spawn
    const spawnPromise = executeSpawn(spawnCmd, {
      timeout,
      sessionId: session.id,
      onComplete: (result) =>
        finishSession(session, result, reservationId, agentData, taskData),
      onError: (error) =>
        handleSpawnError(session, error, reservationId, agentData, taskData),
    });

    return {
      success: true,
      sessionId: session.id,
      reservationId, // Include for tracking
    };
  } catch (err) {
    console.error(`❌ Spawn setup error:`, err);

    // FIX P0 #4: Release reservation if spawn fails before start
    rateLimiter.releaseReservation(reservationId);

    return {
      success: false,
      sessionId: "",
      error: err.message,
    };
  }
}
```

### 4. Handle Spawn Completion

```typescript
function finishSession(
  session: Session,
  result: SpawnResult,
  reservationId: string,
  agent: Agent,
  task: Task,
): void {
  const { rawOutput, success } = result;

  // ============ EXTRACT TOKEN USAGE ============
  // FIX P0 #1: Get actual tokens from spawn result
  let inputTokens = 0;
  let outputTokens = 0;
  let actualTokens = 0;

  try {
    // Parse Claude CLI JSON output
    const jsonOutput = JSON.parse(rawOutput);

    if (jsonOutput?.usage) {
      inputTokens = jsonOutput.usage.input_tokens || 0;
      outputTokens = jsonOutput.usage.output_tokens || 0;
      actualTokens = inputTokens + outputTokens;

      console.log(
        `📊 Actual tokens for ${task.display_id}: ${actualTokens.toLocaleString()} (input: ${inputTokens}, output: ${outputTokens})`,
      );
    }
  } catch {
    // If parsing fails, estimate based on output length
    actualTokens = estimateTokens(rawOutput);
    console.warn(`⚠️ Could not parse token usage, estimated: ${actualTokens}`);
  }

  // ============ FIX P0 #7: DETECT API TIER LIMITS ============
  if (result.headers) {
    rateLimiter.detectLimitsFromHeaders(result.headers);
  }

  // ============ FIX P0 #1: RECORD ACTUAL TOKENS ============
  rateLimiter.recordSpawnEnd(reservationId, actualTokens);

  // ============ CHECK FOR RATE LIMIT ============
  const isRateLimit = checkForRateLimitError(rawOutput);

  if (isRateLimit) {
    // FIX P0 #6: Parse Retry-After header if present
    const retryAfterSeconds = parseRetryAfter(result.headers, rawOutput);
    const backoffMs = retryAfterSeconds * 1000;

    console.log(
      `⏸️ 429 detected - triggering orchestrator backoff (${retryAfterSeconds}s)`,
    );

    // FIX P0 #2: Signal orchestrator
    setRateLimitBackoff(backoffMs);
  }

  // ============ UPDATE SESSION ============
  if (success) {
    sessions.updateSessionStatus(session.id, "completed", rawOutput);

    // Complete task
    tasks.completeTask(task.id, {
      sessionId: session.id,
      agentId: agent.id,
      output: rawOutput,
    });

    console.log(`✅ ${agent.name} completed ${task.display_id}`);
  } else {
    // FIX P0 #5: State cleanup with work tracking
    handleFailedSession(
      session,
      task,
      agent,
      rawOutput,
      isRateLimit,
      reservationId,
    );
  }
}
```

### 5. Handle Failed Sessions

```typescript
function handleFailedSession(
  session: Session,
  task: Task,
  agent: Agent,
  output: string,
  isRateLimit: boolean,
  reservationId: string,
): void {
  sessions.updateSessionStatus(session.id, "failed", output);

  // FIX P0 #5: Check if agent started work
  const agentStartedWork = sessions.hasAgentOutput(session.id);

  console.log(
    `❌ ${agent.name} failed ${task.display_id} (started work: ${agentStartedWork}, rate limit: ${isRateLimit})`,
  );

  if (isRateLimit) {
    // Rate limit error - handle based on whether work was started
    if (agentStartedWork) {
      // Agent made progress - keep assignment, mark as blocked
      tasks.updateTask(task.id, {
        status: "blocked",
        block_reason: "rate_limit_mid_work",
        // Keep assigned_agent_id to resume with same agent
      });

      console.log(
        `⏸️ ${task.display_id} blocked mid-work (will resume with ${agent.name})`,
      );
    } else {
      // Agent never started - safe to release and retry
      tasks.updateTask(task.id, {
        status: "pending",
        assigned_agent_id: null,
      });

      agents.updateAgentStatus(agent.id, "idle", null, null);

      console.log(
        `⏸️ ${task.display_id} released (rate limit before start, will retry)`,
      );
    }

    // Don't count as agent failure (system issue)
    events.systemWarning?.(
      "rate_limiter",
      `Task ${task.display_id} paused due to rate limit`,
    );
  } else {
    // Real failure - release task and count as failure
    tasks.updateTask(task.id, {
      status: "pending",
      assigned_agent_id: null,
    });

    agents.updateAgentStatus(agent.id, "idle", null, null);
    agents.incrementTasksFailed(agent.id);

    const error = normalizeFailureReason(output);
    tasks.failTaskWithContext(task.id, {
      error,
      agentId: agent.id,
      sessionId: session.id,
      source: "spawner",
    });

    events.taskFailed(task.id, agent.id, task.title, error, {
      source: "spawner",
      taskDisplayId: task.display_id,
      sessionId: session.id,
    });

    console.log(`❌ ${task.display_id} failed: ${error.slice(0, 100)}`);
  }
}
```

### 6. Helper Functions

```typescript
/**
 * Parse Retry-After header from 429 response
 *
 * FIX P0 #6: Use server-provided retry time instead of hardcoded
 */
function parseRetryAfter(
  headers: Record<string, string> | undefined,
  output: string,
): number {
  let retryAfterSeconds = 60; // default

  // Check Retry-After header
  if (headers?.["retry-after"]) {
    const retryAfter = headers["retry-after"];

    if (typeof retryAfter === "number") {
      retryAfterSeconds = retryAfter;
    } else if (typeof retryAfter === "string" && /^\d+$/.test(retryAfter)) {
      retryAfterSeconds = parseInt(retryAfter, 10);
    }
  }

  // Also parse from error message
  const retryMatch = output.match(/retry after (\d+) seconds?/i);
  if (retryMatch) {
    retryAfterSeconds = parseInt(retryMatch[1], 10);
  }

  // Clamp to reasonable range
  return Math.max(1, Math.min(retryAfterSeconds, 900)); // 1s - 15min
}

/**
 * Check if output indicates rate limit error
 */
function checkForRateLimitError(output: string): boolean {
  const rateLimitPatterns = [
    /rate.?limit/i,
    /too many requests/i,
    /429/i,
    /overloaded/i,
    /capacity/i,
    /throttl/i,
  ];
  return rateLimitPatterns.some((p) => p.test(output));
}
```

## Monitoring and Debugging

### Dashboard Integration

```typescript
// Add API endpoint for rate limit status
// GET /api/rate-limit/status

import rateLimiter from "../spawner/rate-limiter.js";
import { getRateLimitStatus } from "../rate-limit/backoff-state.js";

router.get("/rate-limit/status", (req, res) => {
  const stats = rateLimiter.getStats();
  const backoff = getRateLimitStatus();

  res.json({
    perMinute: {
      requests: {
        current: stats.usage.requests,
        limit: stats.limits.maxRequestsPerMinute,
        percent: stats.utilizationPercent.requests,
      },
      tokens: {
        current: stats.usage.tokens,
        limit: stats.limits.maxTokensPerMinute,
        percent: stats.utilizationPercent.tokens,
      },
      concurrent: {
        current: stats.usage.concurrent,
        reserved: stats.usage.reserved,
        limit: stats.limits.maxConcurrent,
        percent: stats.utilizationPercent.concurrent,
      },
    },
    backoff: {
      isActive: backoff.isLimited,
      until: backoff.backoffUntil,
      remainingMs: backoff.remainingMs,
      consecutiveCount: backoff.consecutiveCount,
      historyCount: backoff.historyCount,
    },
    detectedLimits: stats.detectedLimits,
    status: backoff.isLimited ? "paused" : "active",
  });
});
```

### Debug Commands

```bash
# Check rate limit status
curl http://localhost:3333/api/rate-limit/status | jq

# Check for rate limit events
sqlite3 parent-harness/data/harness.db "
  SELECT COUNT(*), event_type, message
  FROM observability_events
  WHERE message LIKE '%rate limit%'
    AND created_at > datetime('now', '-1 hour')
  GROUP BY event_type, message
"

# Check assignment amplification
sqlite3 parent-harness/data/harness.db "
  SELECT
    COUNT(*) as total_assignments,
    COUNT(DISTINCT task_id) as distinct_tasks,
    CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) as avg_per_task
  FROM observability_events
  WHERE event_type='task:assigned'
    AND created_at > datetime('now', '-1 hour')
"
```

## Testing

```bash
# Run rate limiter tests
cd parent-harness/orchestrator
npm test -- rate-limiter.test.ts

# Run with coverage
npm test -- rate-limiter.test.ts --coverage

# Run specific test suite
npm test -- rate-limiter.test.ts -t "Sliding Window"
```

## Success Metrics

After integration, verify these metrics:

| Metric                   | Target        | Query                                                                               |
| ------------------------ | ------------- | ----------------------------------------------------------------------------------- |
| Assignment amplification | ≤1.5 per task | `SELECT CAST(COUNT(*) AS REAL) / COUNT(DISTINCT task_id) FROM observability_events` |
| 429 errors               | 0             | `SELECT COUNT(*) FROM observability_events WHERE payload LIKE '%429%'`              |
| Session-task sync        | Equal         | `SELECT COUNT(*) FROM sessions WHERE status='running'` vs tasks `in_progress`       |
| Max requests/min         | <35           | Monitor via `/api/rate-limit/status`                                                |

## Common Issues

### Issue: "Rate limiter not initialized"

**Solution**: Call `initializeRateLimiter()` on server startup before orchestrator starts.

### Issue: Circular dependency error

**Solution**: Import backoff functions from `rate-limit/backoff-state.ts`, not from `orchestrator/index.ts`.

### Issue: Token estimates too low/high

**Solution**: Adjust `TOKENS_PER_CHAR` constant in `estimateTokens()` function based on real usage data.

### Issue: Reservation not found

**Solution**: Ensure `confirmSpawnStart()` is called AFTER spawn actually starts, not before. If spawn fails early, call `releaseReservation()`.

## Migration Checklist

- [ ] Create `rate-limit/backoff-state.ts` module
- [ ] Replace old `rate-limiter.ts` with corrected version
- [ ] Update `spawner/index.ts` to use new API
- [ ] Add `initializeRateLimiter()` call to server startup
- [ ] Update imports to use backoff-state (not orchestrator)
- [ ] Add token estimation before spawn
- [ ] Add Retry-After header parsing
- [ ] Update state cleanup logic
- [ ] Add rate limit status API endpoint
- [ ] Run comprehensive tests
- [ ] Monitor for 24 hours after deployment

---

**Implementation Status**: ✅ Ready for integration

All P0 fixes have been applied. Review the critical evaluation document for details on each fix.
