# PHASE2-TASK-04: Task State Machine with Retry Logic and Failure Recovery

**Status:** Specification
**Priority:** P1 (Phase 2 Core Infrastructure)
**Effort:** Medium
**Created:** 2026-02-08

---

## Overview

Implement comprehensive task state machine with intelligent retry logic and failure recovery mechanisms. The system provides deterministic state transitions, exponential backoff retry scheduling, failure pattern analysis, and automatic recovery workflows to ensure robust autonomous task execution across the agent orchestration platform.

**Problem:** Current retry logic is basic and scattered across multiple components. Failed tasks use simple cooldown timers without failure pattern analysis, state transitions lack comprehensive validation, and there's no systematic approach to failure recovery.

**Solution:** Unified state machine with validated transitions, intelligent retry scheduling based on failure patterns, automated recovery workflows, and comprehensive state history tracking.

---

## Current State Analysis

### Existing Infrastructure ✅

1. **Task State Machine** (`parent-harness/orchestrator/src/events/task-state-machine.ts`)
   - ✅ State validation: `isValidTransition()` enforces valid state progressions
   - ✅ Valid states: pending, in_progress, pending_verification, completed, failed, blocked
   - ✅ Transition map: Defines allowed state changes
   - ✅ Event emission: Broadcasts state changes via event bus
   - ✅ State history: Logs all transitions to `state_history` table
   - ✅ Convenience functions: `startTask()`, `submitForQA()`, `completeTask()`, `failTask()`, `retryTask()`
   - ❌ **Gap:** No retry scheduling or failure pattern analysis

2. **Retry Handler** (`agents/build/retry-handler.ts`)
   - ✅ Exponential backoff: Configurable base delay, max delay, jitter factor
   - ✅ Retry results: Tracks attempts, duration, success/failure
   - ✅ Retryable checks: Network errors, rate limits, temporary failures
   - ✅ Factory methods: `forNetworkErrors()`, `forRateLimits()`
   - ❌ **Gap:** Not integrated with task state machine

3. **Self-Improvement System** (`parent-harness/orchestrator/src/self-improvement/index.ts`)
   - ✅ Retry tracking: `task_retry_attempts` table stores attempt history
   - ✅ Failure analysis: `analyzeFailure()` generates fix approaches based on error patterns
   - ✅ Retry limits: MAX_RETRIES = 5
   - ✅ Fix guidance: Appends retry approach to task description
   - ✅ Success tracking: `recordSuccess()` marks successful retries
   - ✅ Statistics: `getRetryStats()` provides retry analytics
   - ❌ **Gap:** Basic pattern matching, no sophisticated failure classification

4. **State History Service** (`server/services/task-agent/task-state-history-service.ts`)
   - ✅ Transition logging: Records from/to status, actor, reason, metadata
   - ✅ History queries: Full history, time ranges, last transition
   - ✅ Analytics: Time in status, transition counts, avg completion time
   - ✅ Actor filtering: Query by user/agent/system
   - ❌ **Gap:** Not integrated with parent-harness orchestrator

5. **Orchestrator Retry Logic** (`parent-harness/orchestrator/src/orchestrator/index.ts`)
   - ✅ Cooldown system: Exponential backoff (60s to 10min)
   - ✅ Recent failures tracking: `recentFailures` Map
   - ✅ Periodic processing: `processFailedTasks()` every 5th tick
   - ✅ Retry count: Stored in `tasks.retry_count`
   - ❌ **Gap:** Simple time-based cooldown, no failure type awareness

6. **Database Schema** (`parent-harness/database/schema.sql`)
   - ✅ Tasks table: `retry_count` field exists
   - ✅ State history: `task_state_history` table
   - ✅ Retry attempts: `task_retry_attempts` table (self-improvement)
   - ❌ **Gap:** No structured failure metadata storage

---

## Requirements

### Functional Requirements

**FR-1: Enhanced State Machine**

- All state transitions MUST validate through state machine
- Invalid transitions rejected with clear error messages
- Transition context includes: agentId, sessionId, error, reason, metadata
- Terminal states (completed) cannot transition further
- Blocked tasks require manual unblock or automatic timeout

**FR-2: Intelligent Retry Scheduling**

- Classify failures into categories: transient, code_error, test_failure, timeout, resource_exhaustion, unknown
- Apply category-specific retry strategies:
  - **Transient** (network, rate limit): Fast retry with exponential backoff (30s → 2m → 5m)
  - **Code Error** (TypeScript, build): Medium delay (2m → 5m → 15m) - needs code fix
  - **Test Failure**: Medium delay (2m → 5m → 15m) - needs test fix
  - **Timeout**: Long delay (5m → 15m → 30m) - simplify approach
  - **Resource Exhaustion**: Very long delay (15m → 30m → 60m) - wait for resources
  - **Unknown**: Default medium delay (2m → 5m → 15m)
- Max retry attempts: 5 (configurable per category)
- Retry cooldown stored with task to persist across orchestrator restarts

**FR-3: Failure Pattern Analysis**

- Extract structured failure info from error messages:
  - Error category (transient, code_error, test_failure, etc.)
  - Error location (file:line if available)
  - Error patterns (TypeScript errors, test assertions, network failures)
  - Suggested fix approach
- Build failure knowledge base:
  - Track common error patterns → fix approaches
  - Store in `failure_patterns` table
  - Use for generating better fix guidance

**FR-4: Automatic Recovery Workflows**

- **Recovery Actions:**
  - `retry_with_guidance`: Append fix approach to task description, reset to pending
  - `retry_with_spec_refresh`: Request spec agent to clarify requirements
  - `escalate_to_human`: Block task, notify via Telegram
  - `mark_as_blocked`: Requires manual intervention
- **Recovery Strategy by Failure Type:**
  - First failure: `retry_with_guidance` (immediate, category-specific delay)
  - Second failure (same category): `retry_with_guidance` (longer delay)
  - Third failure: `retry_with_spec_refresh` if code/test error
  - Fourth failure: `escalate_to_human`
  - Fifth failure: `mark_as_blocked`

**FR-5: Retry History & Analytics**

- Store all retry attempts with:
  - Attempt number, timestamp
  - Error category, error message
  - Fix approach used
  - Delay applied, next retry time
  - Result (pending, success, failure)
- Provide analytics:
  - Retry success rate by category
  - Average retries to success
  - Most common failure patterns
  - Agent-specific retry patterns

**FR-6: Persistent State Management**

- Retry state persists across orchestrator restarts
- Next retry time stored in database
- Pending retries resumed on startup
- Cooldown timers restored from last_failed timestamp

**FR-7: Event-Driven Retry Processing**

- Listen to `task:failed` events
- Automatically schedule retry based on failure analysis
- Emit `task:retry_scheduled` event with next retry time
- Emit `task:retry_exhausted` when max retries exceeded
- Emit `task:recovery_action` when recovery workflow triggered

### Non-Functional Requirements

**NFR-1: Performance**

- Failure analysis: < 500ms
- State transition validation: < 50ms
- Retry scheduling: < 100ms
- No impact on orchestrator tick cycle (< 1s overhead)

**NFR-2: Reliability**

- State transitions are atomic (database transactions)
- Retry state survives orchestrator crashes
- No duplicate retry scheduling
- Idempotent retry operations

**NFR-3: Observability**

- Log all state transitions with context
- Expose retry metrics via WebSocket
- Dashboard shows: pending retries, next retry times, failure categories
- Trace retry history per task

---

## Technical Design

### Architecture

```
Task Execution Fails
    ↓
[task:failed event]
    ↓
[FailureAnalyzer.analyze(error)]
    ↓ (classify: transient/code_error/test_failure/timeout/unknown)
[RetryStrategy.determineAction(category, attemptCount)]
    ↓
Recovery Action:
  ├─ retry_with_guidance → Schedule retry with fix approach
  ├─ retry_with_spec_refresh → Request spec clarification
  ├─ escalate_to_human → Telegram notification + block
  └─ mark_as_blocked → Terminal failure state
    ↓
[RetryScheduler.schedule(taskId, category, delay)]
    ↓ (store: next_retry_at, retry_count, failure_category)
[task:retry_scheduled event]
    ↓
<< Wait for delay >>
    ↓
[Orchestrator tick: checkPendingRetries()]
    ↓
[RetryExecutor.execute(taskId)]
    ↓ (transition: failed → pending)
[task:pending event] → Task enters assignment queue
```

### Implementation Components

#### 1. Failure Analyzer Service

**File:** `parent-harness/orchestrator/src/retry/failure-analyzer.ts`

```typescript
export type FailureCategory =
  | "transient" // Network, rate limit, temporary service issues
  | "code_error" // TypeScript errors, syntax errors, compilation
  | "test_failure" // Test assertions, test setup failures
  | "timeout" // Operation timeout, agent timeout
  | "resource_exhaustion" // CPU, memory, disk space
  | "dependency_missing" // Missing files, broken imports
  | "unknown"; // Unclassified errors

export interface FailureAnalysis {
  category: FailureCategory;
  confidence: number; // 0-1
  errorPattern: string; // Regex pattern matched
  location?: {
    file: string;
    line?: number;
  };
  suggestedFix: string;
  isRetryable: boolean;
}

export class FailureAnalyzer {
  /**
   * Analyze error message and classify failure
   */
  analyze(
    error: string,
    context?: {
      taskId?: string;
      agentId?: string;
      sessionOutput?: string;
    },
  ): FailureAnalysis {
    const errorLower = error.toLowerCase();

    // Transient errors (high confidence)
    if (this.isTransientError(error)) {
      return {
        category: "transient",
        confidence: 0.9,
        errorPattern: this.extractPattern(error),
        suggestedFix: "Retry immediately - transient failure",
        isRetryable: true,
      };
    }

    // TypeScript / Build errors
    if (this.isCodeError(error)) {
      const location = this.extractLocation(error);
      return {
        category: "code_error",
        confidence: 0.85,
        errorPattern: this.extractPattern(error),
        location,
        suggestedFix: this.generateCodeFix(error, location),
        isRetryable: true,
      };
    }

    // Test failures
    if (this.isTestFailure(error)) {
      return {
        category: "test_failure",
        confidence: 0.8,
        errorPattern: this.extractPattern(error),
        suggestedFix: "Review test assertions and expected vs actual values",
        isRetryable: true,
      };
    }

    // Timeout
    if (errorLower.includes("timeout") || errorLower.includes("timed out")) {
      return {
        category: "timeout",
        confidence: 0.9,
        errorPattern: "timeout",
        suggestedFix: "Simplify approach or break into smaller atomic tasks",
        isRetryable: true,
      };
    }

    // Resource exhaustion
    if (this.isResourceError(error)) {
      return {
        category: "resource_exhaustion",
        confidence: 0.85,
        errorPattern: this.extractPattern(error),
        suggestedFix:
          "Wait for resources to become available or optimize resource usage",
        isRetryable: true,
      };
    }

    // Dependency issues
    if (this.isDependencyError(error)) {
      return {
        category: "dependency_missing",
        confidence: 0.8,
        errorPattern: this.extractPattern(error),
        suggestedFix: "Verify file paths and import statements are correct",
        isRetryable: true,
      };
    }

    // Unknown
    return {
      category: "unknown",
      confidence: 0.5,
      errorPattern: "unknown",
      suggestedFix: "Analyze error carefully and try a different approach",
      isRetryable: true,
    };
  }

  private isTransientError(error: string): boolean {
    const patterns = [
      /network/i,
      /timeout/i,
      /econnrefused/i,
      /econnreset/i,
      /rate limit/i,
      /too many requests/i,
      /429/i,
      /503/i,
      /socket hang up/i,
      /etimedout/i,
    ];
    return patterns.some((p) => p.test(error));
  }

  private isCodeError(error: string): boolean {
    const patterns = [
      /typescript/i,
      /ts\d{4}/i,
      /syntax error/i,
      /parse error/i,
      /compilation error/i,
      /type error/i,
      /cannot find name/i,
      /has no exported member/i,
    ];
    return patterns.some((p) => p.test(error));
  }

  private isTestFailure(error: string): boolean {
    const patterns = [
      /test.*fail/i,
      /assertion.*fail/i,
      /expect/i,
      /toEqual/i,
      /toBe/i,
      /jest/i,
      /vitest/i,
    ];
    return patterns.some((p) => p.test(error));
  }

  private isResourceError(error: string): boolean {
    const patterns = [
      /ENOMEM/i,
      /out of memory/i,
      /ENOSPC/i,
      /no space left/i,
      /cpu usage/i,
      /resource exhausted/i,
    ];
    return patterns.some((p) => p.test(error));
  }

  private isDependencyError(error: string): boolean {
    const patterns = [
      /cannot find module/i,
      /ENOENT/i,
      /not found/i,
      /missing.*import/i,
      /unresolved.*import/i,
    ];
    return patterns.some((p) => p.test(error));
  }

  private extractLocation(
    error: string,
  ): { file: string; line?: number } | undefined {
    // Match patterns like: file.ts(123,45) or file.ts:123:45
    const match = error.match(/([^\s:]+\.ts)[\(:]+(\d+)/);
    if (match) {
      return { file: match[1], line: parseInt(match[2]) };
    }
    return undefined;
  }

  private extractPattern(error: string): string {
    // Extract key error pattern (first line or error code)
    const lines = error.split("\n");
    const firstLine = lines[0].trim();

    // Look for error codes
    const codeMatch = firstLine.match(/TS\d{4}|E[A-Z]+/);
    if (codeMatch) return codeMatch[0];

    return firstLine.slice(0, 100);
  }

  private generateCodeFix(
    error: string,
    location?: { file: string; line?: number },
  ): string {
    const errorLower = error.toLowerCase();

    if (errorLower.includes("cannot find name")) {
      return "Check variable/function name spelling and imports";
    }
    if (errorLower.includes("has no exported member")) {
      return "Verify export exists in imported module";
    }
    if (errorLower.includes("type")) {
      return "Fix type annotations and ensure type compatibility";
    }

    if (location) {
      return `Fix error in ${location.file}${location.line ? `:${location.line}` : ""}`;
    }

    return "Review and fix TypeScript/compilation errors";
  }
}
```

#### 2. Retry Strategy Service

**File:** `parent-harness/orchestrator/src/retry/retry-strategy.ts`

```typescript
import type { FailureCategory, FailureAnalysis } from "./failure-analyzer.js";

export type RecoveryAction =
  | "retry_with_guidance"
  | "retry_with_spec_refresh"
  | "escalate_to_human"
  | "mark_as_blocked";

export interface RetryConfig {
  maxRetries: number;
  delays: number[]; // Delay per attempt [attempt1, attempt2, ...]
}

// Category-specific retry configurations
const RETRY_CONFIGS: Record<FailureCategory, RetryConfig> = {
  transient: {
    maxRetries: 5,
    delays: [30_000, 120_000, 300_000, 600_000, 900_000], // 30s, 2m, 5m, 10m, 15m
  },
  code_error: {
    maxRetries: 5,
    delays: [120_000, 300_000, 900_000, 1_800_000, 3_600_000], // 2m, 5m, 15m, 30m, 60m
  },
  test_failure: {
    maxRetries: 5,
    delays: [120_000, 300_000, 900_000, 1_800_000, 3_600_000], // 2m, 5m, 15m, 30m, 60m
  },
  timeout: {
    maxRetries: 3,
    delays: [300_000, 900_000, 1_800_000], // 5m, 15m, 30m
  },
  resource_exhaustion: {
    maxRetries: 3,
    delays: [900_000, 1_800_000, 3_600_000], // 15m, 30m, 60m
  },
  dependency_missing: {
    maxRetries: 3,
    delays: [120_000, 300_000, 900_000], // 2m, 5m, 15m
  },
  unknown: {
    maxRetries: 5,
    delays: [120_000, 300_000, 900_000, 1_800_000, 3_600_000], // 2m, 5m, 15m, 30m, 60m
  },
};

export interface RetryDecision {
  shouldRetry: boolean;
  action: RecoveryAction;
  delay: number; // milliseconds
  guidance: string;
  nextRetryAt?: Date;
}

export class RetryStrategy {
  /**
   * Determine retry action based on failure analysis and attempt count
   */
  determineAction(
    analysis: FailureAnalysis,
    attemptCount: number,
    taskContext?: {
      hasSpec?: boolean;
      lastAttemptError?: string;
    },
  ): RetryDecision {
    const config = RETRY_CONFIGS[analysis.category];

    // Check if max retries exceeded
    if (attemptCount >= config.maxRetries) {
      return {
        shouldRetry: false,
        action: "mark_as_blocked",
        delay: 0,
        guidance: `Max retries (${config.maxRetries}) exceeded for ${analysis.category} failures`,
      };
    }

    // Get delay for this attempt (0-indexed)
    const delay =
      config.delays[attemptCount] || config.delays[config.delays.length - 1];

    // Determine recovery action based on attempt count and failure type
    let action: RecoveryAction = "retry_with_guidance";
    let guidance = analysis.suggestedFix;

    if (attemptCount === 0) {
      // First retry: just try again with guidance
      action = "retry_with_guidance";
    } else if (attemptCount === 1) {
      // Second retry: still try with guidance but longer delay
      action = "retry_with_guidance";
      guidance = `Second retry attempt. ${analysis.suggestedFix}`;
    } else if (attemptCount === 2) {
      // Third retry: Consider spec refresh for code/test errors
      if (
        (analysis.category === "code_error" ||
          analysis.category === "test_failure") &&
        taskContext?.hasSpec
      ) {
        action = "retry_with_spec_refresh";
        guidance =
          "Multiple failures suggest unclear requirements. Requesting spec clarification.";
      } else {
        action = "retry_with_guidance";
        guidance = `Third retry attempt. ${analysis.suggestedFix} Try a completely different approach.`;
      }
    } else if (attemptCount === 3) {
      // Fourth retry: Escalate to human
      action = "escalate_to_human";
      guidance = `Task has failed ${attemptCount + 1} times. Human review required.`;
    } else {
      // Fifth+ retry: Mark as blocked (shouldn't reach here due to max check)
      action = "mark_as_blocked";
      guidance = `Task repeatedly failing. Marked as blocked for manual intervention.`;
    }

    const nextRetryAt = new Date(Date.now() + delay);

    return {
      shouldRetry: true,
      action,
      delay,
      guidance,
      nextRetryAt,
    };
  }

  /**
   * Get retry config for failure category
   */
  getConfig(category: FailureCategory): RetryConfig {
    return RETRY_CONFIGS[category];
  }
}
```

#### 3. Retry Scheduler Service

**File:** `parent-harness/orchestrator/src/retry/retry-scheduler.ts`

```typescript
import * as tasks from "../db/tasks.js";
import { run, getOne, query } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";
import type { FailureCategory } from "./failure-analyzer.js";
import type { RecoveryAction } from "./retry-strategy.js";

export interface ScheduledRetry {
  id: string;
  task_id: string;
  attempt_number: number;
  failure_category: FailureCategory;
  recovery_action: RecoveryAction;
  scheduled_at: string;
  next_retry_at: string;
  delay_ms: number;
  error_message: string;
  guidance: string;
  status: "pending" | "executed" | "cancelled";
  executed_at?: string;
  created_at: string;
}

/**
 * Ensure scheduled_retries table exists
 */
function ensureRetryScheduleTable(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS scheduled_retries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      failure_category TEXT NOT NULL,
      recovery_action TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      next_retry_at TEXT NOT NULL,
      delay_ms INTEGER NOT NULL,
      error_message TEXT,
      guidance TEXT,
      status TEXT DEFAULT 'pending',
      executed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    )
  `,
    [],
  );

  // Index for efficient pending retry queries
  run(
    `
    CREATE INDEX IF NOT EXISTS idx_scheduled_retries_pending
    ON scheduled_retries(status, next_retry_at)
    WHERE status = 'pending'
  `,
    [],
  );
}

ensureRetryScheduleTable();

export class RetryScheduler {
  /**
   * Schedule a retry for a failed task
   */
  schedule(
    taskId: string,
    category: FailureCategory,
    action: RecoveryAction,
    delay: number,
    error: string,
    guidance: string,
  ): ScheduledRetry {
    const task = tasks.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const id = uuidv4();
    const now = new Date();
    const nextRetryAt = new Date(now.getTime() + delay);
    const attemptNumber = (task.retry_count || 0) + 1;

    run(
      `
      INSERT INTO scheduled_retries (
        id, task_id, attempt_number, failure_category, recovery_action,
        scheduled_at, next_retry_at, delay_ms, error_message, guidance, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `,
      [
        id,
        taskId,
        attemptNumber,
        category,
        action,
        now.toISOString(),
        nextRetryAt.toISOString(),
        delay,
        error,
        guidance,
      ],
    );

    // Update task retry metadata
    tasks.updateTask(taskId, {
      retry_count: attemptNumber,
    });

    const scheduled = this.getScheduledRetry(id);
    if (!scheduled) {
      throw new Error("Failed to schedule retry");
    }

    console.log(
      `🔄 Scheduled retry #${attemptNumber} for ${task.display_id} in ${delay / 1000}s (${category})`,
    );

    return scheduled;
  }

  /**
   * Get scheduled retry by ID
   */
  getScheduledRetry(id: string): ScheduledRetry | undefined {
    return getOne<ScheduledRetry>(
      "SELECT * FROM scheduled_retries WHERE id = ?",
      [id],
    );
  }

  /**
   * Get pending retries that are due
   */
  getDueRetries(): ScheduledRetry[] {
    const now = new Date().toISOString();
    return query<ScheduledRetry>(
      `
      SELECT * FROM scheduled_retries
      WHERE status = 'pending' AND next_retry_at <= ?
      ORDER BY next_retry_at ASC
    `,
      [now],
    );
  }

  /**
   * Get all pending retries (for dashboard)
   */
  getAllPendingRetries(): ScheduledRetry[] {
    return query<ScheduledRetry>(`
      SELECT * FROM scheduled_retries
      WHERE status = 'pending'
      ORDER BY next_retry_at ASC
    `);
  }

  /**
   * Mark retry as executed
   */
  markExecuted(retryId: string): void {
    run(
      `
      UPDATE scheduled_retries
      SET status = 'executed', executed_at = datetime('now')
      WHERE id = ?
    `,
      [retryId],
    );
  }

  /**
   * Cancel pending retries for a task
   */
  cancelRetries(taskId: string): number {
    const result = run(
      `
      UPDATE scheduled_retries
      SET status = 'cancelled'
      WHERE task_id = ? AND status = 'pending'
    `,
      [taskId],
    );

    return result?.changes || 0;
  }

  /**
   * Get retry history for a task
   */
  getRetryHistory(taskId: string): ScheduledRetry[] {
    return query<ScheduledRetry>(
      `
      SELECT * FROM scheduled_retries
      WHERE task_id = ?
      ORDER BY attempt_number ASC
    `,
      [taskId],
    );
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): {
    pendingRetries: number;
    executedRetries: number;
    cancelledRetries: number;
    avgDelayMs: number;
    byCategoryCount: Record<FailureCategory, number>;
  } {
    const stats = getOne<{
      pending: number;
      executed: number;
      cancelled: number;
      avgDelay: number;
    }>(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'executed' THEN 1 ELSE 0 END) as executed,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
        AVG(delay_ms) as avgDelay
      FROM scheduled_retries
    `);

    const byCategory = query<{ category: FailureCategory; count: number }>(`
      SELECT failure_category as category, COUNT(*) as count
      FROM scheduled_retries
      GROUP BY failure_category
    `);

    const byCategoryCount = byCategory.reduce(
      (acc, row) => {
        acc[row.category] = row.count;
        return acc;
      },
      {} as Record<FailureCategory, number>,
    );

    return {
      pendingRetries: stats?.pending || 0,
      executedRetries: stats?.executed || 0,
      cancelledRetries: stats?.cancelled || 0,
      avgDelayMs: stats?.avgDelay || 0,
      byCategoryCount,
    };
  }
}

export const retryScheduler = new RetryScheduler();
export default retryScheduler;
```

#### 4. Integrated Retry System

**File:** `parent-harness/orchestrator/src/retry/index.ts`

```typescript
import { FailureAnalyzer } from "./failure-analyzer.js";
import { RetryStrategy } from "./retry-strategy.js";
import { RetryScheduler } from "./retry-scheduler.js";
import { bus } from "../events/bus.js";
import * as tasks from "../db/tasks.js";
import { transitionTask } from "../events/task-state-machine.js";
import { ws } from "../websocket.js";

const analyzer = new FailureAnalyzer();
const strategy = new RetryStrategy();
const scheduler = new RetryScheduler();

/**
 * Handle task failure - analyze and schedule retry
 */
export async function handleTaskFailure(
  taskId: string,
  error: string,
  context?: {
    agentId?: string;
    sessionId?: string;
    sessionOutput?: string;
  },
): Promise<void> {
  const task = tasks.getTask(taskId);
  if (!task) {
    console.error(`Cannot handle failure - task ${taskId} not found`);
    return;
  }

  console.log(`🔍 Analyzing failure for ${task.display_id}...`);

  // 1. Analyze failure
  const analysis = analyzer.analyze(error, {
    taskId,
    agentId: context?.agentId,
    sessionOutput: context?.sessionOutput,
  });

  console.log(
    `   Category: ${analysis.category} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`,
  );
  console.log(`   Pattern: ${analysis.errorPattern}`);
  if (analysis.location) {
    console.log(
      `   Location: ${analysis.location.file}${analysis.location.line ? `:${analysis.location.line}` : ""}`,
    );
  }

  // 2. Determine retry action
  const decision = strategy.determineAction(analysis, task.retry_count || 0, {
    hasSpec: !!task.spec_content,
    lastAttemptError: error,
  });

  console.log(
    `   Decision: ${decision.action} (delay: ${decision.delay / 1000}s)`,
  );
  console.log(`   Guidance: ${decision.guidance}`);

  // 3. Execute recovery action
  if (!decision.shouldRetry) {
    // Max retries exceeded - block task
    console.log(`❌ Max retries exceeded - blocking ${task.display_id}`);
    transitionTask(taskId, "blocked", {
      reason: decision.guidance,
      error,
    });

    bus.emit("task:retry_exhausted", { task, analysis, decision });
    ws.broadcast("task:retry_exhausted", { taskId, reason: decision.guidance });
    return;
  }

  // 4. Schedule retry based on action
  switch (decision.action) {
    case "retry_with_guidance": {
      // Schedule retry with fix guidance
      const scheduled = scheduler.schedule(
        taskId,
        analysis.category,
        decision.action,
        decision.delay,
        error,
        decision.guidance,
      );

      // Update task description with guidance
      const updatedDescription = task.description
        ? `${task.description}\n\n---\n**Retry Guidance (Attempt #${scheduled.attempt_number}):**\n${decision.guidance}`
        : `**Retry Guidance (Attempt #${scheduled.attempt_number}):**\n${decision.guidance}`;

      tasks.updateTask(taskId, { description: updatedDescription });

      bus.emit("task:retry_scheduled", { task, scheduled, analysis, decision });
      ws.broadcast("task:retry_scheduled", {
        taskId,
        attemptNumber: scheduled.attempt_number,
        nextRetryAt: scheduled.next_retry_at,
        category: analysis.category,
      });
      break;
    }

    case "retry_with_spec_refresh": {
      // Request spec agent to clarify requirements
      console.log(`📋 Requesting spec refresh for ${task.display_id}`);

      // Create spec review task
      const specTask = tasks.createTask({
        display_id: `${task.display_id}-SPEC-REVIEW`,
        title: `Review specification for ${task.display_id}`,
        description: `The task "${task.title}" has failed ${task.retry_count} times with ${analysis.category} errors.\n\nPlease review and clarify the specification.\n\n**Recent error:**\n${error}\n\n**Suggested fix:**\n${decision.guidance}`,
        category: "specification",
        priority: task.priority,
        task_list_id: task.task_list_id,
      });

      // Block original task pending spec review
      transitionTask(taskId, "blocked", {
        reason: "Awaiting spec clarification",
        error,
      });

      bus.emit("task:spec_refresh_requested", { task, specTask, analysis });
      ws.broadcast("task:spec_refresh_requested", {
        taskId,
        specTaskId: specTask.id,
      });
      break;
    }

    case "escalate_to_human": {
      // Block task and send Telegram notification
      console.log(`🚨 Escalating ${task.display_id} to human`);

      transitionTask(taskId, "blocked", {
        reason: "Escalated to human after multiple failures",
        error,
      });

      // TODO: Send Telegram notification

      bus.emit("task:escalated", { task, analysis, decision });
      ws.broadcast("task:escalated", { taskId, reason: decision.guidance });
      break;
    }

    case "mark_as_blocked": {
      // Terminal failure - block permanently
      console.log(
        `🛑 Marking ${task.display_id} as blocked (terminal failure)`,
      );

      transitionTask(taskId, "blocked", {
        reason: decision.guidance,
        error,
      });

      bus.emit("task:permanently_blocked", { task, analysis });
      ws.broadcast("task:permanently_blocked", {
        taskId,
        reason: decision.guidance,
      });
      break;
    }
  }
}

/**
 * Process due retries (called by orchestrator tick)
 */
export async function processDueRetries(): Promise<number> {
  const dueRetries = scheduler.getDueRetries();

  if (dueRetries.length === 0) {
    return 0;
  }

  console.log(`🔄 Processing ${dueRetries.length} due retries...`);

  let processedCount = 0;

  for (const retry of dueRetries) {
    try {
      const task = tasks.getTask(retry.task_id);
      if (!task) {
        console.warn(`Task ${retry.task_id} not found - cancelling retry`);
        scheduler.markExecuted(retry.id);
        continue;
      }

      // Check if task still in failed state
      if (task.status !== "failed") {
        console.log(
          `Task ${task.display_id} no longer failed (${task.status}) - skipping retry`,
        );
        scheduler.markExecuted(retry.id);
        continue;
      }

      // Transition task back to pending
      const result = transitionTask(retry.task_id, "pending", {
        reason: `Retry attempt #${retry.attempt_number} (${retry.failure_category})`,
      });

      if (result.success) {
        scheduler.markExecuted(retry.id);
        processedCount++;

        console.log(
          `✅ Retried ${task.display_id} (attempt #${retry.attempt_number})`,
        );

        bus.emit("task:retry_executed", { task, retry });
        ws.taskUpdated(tasks.getTask(retry.task_id));
      } else {
        console.error(`Failed to retry ${task.display_id}: ${result.error}`);
      }
    } catch (err) {
      console.error(`Error processing retry ${retry.id}:`, err);
    }
  }

  return processedCount;
}

/**
 * Initialize retry system (restore pending retries on startup)
 */
export function initializeRetrySystem(): void {
  const pending = scheduler.getAllPendingRetries();
  console.log(
    `🔄 Retry system initialized - ${pending.length} pending retries`,
  );

  // Log next few retries
  const upcoming = pending.slice(0, 5);
  for (const retry of upcoming) {
    const task = tasks.getTask(retry.task_id);
    const timeUntil = new Date(retry.next_retry_at).getTime() - Date.now();
    console.log(
      `   - ${task?.display_id || retry.task_id}: ${retry.failure_category} in ${Math.round(timeUntil / 1000)}s`,
    );
  }
}

export { analyzer, strategy, scheduler };
export default {
  handleTaskFailure,
  processDueRetries,
  initializeRetrySystem,
  analyzer,
  strategy,
  scheduler,
};
```

#### 5. Integration with Orchestrator

**File:** `parent-harness/orchestrator/src/orchestrator/index.ts` (modifications)

```typescript
import {
  handleTaskFailure,
  processDueRetries,
  initializeRetrySystem,
} from "../retry/index.js";

// In startOrchestrator():
export async function startOrchestrator(): Promise<void> {
  console.log("🚀 Starting Vibe Parent Harness Orchestrator...");

  // ... existing initialization ...

  // Initialize retry system
  initializeRetrySystem();

  // ... rest of startup ...
}

// In tick() function:
async function tick(): Promise<void> {
  tickCount++;

  // ... existing tick logic ...

  // Process due retries (every tick)
  if (tickCount % 1 === 0) {
    await crashProtect(
      async () => processDueRetries(),
      "processDueRetries",
    ).then((count) => {
      if (count > 0) {
        console.log(`🔄 Processed ${count} due retries`);
      }
    });
  }

  // ... rest of tick ...
}

// Modify failTask() to use new retry system:
export function failTask(taskId: string, agentId: string, error: string): void {
  const task = tasks.getTask(taskId);
  const agent = agents.getAgent(agentId);

  if (!task || !agent) return;

  // Track failure
  recentFailures.set(taskId, Date.now());

  // Update task
  tasks.failTask(taskId);

  // Update agent
  agents.updateAgentStatus(agentId, "idle", null, null);
  agents.incrementTasksFailed(agentId);

  // Update session
  if (agent.current_session_id) {
    sessions.updateSessionStatus(
      agent.current_session_id,
      "failed",
      undefined,
      error,
    );
  }

  // Log event
  events.taskFailed(taskId, agentId, task.title, error);

  // Broadcast
  ws.taskFailed(tasks.getTask(taskId), error);
  ws.agentStatusChanged(agents.getAgent(agentId));

  // Handle with new retry system (async, non-blocking)
  handleTaskFailure(taskId, error, {
    agentId,
    sessionId: agent.current_session_id || undefined,
  }).catch((err) => {
    console.error(`Retry handling failed for ${task.display_id}:`, err);
  });
}
```

---

## Database Schema Changes

### New Table: scheduled_retries

```sql
CREATE TABLE IF NOT EXISTS scheduled_retries (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  failure_category TEXT NOT NULL,  -- transient, code_error, test_failure, timeout, etc.
  recovery_action TEXT NOT NULL,    -- retry_with_guidance, retry_with_spec_refresh, escalate_to_human, mark_as_blocked
  scheduled_at TEXT NOT NULL,       -- When retry was scheduled
  next_retry_at TEXT NOT NULL,      -- When retry should execute
  delay_ms INTEGER NOT NULL,        -- Delay in milliseconds
  error_message TEXT,               -- Original error
  guidance TEXT,                    -- Fix guidance for agent
  status TEXT DEFAULT 'pending',    -- pending, executed, cancelled
  executed_at TEXT,                 -- When retry was executed
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_retries_pending
ON scheduled_retries(status, next_retry_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_retries_task
ON scheduled_retries(task_id);
```

### Optional: failure_patterns table (for learning)

```sql
CREATE TABLE IF NOT EXISTS failure_patterns (
  id TEXT PRIMARY KEY,
  error_pattern TEXT NOT NULL,      -- Regex or substring pattern
  failure_category TEXT NOT NULL,
  confidence REAL NOT NULL,         -- 0-1
  suggested_fix TEXT,
  success_rate REAL,                -- Track effectiveness
  occurrence_count INTEGER DEFAULT 1,
  last_seen_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failure_patterns_category
ON failure_patterns(failure_category);
```

---

## Pass Criteria

### Essential (Must Pass)

1. **State Machine Integration**
   - ✅ All task state transitions validate through state machine
   - ✅ Invalid transitions rejected with clear errors
   - ✅ Transition context includes failure metadata
   - ✅ State history persists all transitions

2. **Failure Analysis**
   - ✅ Errors classified into categories (transient, code_error, test_failure, timeout, resource_exhaustion, dependency_missing, unknown)
   - ✅ Confidence scores ≥ 0.8 for well-known patterns
   - ✅ Error location extraction works for TypeScript errors
   - ✅ Suggested fixes generated for each category

3. **Retry Scheduling**
   - ✅ Category-specific retry delays applied correctly
   - ✅ Exponential backoff: delays increase with attempt count
   - ✅ Retries scheduled in `scheduled_retries` table
   - ✅ `next_retry_at` timestamp accurate

4. **Recovery Actions**
   - ✅ `retry_with_guidance`: Task description updated with fix approach
   - ✅ `retry_with_spec_refresh`: Spec review task created, original task blocked
   - ✅ `escalate_to_human`: Task blocked, event emitted
   - ✅ `mark_as_blocked`: Task permanently blocked after max retries

5. **Orchestrator Integration**
   - ✅ `processDueRetries()` called every tick
   - ✅ Due retries transition failed → pending
   - ✅ Executed retries marked in database
   - ✅ `initializeRetrySystem()` restores pending retries on startup

6. **Event System**
   - ✅ `task:retry_scheduled` event emitted with retry details
   - ✅ `task:retry_executed` event emitted when retry runs
   - ✅ `task:retry_exhausted` event emitted at max retries
   - ✅ `task:escalated` event emitted on human escalation

7. **WebSocket Broadcasting**
   - ✅ Dashboard receives retry events in real-time
   - ✅ `task:retry_scheduled` includes nextRetryAt, category, attempt number
   - ✅ `task:retry_exhausted` includes blocking reason

8. **Persistence**
   - ✅ Retry state survives orchestrator restart
   - ✅ Pending retries resume correctly after restart
   - ✅ No duplicate retry scheduling for same failure

9. **Type Safety & Build**
   - ✅ TypeScript compilation passes (`npm run build`)
   - ✅ All tests pass (`npm test`)
   - ✅ No new linting errors

### Nice-to-Have (Optional)

- [ ] Failure pattern learning (update `failure_patterns` table)
- [ ] Dashboard UI showing pending retries timeline
- [ ] Retry analytics: success rate by category, agent, task type
- [ ] Adaptive retry delays based on historical success rates
- [ ] Telegram notifications for escalated tasks

---

## Dependencies

### Code Dependencies

1. **Task State Machine** (`parent-harness/orchestrator/src/events/task-state-machine.ts`)
   - Status: ✅ Exists
   - Action: Import and extend

2. **Retry Handler** (`agents/build/retry-handler.ts`)
   - Status: ✅ Exists
   - Action: Use as reference for exponential backoff patterns

3. **Self-Improvement System** (`parent-harness/orchestrator/src/self-improvement/index.ts`)
   - Status: ✅ Exists
   - Action: Deprecate in favor of new retry system (migration path)

4. **Event Bus** (`parent-harness/orchestrator/src/events/bus.js`)
   - Status: ✅ Exists
   - Action: Use for emitting retry events

5. **WebSocket** (`parent-harness/orchestrator/src/websocket.js`)
   - Status: ✅ Exists
   - Action: Broadcast retry events to dashboard

### Database Dependencies

- `tasks` table - ✅ Already exists
- `task_state_history` table - ✅ Already exists
- `scheduled_retries` table - ❌ **Create in migration**

### Task Dependencies

- **PHASE2-TASK-03:** QA Agent validation (provides failed task events)
- **PHASE2-TASK-02:** Build Agent implementation (generates task failures)

---

## Testing Strategy

### Unit Tests

**File:** `tests/parent-harness/retry-system.test.ts`

```typescript
describe("Retry System", () => {
  describe("FailureAnalyzer", () => {
    it("classifies transient errors correctly", () => {
      const analyzer = new FailureAnalyzer();
      const analysis = analyzer.analyze("Network timeout: ETIMEDOUT");
      expect(analysis.category).toBe("transient");
      expect(analysis.confidence).toBeGreaterThan(0.8);
    });

    it("classifies TypeScript errors with location", () => {
      const error = 'file.ts(45,12): error TS2304: Cannot find name "foo"';
      const analysis = analyzer.analyze(error);
      expect(analysis.category).toBe("code_error");
      expect(analysis.location?.file).toBe("file.ts");
      expect(analysis.location?.line).toBe(45);
    });

    it("classifies test failures", () => {
      const error = "Test failed: expect(received).toEqual(expected)";
      const analysis = analyzer.analyze(error);
      expect(analysis.category).toBe("test_failure");
    });
  });

  describe("RetryStrategy", () => {
    it("applies category-specific delays", () => {
      const strategy = new RetryStrategy();
      const decision = strategy.determineAction(
        {
          category: "transient",
          confidence: 0.9,
          errorPattern: "timeout",
          suggestedFix: "retry",
          isRetryable: true,
        },
        0,
      );
      expect(decision.delay).toBe(30_000); // 30s for first transient retry
    });

    it("escalates to human after 3 failures", () => {
      const strategy = new RetryStrategy();
      const decision = strategy.determineAction(
        {
          category: "code_error",
          confidence: 0.85,
          errorPattern: "TS2304",
          suggestedFix: "fix import",
          isRetryable: true,
        },
        3,
      );
      expect(decision.action).toBe("escalate_to_human");
    });

    it("blocks task after max retries", () => {
      const strategy = new RetryStrategy();
      const decision = strategy.determineAction(
        {
          category: "unknown",
          confidence: 0.5,
          errorPattern: "unknown",
          suggestedFix: "retry",
          isRetryable: true,
        },
        5,
      );
      expect(decision.shouldRetry).toBe(false);
      expect(decision.action).toBe("mark_as_blocked");
    });
  });

  describe("RetryScheduler", () => {
    it("schedules retry with correct delay", () => {
      const scheduler = new RetryScheduler();
      const task = createMockTask({ id: "test-1", retry_count: 0 });

      const scheduled = scheduler.schedule(
        task.id,
        "code_error",
        "retry_with_guidance",
        120_000,
        "TS2304",
        "Fix import",
      );

      expect(scheduled.delay_ms).toBe(120_000);
      expect(scheduled.status).toBe("pending");
      expect(scheduled.attempt_number).toBe(1);
    });

    it("retrieves due retries", () => {
      // Schedule retry in past
      // Query getDueRetries()
      // Expect retry to be returned
    });
  });
});
```

### Integration Tests

**File:** `tests/integration/retry-workflow.test.ts`

```typescript
describe("Retry Workflow", () => {
  it("E2E: task fails → analysis → schedule → execute retry", async () => {
    // 1. Create task
    const task = createTask({
      display_id: "TEST-RETRY-001",
      title: "Test retry flow",
    });

    // 2. Simulate failure
    await handleTaskFailure(task.id, "Network timeout: ETIMEDOUT");

    // 3. Verify retry scheduled
    const pending = retryScheduler.getAllPendingRetries();
    expect(pending.length).toBe(1);
    expect(pending[0].failure_category).toBe("transient");

    // 4. Advance time to retry
    jest.advanceTimersByTime(30_000);

    // 5. Process due retries
    const processed = await processDueRetries();
    expect(processed).toBe(1);

    // 6. Verify task back to pending
    const updated = getTask(task.id);
    expect(updated.status).toBe("pending");
  });

  it("Spec refresh triggered after multiple code errors", async () => {
    // Fail task 3 times with code errors
    // Verify spec review task created
  });

  it("Task blocked after max retries", async () => {
    // Fail task 5 times
    // Verify task status = 'blocked'
    // Verify retry_exhausted event emitted
  });
});
```

### Manual Testing Checklist

- [ ] Transient error → retry in 30s → success
- [ ] Code error → retry with guidance → success after fix
- [ ] Test failure → retry → QA validates fix
- [ ] Multiple failures → spec refresh requested
- [ ] 5 failures → task blocked permanently
- [ ] Orchestrator restart → pending retries resume
- [ ] Dashboard shows pending retries with countdown

---

## Risks & Mitigations

### Risk 1: Incorrect Failure Classification

**Impact:** High (wrong retry delays, ineffective recovery)
**Mitigation:**

- Conservative confidence scores (require > 0.8 for specific categories)
- Default to 'unknown' category with medium delays
- Log classification decisions for monitoring
- Allow manual reclassification via admin API

### Risk 2: Retry Storms

**Impact:** High (overwhelm agents, waste resources)
**Mitigation:**

- Max 5 retries per task (hard limit)
- Exponential backoff ensures delays increase
- Pending retry count monitoring
- Circuit breaker: pause retries if > 50 pending

### Risk 3: State Transition Deadlocks

**Impact:** Medium (tasks stuck in failed state)
**Mitigation:**

- Validate transitions through state machine
- Use database transactions for atomic updates
- Timeout blocked tasks after 24 hours
- Manual recovery API for stuck tasks

### Risk 4: Database Growth (scheduled_retries table)

**Impact:** Low (disk space over time)
**Mitigation:**

- Auto-archive executed retries > 30 days old
- Periodic cleanup job
- Index optimization for pending queries

---

## Implementation Plan

### Phase 1: Core Infrastructure (3-4 hours)

1. Create `failure-analyzer.ts` with error classification
2. Create `retry-strategy.ts` with category-specific configs
3. Create `retry-scheduler.ts` with database layer
4. Add `scheduled_retries` table migration

### Phase 2: Integration (2-3 hours)

5. Create `retry/index.ts` unified interface
6. Integrate `handleTaskFailure()` into `orchestrator/index.ts`
7. Add `processDueRetries()` to orchestrator tick
8. Add `initializeRetrySystem()` to startup

### Phase 3: Event System (1-2 hours)

9. Emit retry events via event bus
10. Add WebSocket broadcasting for dashboard
11. Test event flow end-to-end

### Phase 4: Testing (3-4 hours)

12. Write unit tests for analyzer, strategy, scheduler
13. Write integration tests for full workflow
14. Manual testing with real failures
15. Performance testing (orchestrator overhead)

### Phase 5: Documentation & Polish (1 hour)

16. Update STRATEGIC_PLAN.md progress
17. Add retry flow diagrams to docs
18. Document recovery action behaviors

**Total Estimated Effort:** 10-14 hours

---

## Future Enhancements

1. **Adaptive Retry Delays**
   - Learn optimal delays from historical success rates
   - Adjust delays based on system load

2. **Failure Pattern Learning**
   - Build knowledge base of error → fix mappings
   - Improve suggested fixes over time
   - Share patterns across tasks

3. **Multi-Agent Recovery**
   - Try different agent types for persistent failures
   - Planning Agent → Build Agent fallback

4. **Predictive Failure Detection**
   - Analyze task specs to predict failure risk
   - Proactive clarification for high-risk tasks

5. **Recovery Workflows**
   - Git bisect for regression failures
   - Automatic rollback of recent changes
   - Dependency update suggestions

---

## References

- **STRATEGIC_PLAN.md** - Phase 2: Build Agent Autonomous Task Execution
- **Existing Code:**
  - `parent-harness/orchestrator/src/events/task-state-machine.ts`
  - `agents/build/retry-handler.ts`
  - `parent-harness/orchestrator/src/self-improvement/index.ts`
  - `parent-harness/orchestrator/src/orchestrator/index.ts`
- **Database Schema:** `parent-harness/database/schema.sql`
- **Related Tasks:** PHASE2-TASK-02 (Build Agent), PHASE2-TASK-03 (QA Agent)

---

## Approval

**Spec Author:** Spec Agent
**Reviewed By:** (Pending)
**Approved By:** (Pending)
**Date:** 2026-02-08

---

**Status:** Ready for implementation
