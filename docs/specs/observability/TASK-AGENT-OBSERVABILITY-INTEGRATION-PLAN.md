# Task Agent Observability Integration Plan

> **Location:** `docs/specs/observability/TASK-AGENT-OBSERVABILITY-INTEGRATION-PLAN.md`
> **Created:** 2026-01-16
> **Status:** Ready for Execution
> **Priority:** P0 (Critical)
> **Scope:** Task Agent TypeScript services → Observability System integration
> **Prerequisite:** Observability schema migrations applied (087-088)

---

## Executive Summary

This plan focuses **exclusively** on integrating the Task Agent TypeScript services with the Observability data model. It does NOT cover:

- Database schema creation (see IMPLEMENTATION-PLAN-PHASES-1-2.md)
- Python producer classes (see BUILD-AGENT-OBSERVABILITY-TASK-LIST.md)
- Build Agent Worker Python integration

### Scope: Task Agent Services → Observability

| Service                       | Current Logging   | Target Observability                       |
| ----------------------------- | ----------------- | ------------------------------------------ |
| `build-agent-orchestrator.ts` | console.log (11)  | UnifiedEventEmitter (wave/agent lifecycle) |
| `suggestion-engine.ts`        | console.log (25+) | UnifiedEventEmitter (suggestion events)    |
| `error-handling.ts`           | console.log (2)   | UnifiedEventEmitter (error/escalation)     |
| `parallelism-calculator.ts`   | console.log (0)   | UnifiedEventEmitter (wave calculation)     |
| `evaluation-queue-manager.ts` | console.log (0)   | UnifiedEventEmitter (queue events)         |
| `task-creation-service.ts`    | console.error (1) | UnifiedEventEmitter (task lifecycle)       |
| `telegram-commands/index.ts`  | console.error (6) | UnifiedEventEmitter (telegram source)      |
| `task-list-orchestrator.ts`   | console.log (1)   | UnifiedEventEmitter (list lifecycle)       |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       TASK AGENT OBSERVABILITY FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐    ┌──────────────────────┐                       │
│  │  BuildAgent          │    │  SuggestionEngine    │                       │
│  │  Orchestrator        │    │                      │                       │
│  └──────────┬───────────┘    └──────────┬───────────┘                       │
│             │                           │                                    │
│             │      ┌────────────────────┘                                    │
│             │      │                                                         │
│             ▼      ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    UnifiedEventEmitter                           │        │
│  │  ─────────────────────────────────────────────────────────────  │        │
│  │  • Source-aware (agent, telegram, script, webhook, user, etc.)  │        │
│  │  • Sequence tracking per execution                              │        │
│  │  • Correlation ID linking                                       │        │
│  │  • Automatic timestamp and context injection                    │        │
│  └──────────┬──────────────────────────────────────────────────────┘        │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │                    transcript_entries                            │        │
│  │  ─────────────────────────────────────────────────────────────  │        │
│  │  • Event-agnostic: any source can emit                          │        │
│  │  • Context columns: execution_id, chat_id, script_name, etc.    │        │
│  │  • Queryable via ObservabilitySkills                            │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: TypeScript Infrastructure (P0)

### Task OBS-TS-001: Create UnifiedEventEmitter

```yaml
id: OBS-TS-001
action: CREATE
file: "server/services/observability/unified-event-emitter.ts"
status: pending
estimated_time: "45 min"

requirements:
  - Create directory server/services/observability/
  - Implement UnifiedEventEmitter class
  - Support all event sources: agent, telegram, script, webhook, user, system, ideation, custom
  - Maintain sequence numbers per execution (for agent events)
  - Insert into transcript_entries table with all context fields
  - Export singleton instance for convenience
  - Use better-sqlite3 synchronous API

validation:
  command: |
    npx tsc --noEmit server/services/observability/unified-event-emitter.ts
  expected: "exit code 0"

pass_criteria:
  - [ ] Directory created: server/services/observability/
  - [ ] File compiles without TypeScript errors
  - [ ] EventSource type exported
  - [ ] AgentContext interface exported
  - [ ] TelegramContext interface exported
  - [ ] EventData interface exported
  - [ ] emit() method implemented
  - [ ] Singleton exported as eventEmitter
```

**Implementation:**

```typescript
// server/services/observability/unified-event-emitter.ts

import { v4 as uuid } from "uuid";
import { run, saveDb } from "../../../database/db.js";

/**
 * Event source type - identifies WHERE the event originated.
 */
export type EventSource =
  | "agent"
  | "telegram"
  | "script"
  | "webhook"
  | "user"
  | "system"
  | "ideation"
  | "custom";

/**
 * Context for agent events (Build Agent, Spec Agent, etc.)
 */
export interface AgentContext {
  source: "agent";
  executionId: string;
  instanceId: string;
  taskId?: string;
  waveId?: string;
  waveNumber?: number;
  correlationId?: string;
}

/**
 * Context for Telegram events.
 */
export interface TelegramContext {
  source: "telegram";
  chatId: string;
  telegramUserId?: string;
  messageId?: string;
  sessionId?: string;
  correlationId?: string;
}

/**
 * Context for script events (CLI, cron jobs).
 */
export interface ScriptContext {
  source: "script";
  scriptName: string;
  scriptArgs?: string[];
  executionId?: string;
  correlationId?: string;
}

/**
 * Context for user interaction events.
 */
export interface UserContext {
  source: "user";
  userId: string;
  sessionId?: string;
  pageUrl?: string;
  correlationId?: string;
}

/**
 * Context for webhook events.
 */
export interface WebhookContext {
  source: "webhook";
  webhookUrl?: string;
  webhookMethod?: string;
  correlationId?: string;
}

/**
 * Context for ideation session events.
 */
export interface IdeationContext {
  source: "ideation";
  sessionId: string;
  userId?: string;
  correlationId?: string;
}

/**
 * Context for system events (server lifecycle, health checks).
 */
export interface SystemContext {
  source: "system";
  correlationId?: string;
}

/**
 * Context for custom/extensible events.
 */
export interface CustomContext {
  source: "custom";
  correlationId?: string;
}

/**
 * Union type for all context types.
 */
export type EventContext =
  | AgentContext
  | TelegramContext
  | ScriptContext
  | UserContext
  | WebhookContext
  | IdeationContext
  | SystemContext
  | CustomContext;

/**
 * Event data payload.
 */
export interface EventData {
  entryType: string;
  category: string;
  summary: string;
  details?: Record<string, unknown>;
  durationMs?: number;
}

/**
 * Entry types for transcript_entries.
 */
export type TranscriptEntryType =
  // Lifecycle events
  | "phase_start"
  | "phase_end"
  | "task_start"
  | "task_end"
  | "wave_start"
  | "wave_complete"
  | "execution_start"
  | "execution_complete"
  // Action events
  | "tool_use"
  | "skill_invoke"
  | "skill_complete"
  | "agent_spawn"
  | "agent_complete"
  | "agent_error"
  // Validation events
  | "validation"
  | "assertion"
  // Knowledge events
  | "discovery"
  | "suggestion_created"
  | "suggestion_sent"
  // Coordination events
  | "checkpoint"
  | "lock_acquire"
  | "lock_release"
  // Communication events (Telegram)
  | "message_received"
  | "message_sent"
  | "command_invoked"
  | "notification_sent"
  // Script events
  | "script_started"
  | "script_completed"
  | "script_failed"
  // User interaction events
  | "button_clicked"
  | "form_submitted"
  | "page_viewed"
  // Error events
  | "error"
  | "escalation"
  // System events
  | "server_started"
  | "server_stopped"
  | "health_check"
  | "config_changed"
  // Queue events
  | "queue_add"
  | "queue_remove"
  | "queue_move"
  // Generic
  | string;

/**
 * Entry categories for transcript_entries.
 */
export type EntryCategory =
  | "lifecycle"
  | "action"
  | "validation"
  | "knowledge"
  | "coordination"
  | "communication"
  | "user_interaction"
  | "external"
  | "system"
  | "queue"
  | string;

/**
 * Sequence tracker per execution.
 */
const executionSequences: Map<string, number> = new Map();

/**
 * Universal Event Emitter - emit events from ANY source.
 *
 * Usage:
 *   // Agent event
 *   eventEmitter.emit(
 *     { source: "agent", executionId: "exec-123", instanceId: "ba-001" },
 *     { entryType: "task_start", category: "lifecycle", summary: "Starting task" }
 *   );
 *
 *   // Telegram event
 *   eventEmitter.emit(
 *     { source: "telegram", chatId: "12345" },
 *     { entryType: "message_received", category: "communication", summary: "User message" }
 *   );
 *
 *   // System event
 *   eventEmitter.emit(
 *     { source: "system" },
 *     { entryType: "wave_start", category: "lifecycle", summary: "Wave 1 started" }
 *   );
 */
export class UnifiedEventEmitter {
  /**
   * Get next sequence number for an execution (agent events only).
   */
  private getNextSequence(executionId: string | undefined): number | null {
    if (!executionId) return null;

    const current = executionSequences.get(executionId) || 0;
    const next = current + 1;
    executionSequences.set(executionId, next);
    return next;
  }

  /**
   * Emit an event from any source.
   *
   * @param context Source-specific context
   * @param data Event data
   * @returns Entry ID (UUID)
   */
  emit(context: EventContext, data: EventData): string {
    const id = uuid();
    const timestamp = new Date().toISOString();

    // Get sequence for agent events
    const executionId =
      "executionId" in context ? context.executionId : undefined;
    const sequence = this.getNextSequence(executionId);

    // Build the entry
    const entry = {
      id,
      timestamp,
      sequence,
      source: context.source,
      entry_type: data.entryType,
      category: data.category,
      summary: data.summary.slice(0, 500), // Truncate long summaries
      details: JSON.stringify(data.details || {}),
      duration_ms: data.durationMs || null,

      // Agent context (optional)
      execution_id: "executionId" in context ? context.executionId : null,
      task_id: "taskId" in context ? context.taskId : null,
      instance_id: "instanceId" in context ? context.instanceId : null,
      wave_id: "waveId" in context ? context.waveId : null,
      wave_number: "waveNumber" in context ? context.waveNumber : null,

      // Telegram context (optional)
      chat_id: "chatId" in context ? context.chatId : null,
      telegram_user_id:
        "telegramUserId" in context ? context.telegramUserId : null,
      message_id: "messageId" in context ? context.messageId : null,

      // Script context (optional)
      script_name: "scriptName" in context ? context.scriptName : null,
      script_args:
        "scriptArgs" in context ? JSON.stringify(context.scriptArgs) : null,

      // User context (optional)
      user_id: "userId" in context ? context.userId : null,
      session_id: "sessionId" in context ? context.sessionId : null,
      page_url: "pageUrl" in context ? context.pageUrl : null,

      // Webhook context (optional)
      webhook_url: "webhookUrl" in context ? context.webhookUrl : null,
      webhook_method: "webhookMethod" in context ? context.webhookMethod : null,

      // Cross-source correlation
      correlation_id: "correlationId" in context ? context.correlationId : null,
    };

    // Insert into database
    try {
      run(
        `
        INSERT INTO transcript_entries (
          id, timestamp, sequence, source,
          entry_type, category, summary, details, duration_ms,
          execution_id, task_id, instance_id, wave_id, wave_number,
          chat_id, telegram_user_id, message_id,
          script_name, script_args,
          user_id, session_id, page_url,
          webhook_url, webhook_method, correlation_id
        ) VALUES (
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?
        )
      `,
        [
          entry.id,
          entry.timestamp,
          entry.sequence,
          entry.source,
          entry.entry_type,
          entry.category,
          entry.summary,
          entry.details,
          entry.duration_ms,
          entry.execution_id,
          entry.task_id,
          entry.instance_id,
          entry.wave_id,
          entry.wave_number,
          entry.chat_id,
          entry.telegram_user_id,
          entry.message_id,
          entry.script_name,
          entry.script_args,
          entry.user_id,
          entry.session_id,
          entry.page_url,
          entry.webhook_url,
          entry.webhook_method,
          entry.correlation_id,
        ],
      );

      // Async save (don't block)
      saveDb().catch(() => {
        /* ignore save errors */
      });
    } catch (error) {
      // Log but don't throw - observability should not break main flow
      console.error("[UnifiedEventEmitter] Failed to emit event:", error);
    }

    return id;
  }

  /**
   * Emit a system event (convenience method).
   */
  emitSystem(
    entryType: TranscriptEntryType,
    summary: string,
    details?: Record<string, unknown>,
  ): string {
    return this.emit(
      { source: "system" },
      { entryType, category: "system", summary, details },
    );
  }

  /**
   * Emit a lifecycle event (convenience method).
   */
  emitLifecycle(
    entryType: TranscriptEntryType,
    summary: string,
    details?: Record<string, unknown>,
    correlationId?: string,
  ): string {
    return this.emit(
      { source: "system", correlationId },
      { entryType, category: "lifecycle", summary, details },
    );
  }

  /**
   * Reset sequence for an execution (call at execution start).
   */
  resetSequence(executionId: string): void {
    executionSequences.delete(executionId);
  }

  /**
   * Get current sequence for an execution.
   */
  getSequence(executionId: string): number {
    return executionSequences.get(executionId) || 0;
  }
}

// Export singleton for convenience
export const eventEmitter = new UnifiedEventEmitter();
```

---

### Task OBS-TS-002: Create Execution Manager

```yaml
id: OBS-TS-002
action: CREATE
file: "server/services/observability/execution-manager.ts"
status: pending
estimated_time: "30 min"
depends_on: ["OBS-TS-001"]

requirements:
  - createExecutionRun(taskListId) → execution_id function
  - Insert record into task_list_execution_runs table
  - Generate UUID for execution_id
  - Track status: pending, running, completed, failed
  - completeExecutionRun(execution_id, status) function
  - getExecutionStatus(execution_id) function
  - Support wave tracking

validation:
  command: |
    npx tsc --noEmit server/services/observability/execution-manager.ts
  expected: "exit code 0"

pass_criteria:
  - [ ] createExecutionRun() inserts record
  - [ ] completeExecutionRun() updates status
  - [ ] getExecutionStatus() retrieves current state
  - [ ] recordWaveStart() records wave start
  - [ ] recordWaveComplete() records wave completion
```

**Implementation:**

```typescript
// server/services/observability/execution-manager.ts

import { v4 as uuid } from "uuid";
import { run, getOne, saveDb } from "../../../database/db.js";
import { eventEmitter } from "./unified-event-emitter.js";

/**
 * Execution run status.
 */
export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Execution run record.
 */
export interface ExecutionRun {
  id: string;
  taskListId: string;
  status: ExecutionStatus;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalWaves: number;
  currentWave: number;
  startedAt: string;
  completedAt?: string;
}

/**
 * Wave record.
 */
export interface WaveRecord {
  id: string;
  executionId: string;
  waveNumber: number;
  status: ExecutionStatus;
  taskCount: number;
  completedCount: number;
  failedCount: number;
  startedAt: string;
  completedAt?: string;
}

/**
 * Create a new execution run for a task list.
 *
 * @param taskListId Task list to execute
 * @param totalTasks Total number of tasks
 * @param totalWaves Total number of waves
 * @returns execution_id
 */
export async function createExecutionRun(
  taskListId: string,
  totalTasks: number,
  totalWaves: number,
): Promise<string> {
  const executionId = uuid();

  await run(
    `INSERT INTO task_list_execution_runs (
      id, task_list_id, status, total_tasks, completed_tasks, failed_tasks,
      total_waves, current_wave, started_at
    ) VALUES (?, ?, 'running', ?, 0, 0, ?, 1, datetime('now'))`,
    [executionId, taskListId, totalTasks, totalWaves],
  );

  // Reset sequence for this execution
  eventEmitter.resetSequence(executionId);

  // Emit execution start event
  eventEmitter.emitLifecycle("execution_start", `Execution started`, {
    executionId,
    taskListId,
    totalTasks,
    totalWaves,
  });

  await saveDb();
  return executionId;
}

/**
 * Update execution run progress.
 *
 * @param executionId Execution run ID
 * @param completedTasks Number of completed tasks
 * @param failedTasks Number of failed tasks
 * @param currentWave Current wave number
 */
export async function updateExecutionProgress(
  executionId: string,
  completedTasks: number,
  failedTasks: number,
  currentWave: number,
): Promise<void> {
  await run(
    `UPDATE task_list_execution_runs SET
      completed_tasks = ?,
      failed_tasks = ?,
      current_wave = ?,
      updated_at = datetime('now')
    WHERE id = ?`,
    [completedTasks, failedTasks, currentWave, executionId],
  );
  await saveDb();
}

/**
 * Complete an execution run.
 *
 * @param executionId Execution run ID
 * @param status Final status
 * @param error Error message if failed
 */
export async function completeExecutionRun(
  executionId: string,
  status: "completed" | "failed" | "cancelled",
  error?: string,
): Promise<void> {
  await run(
    `UPDATE task_list_execution_runs SET
      status = ?,
      error_message = ?,
      completed_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?`,
    [status, error || null, executionId],
  );

  // Emit execution complete event
  eventEmitter.emitLifecycle(
    "execution_complete",
    `Execution ${status}`,
    {
      executionId,
      status,
      error,
    },
    executionId,
  );

  await saveDb();
}

/**
 * Get execution run status.
 *
 * @param executionId Execution run ID
 * @returns Execution run or null
 */
export async function getExecutionStatus(
  executionId: string,
): Promise<ExecutionRun | null> {
  const row = await getOne<{
    id: string;
    task_list_id: string;
    status: string;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    total_waves: number;
    current_wave: number;
    started_at: string;
    completed_at: string | null;
  }>("SELECT * FROM task_list_execution_runs WHERE id = ?", [executionId]);

  if (!row) return null;

  return {
    id: row.id,
    taskListId: row.task_list_id,
    status: row.status as ExecutionStatus,
    totalTasks: row.total_tasks,
    completedTasks: row.completed_tasks,
    failedTasks: row.failed_tasks,
    totalWaves: row.total_waves,
    currentWave: row.current_wave,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
  };
}

/**
 * Record wave start.
 *
 * @param executionId Execution run ID
 * @param waveNumber Wave number (1-indexed)
 * @param taskCount Number of tasks in wave
 * @returns wave_id
 */
export async function recordWaveStart(
  executionId: string,
  waveNumber: number,
  taskCount: number,
): Promise<string> {
  const waveId = uuid();

  await run(
    `INSERT INTO parallel_execution_waves (
      id, execution_run_id, wave_number, status, task_count,
      completed_count, failed_count, started_at
    ) VALUES (?, ?, ?, 'in_progress', ?, 0, 0, datetime('now'))`,
    [waveId, executionId, waveNumber, taskCount],
  );

  // Emit wave start event
  eventEmitter.emit(
    { source: "system", correlationId: executionId },
    {
      entryType: "wave_start",
      category: "lifecycle",
      summary: `Wave ${waveNumber} started with ${taskCount} tasks`,
      details: {
        executionId,
        waveId,
        waveNumber,
        taskCount,
      },
    },
  );

  await saveDb();
  return waveId;
}

/**
 * Record wave completion.
 *
 * @param waveId Wave ID
 * @param completedCount Number of completed tasks
 * @param failedCount Number of failed tasks
 * @param durationMs Duration in milliseconds
 */
export async function recordWaveComplete(
  waveId: string,
  completedCount: number,
  failedCount: number,
  durationMs: number,
): Promise<void> {
  const status = failedCount === 0 ? "completed" : "failed";

  await run(
    `UPDATE parallel_execution_waves SET
      status = ?,
      completed_count = ?,
      failed_count = ?,
      duration_ms = ?,
      completed_at = datetime('now')
    WHERE id = ?`,
    [status, completedCount, failedCount, durationMs, waveId],
  );

  // Get wave info for event
  const wave = await getOne<{
    execution_run_id: string;
    wave_number: number;
    task_count: number;
  }>(
    "SELECT execution_run_id, wave_number, task_count FROM parallel_execution_waves WHERE id = ?",
    [waveId],
  );

  if (wave) {
    const passRate =
      wave.task_count > 0
        ? Math.round((completedCount / wave.task_count) * 100)
        : 0;

    // Emit wave complete event
    eventEmitter.emit(
      { source: "system", correlationId: wave.execution_run_id },
      {
        entryType: "wave_complete",
        category: "lifecycle",
        summary: `Wave ${wave.wave_number} ${status} (${passRate}% pass rate)`,
        details: {
          executionId: wave.execution_run_id,
          waveId,
          waveNumber: wave.wave_number,
          taskCount: wave.task_count,
          completedCount,
          failedCount,
          passRate,
          durationMs,
        },
        durationMs,
      },
    );
  }

  await saveDb();
}

/**
 * Get wave record by ID.
 *
 * @param waveId Wave ID
 * @returns Wave record or null
 */
export async function getWaveStatus(
  waveId: string,
): Promise<WaveRecord | null> {
  const row = await getOne<{
    id: string;
    execution_run_id: string;
    wave_number: number;
    status: string;
    task_count: number;
    completed_count: number;
    failed_count: number;
    started_at: string;
    completed_at: string | null;
  }>("SELECT * FROM parallel_execution_waves WHERE id = ?", [waveId]);

  if (!row) return null;

  return {
    id: row.id,
    executionId: row.execution_run_id,
    waveNumber: row.wave_number,
    status: row.status as ExecutionStatus,
    taskCount: row.task_count,
    completedCount: row.completed_count,
    failedCount: row.failed_count,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
  };
}
```

---

### Task OBS-TS-003: Create Index File

```yaml
id: OBS-TS-003
action: CREATE
file: "server/services/observability/index.ts"
status: pending
estimated_time: "5 min"
depends_on: ["OBS-TS-001", "OBS-TS-002"]

requirements:
  - Re-export all observability components
  - Provide unified import path

validation:
  command: |
    npx tsc --noEmit server/services/observability/index.ts
  expected: "exit code 0"

pass_criteria:
  - [ ] UnifiedEventEmitter re-exported
  - [ ] eventEmitter singleton re-exported
  - [ ] ExecutionManager functions re-exported
  - [ ] Types re-exported
```

**Implementation:**

```typescript
// server/services/observability/index.ts

export {
  UnifiedEventEmitter,
  eventEmitter,
  EventSource,
  EventContext,
  EventData,
  AgentContext,
  TelegramContext,
  ScriptContext,
  UserContext,
  WebhookContext,
  IdeationContext,
  SystemContext,
  CustomContext,
  TranscriptEntryType,
  EntryCategory,
} from "./unified-event-emitter.js";

export {
  createExecutionRun,
  updateExecutionProgress,
  completeExecutionRun,
  getExecutionStatus,
  recordWaveStart,
  recordWaveComplete,
  getWaveStatus,
  ExecutionRun,
  ExecutionStatus,
  WaveRecord,
} from "./execution-manager.js";
```

---

## Phase 2: Build Agent Orchestrator Integration (P0)

### Task OBS-ORK-001: Add Execution Run Management

```yaml
id: OBS-ORK-001
action: UPDATE
file: "server/services/task-agent/build-agent-orchestrator.ts"
status: pending
estimated_time: "30 min"
depends_on: ["OBS-TS-002"]

requirements:
  - Import createExecutionRun, completeExecutionRun from observability
  - Call createExecutionRun at start of startExecution()
  - Store execution_id in module-level map
  - Call completeExecutionRun when all tasks complete or fail
  - Track wave progress with recordWaveStart/recordWaveComplete

validation:
  command: |
    grep -c 'createExecutionRun\|completeExecutionRun' server/services/task-agent/build-agent-orchestrator.ts
  expected: "at least 3 occurrences"

pass_criteria:
  - [ ] Import statement added
  - [ ] Execution context map created
  - [ ] createExecutionRun called in startExecution
  - [ ] completeExecutionRun called on completion
  - [ ] completeExecutionRun called on failure
```

**Changes to make:**

```typescript
// Add at top of file:
import {
  eventEmitter,
  createExecutionRun,
  completeExecutionRun,
  recordWaveStart,
  recordWaveComplete,
} from "../observability/index.js";

// Add module-level map for execution context:
const executionContextMap: Map<
  string,
  {
    executionId: string;
    waveId?: string;
    waveNumber: number;
    startedAt: number;
  }
> = new Map();

// In startExecution(), after calculating waves:
const executionId = await createExecutionRun(
  taskListId,
  tasksToStart.length,
  waves.length,
);
executionContextMap.set(taskListId, {
  executionId,
  waveNumber: 1,
  startedAt: Date.now(),
});

// When spawning agents, pass execution context:
const context = executionContextMap.get(taskListId);
if (context) {
  // Add to spawn arguments (covered in next task)
}

// In handleAgentCompletion(), when all tasks complete:
const context = executionContextMap.get(taskListId);
if (context && remaining?.count === 0) {
  await completeExecutionRun(context.executionId, "completed");
  executionContextMap.delete(taskListId);
}
```

---

### Task OBS-ORK-002: Pass Execution Context to Agents

```yaml
id: OBS-ORK-002
action: UPDATE
file: "server/services/task-agent/build-agent-orchestrator.ts"
status: pending
estimated_time: "20 min"
depends_on: ["OBS-ORK-001"]

requirements:
  - Modify spawnBuildAgent to accept executionId, waveId, waveNumber
  - Add --execution-id to Python spawn arguments
  - Add --wave-id to Python spawn arguments
  - Add --wave-number to Python spawn arguments

validation:
  command: |
    grep 'execution-id' server/services/task-agent/build-agent-orchestrator.ts
  expected: "shows --execution-id in spawn args"

pass_criteria:
  - [ ] spawnBuildAgent signature updated
  - [ ] --execution-id added to spawn args
  - [ ] --wave-id added to spawn args
  - [ ] --wave-number added to spawn args
  - [ ] All callers updated
```

**Changes to make:**

```typescript
// Update spawnBuildAgent signature:
export async function spawnBuildAgent(
  taskId: string,
  taskListId: string,
  executionId?: string,
  waveId?: string,
  waveNumber?: number
): Promise<BuildAgentInstance> {
  // ...existing code...

  // Update spawn args:
  const args = [
    "coding-loops/agents/build_agent_worker.py",
    "--agent-id", id,
    "--task-id", taskId,
    "--task-list-id", taskListId,
  ];

  // Add observability args if present
  if (executionId) {
    args.push("--execution-id", executionId);
  }
  if (waveId) {
    args.push("--wave-id", waveId);
  }
  if (waveNumber !== undefined) {
    args.push("--wave-number", waveNumber.toString());
  }

  const agentProcess = spawn("python3", args, { ... });
  // ...rest of existing code...
}
```

---

### Task OBS-ORK-003: Emit Agent Lifecycle Events

```yaml
id: OBS-ORK-003
action: UPDATE
file: "server/services/task-agent/build-agent-orchestrator.ts"
status: pending
estimated_time: "30 min"
depends_on: ["OBS-ORK-002"]

requirements:
  - Emit agent_spawn event when spawning agent
  - Emit agent_complete event when agent completes successfully
  - Emit agent_error event when agent fails
  - Replace console.log with eventEmitter.emit where appropriate
  - Keep console.log for debugging output (stdout/stderr)

validation:
  command: |
    grep -c 'eventEmitter.emit' server/services/task-agent/build-agent-orchestrator.ts
  expected: "at least 5 occurrences"

pass_criteria:
  - [ ] agent_spawn event emitted
  - [ ] agent_complete event emitted
  - [ ] agent_error event emitted
  - [ ] Wave lifecycle events emitted
  - [ ] Task list completion event emitted
```

**Changes to make:**

```typescript
// In spawnBuildAgent(), after creating agent:
eventEmitter.emit(
  {
    source: "system",
    correlationId: executionId,
  },
  {
    entryType: "agent_spawn",
    category: "lifecycle",
    summary: `Build Agent ${id} spawned for task`,
    details: {
      agentId: id,
      taskId,
      taskListId,
      executionId,
      waveId,
      waveNumber,
    },
  },
);

// In handleAgentExit(), on success:
eventEmitter.emit(
  {
    source: "system",
    correlationId: context?.executionId,
  },
  {
    entryType: "agent_complete",
    category: "lifecycle",
    summary: `Build Agent ${agentId} completed successfully`,
    details: {
      agentId,
      taskId,
      exitCode: code,
    },
  },
);

// In handleAgentExit(), on failure:
eventEmitter.emit(
  {
    source: "system",
    correlationId: context?.executionId,
  },
  {
    entryType: "agent_error",
    category: "lifecycle",
    summary: `Build Agent ${agentId} failed`,
    details: {
      agentId,
      taskId,
      exitCode: code,
      signal,
    },
  },
);
```

---

## Phase 3: Suggestion Engine Integration (P1)

### Task OBS-SUG-001: Add Observability to Suggestion Engine

```yaml
id: OBS-SUG-001
action: UPDATE
file: "server/services/task-agent/suggestion-engine.ts"
status: pending
estimated_time: "45 min"
depends_on: ["OBS-TS-001"]

requirements:
  - Import eventEmitter from observability
  - Emit suggestion_created event when suggestion generated
  - Emit suggestion_sent event when sent to user
  - Emit system events for loop lifecycle
  - Replace verbose console.log with events
  - Keep console.log for debugging during development

validation:
  command: |
    grep -c 'eventEmitter.emit' server/services/task-agent/suggestion-engine.ts
  expected: "at least 5 occurrences"

pass_criteria:
  - [ ] Import statement added
  - [ ] suggestion_created events emitted
  - [ ] suggestion_sent events emitted
  - [ ] Loop start/stop events emitted
  - [ ] Error events emitted
```

**Events to emit:**

| Event Type           | Category      | When                         |
| -------------------- | ------------- | ---------------------------- |
| `suggestion_created` | knowledge     | When suggestion is generated |
| `suggestion_sent`    | communication | When sent to Telegram        |
| `phase_start`        | lifecycle     | When loop starts             |
| `phase_end`          | lifecycle     | When loop stops              |
| `error`              | lifecycle     | On errors                    |

---

## Phase 4: Error Handling Integration (P1)

### Task OBS-ERR-001: Add Observability to Error Handling

```yaml
id: OBS-ERR-001
action: UPDATE
file: "server/services/task-agent/error-handling.ts"
status: pending
estimated_time: "30 min"
depends_on: ["OBS-TS-001"]

requirements:
  - Import eventEmitter from observability
  - Emit escalation event when escalating to SIA
  - Emit error event with classification details
  - Track retry attempts

validation:
  command: |
    grep -c 'eventEmitter.emit' server/services/task-agent/error-handling.ts
  expected: "at least 2 occurrences"

pass_criteria:
  - [ ] Import statement added
  - [ ] Escalation events emitted
  - [ ] Error classification events emitted
```

---

## Phase 5: Telegram Integration (P1)

### Task OBS-TG-001: Add Observability to Telegram Commands

```yaml
id: OBS-TG-001
action: UPDATE
file: "server/services/task-agent/telegram-commands/index.ts"
status: pending
estimated_time: "30 min"
depends_on: ["OBS-TS-001"]

requirements:
  - Import eventEmitter from observability
  - Emit command_invoked event for each command
  - Emit message_received for incoming messages
  - Use TelegramContext with chat_id

validation:
  command: |
    grep -c 'eventEmitter.emit' server/services/task-agent/telegram-commands/index.ts
  expected: "at least 3 occurrences"

pass_criteria:
  - [ ] Import statement added
  - [ ] command_invoked events emitted with chatId
  - [ ] Error events emitted
```

**Example:**

```typescript
// In handleNewTask:
eventEmitter.emit(
  {
    source: "telegram",
    chatId: chatId.toString(),
    telegramUserId: userId?.toString(),
    messageId: msg.message_id.toString(),
  },
  {
    entryType: "command_invoked",
    category: "communication",
    summary: `/newtask command received`,
    details: {
      command: "newtask",
      text: description,
    },
  },
);
```

---

## Phase 6: Evaluation Queue Integration (P2)

### Task OBS-EQ-001: Add Observability to Evaluation Queue

```yaml
id: OBS-EQ-001
action: UPDATE
file: "server/services/task-agent/evaluation-queue-manager.ts"
status: pending
estimated_time: "20 min"
depends_on: ["OBS-TS-001"]

requirements:
  - Import eventEmitter from observability
  - Emit queue_add event when task added to queue
  - Emit queue_remove event when task removed
  - Emit queue_move event when task moved to list

validation:
  command: |
    grep -c 'eventEmitter.emit' server/services/task-agent/evaluation-queue-manager.ts
  expected: "at least 3 occurrences"

pass_criteria:
  - [ ] Import statement added
  - [ ] queue_add events emitted
  - [ ] queue_remove events emitted
  - [ ] queue_move events emitted
```

---

## Implementation Summary

### Task Count by Phase

| Phase                      | Tasks  | Estimated Time | Priority |
| -------------------------- | ------ | -------------- | -------- |
| Phase 1: TypeScript Infra  | 3      | 1.5 hours      | P0       |
| Phase 2: Orchestrator      | 3      | 1.5 hours      | P0       |
| Phase 3: Suggestion Engine | 1      | 45 min         | P1       |
| Phase 4: Error Handling    | 1      | 30 min         | P1       |
| Phase 5: Telegram          | 1      | 30 min         | P1       |
| Phase 6: Evaluation Queue  | 1      | 20 min         | P2       |
| **TOTAL**                  | **10** | **~5 hours**   |          |

### Dependency Graph

```
OBS-TS-001 (UnifiedEventEmitter)
    │
    ├── OBS-TS-002 (ExecutionManager)
    │       │
    │       ├── OBS-ORK-001 (Execution Run Mgmt)
    │       │       │
    │       │       └── OBS-ORK-002 (Pass Context)
    │       │               │
    │       │               └── OBS-ORK-003 (Agent Events)
    │       │
    │       └── OBS-TS-003 (Index)
    │
    ├── OBS-SUG-001 (Suggestion Engine)
    ├── OBS-ERR-001 (Error Handling)
    ├── OBS-TG-001 (Telegram)
    └── OBS-EQ-001 (Evaluation Queue)
```

### Parallelization Opportunities

After Phase 1 (TypeScript Infrastructure) completes:

- Phase 2 (Orchestrator) can run
- Phase 3-6 can run in parallel with Phase 2

---

## Pass Criteria

### Phase 1 Complete When:

- [ ] `npx tsc --noEmit server/services/observability/index.ts` succeeds
- [ ] `eventEmitter` singleton is importable
- [ ] `createExecutionRun` function works

### Phase 2 Complete When:

- [ ] `grep 'execution-id' server/services/task-agent/build-agent-orchestrator.ts` shows args
- [ ] `grep -c 'eventEmitter.emit' server/services/task-agent/build-agent-orchestrator.ts` ≥ 5

### All Phases Complete When:

- [ ] Execute a task list
- [ ] `SELECT COUNT(*) FROM transcript_entries WHERE source = 'system'` returns > 0
- [ ] Wave lifecycle events visible in transcript_entries
- [ ] Agent spawn/complete events visible
- [ ] Suggestion events visible (if any suggestions generated)

---

## Verification Commands

```bash
# After Phase 1
npx tsc --noEmit server/services/observability/index.ts && echo "Phase 1: OK"

# After Phase 2
grep -c 'eventEmitter.emit' server/services/task-agent/build-agent-orchestrator.ts

# After all phases - check data
sqlite3 database/ideas.db "SELECT source, entry_type, COUNT(*) FROM transcript_entries GROUP BY source, entry_type;"

# Check wave events
sqlite3 database/ideas.db "SELECT summary, timestamp FROM transcript_entries WHERE entry_type IN ('wave_start', 'wave_complete') ORDER BY timestamp DESC LIMIT 10;"

# Check agent events
sqlite3 database/ideas.db "SELECT summary, timestamp FROM transcript_entries WHERE entry_type IN ('agent_spawn', 'agent_complete', 'agent_error') ORDER BY timestamp DESC LIMIT 10;"
```

---

## Related Documents

| Document                                                                           | Purpose                     |
| ---------------------------------------------------------------------------------- | --------------------------- |
| [IMPLEMENTATION-PLAN-PHASES-1-2.md](./IMPLEMENTATION-PLAN-PHASES-1-2.md)           | Schema + Python producers   |
| [BUILD-AGENT-OBSERVABILITY-TASK-LIST.md](./BUILD-AGENT-OBSERVABILITY-TASK-LIST.md) | Build Agent Worker (Python) |
| [AGENT-INTEGRATION-TEMPLATE.md](./AGENT-INTEGRATION-TEMPLATE.md)                   | Integration patterns        |
| [appendices/DATABASE.md](./appendices/DATABASE.md)                                 | Full SQL schema             |
| [appendices/TYPES.md](./appendices/TYPES.md)                                       | Type definitions            |

---

_Task Agent Observability Integration Plan - Connecting Task Agent services to the observability system_
