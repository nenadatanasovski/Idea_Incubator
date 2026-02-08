/**
 * Error Handling Service for Build Agent
 *
 * Provides error classification, retry logic, and SIA escalation.
 * Implements BA-041 to BA-052 from the Build Agent spec.
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import { orchestratorEvents } from "./build-agent-orchestrator.js";
import { queryKnowledge } from "../../../agents/sia/db.js";

// ============================================================
// Types
// ============================================================

export type ErrorType = "transient" | "permanent" | "unknown";

export type FailureDecision = "retry" | "skip" | "escalate" | "abort";

export interface ClassifiedError {
  type: ErrorType;
  category: string;
  message: string;
  isRetryable: boolean;
  suggestedAction: FailureDecision;
}

export interface FailureContext {
  taskId: string;
  taskDisplayId: string;
  taskTitle: string;
  taskListId?: string;
  agentId?: string;
  attemptNumber: number;
  consecutiveFailures: number;
  recentErrors: Array<{
    errorType: string;
    errorMessage: string;
    failedAt: string;
  }>;
  currentStep?: string;
  filePath?: string;
  stackTrace?: string;
  stdoutTail?: string;
  stderrTail?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ============================================================
// Error Classification (BA-041)
// ============================================================

/**
 * Patterns for classifying errors as transient (recoverable)
 */
const TRANSIENT_PATTERNS = [
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
  /timeout/i,
  /rate.?limit/i,
  /429/,
  /503/,
  /502/,
  /500.*internal.?server/i,
  /temporarily.?unavailable/i,
  /connection.?refused/i,
  /network.?error/i,
  /SIGTERM/i, // Process killed
  /SIGKILL/i,
  /out.?of.?memory/i,
  /OOM/i,
];

/**
 * Patterns for classifying errors as permanent (non-recoverable)
 */
const PERMANENT_PATTERNS = [
  /syntax.?error/i,
  /SyntaxError/,
  /TypeError/,
  /ReferenceError/,
  /file.?not.?found/i,
  /ENOENT/,
  /permission.?denied/i,
  /EACCES/,
  /invalid.?argument/i,
  /type.?error/i,
  /module.?not.?found/i,
  /cannot.?find.?module/i,
  /compilation.?failed/i,
  /compile.?error/i,
  /lint.?error/i,
  /test.?failed/i,
  /assertion.?failed/i,
  /duplicate.?key/i,
  /constraint.?violation/i,
];

/**
 * Error categories for analytics
 */
const ERROR_CATEGORIES: Record<string, RegExp[]> = {
  network: [/ETIMEDOUT/i, /ECONNRESET/i, /network/i, /connection/i],
  validation: [/validation/i, /lint/i, /type.?check/i],
  compilation: [/compile/i, /syntax/i, /parse/i, /tsc/i],
  test: [/test/i, /assertion/i, /expect/i],
  filesystem: [/ENOENT/i, /EACCES/i, /file/i, /directory/i],
  database: [/sqlite/i, /constraint/i, /duplicate/i, /sql/i],
  timeout: [/timeout/i, /ETIMEDOUT/i],
  memory: [/memory/i, /OOM/i, /heap/i],
  process: [/SIGTERM/i, /SIGKILL/i, /exit.?code/i],
};

/**
 * Classify an error to determine if it's retryable (BA-041)
 */
export function classifyError(
  errorMessage: string,
  exitCode?: number | null,
): ClassifiedError {
  const message = errorMessage || "Unknown error";

  // Check for transient patterns
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        type: "transient",
        category: detectCategory(message),
        message,
        isRetryable: true,
        suggestedAction: "retry",
      };
    }
  }

  // Check for permanent patterns
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        type: "permanent",
        category: detectCategory(message),
        message,
        isRetryable: false,
        suggestedAction: "escalate",
      };
    }
  }

  // Check exit codes
  if (exitCode !== null && exitCode !== undefined) {
    // Exit code 0 means success, shouldn't be here
    if (exitCode === 0) {
      return {
        type: "unknown",
        category: "unexpected",
        message,
        isRetryable: false,
        suggestedAction: "skip",
      };
    }

    // Common exit codes
    if (exitCode === 1) {
      // Generic error - could be anything
      return {
        type: "unknown",
        category: detectCategory(message),
        message,
        isRetryable: true, // Give it one retry
        suggestedAction: "retry",
      };
    }

    if (exitCode === 137 || exitCode === 139) {
      // SIGKILL (137) or SIGSEGV (139) - usually memory issues
      return {
        type: "transient",
        category: "memory",
        message,
        isRetryable: true,
        suggestedAction: "retry",
      };
    }
  }

  // Default: unknown, give it a retry
  return {
    type: "unknown",
    category: detectCategory(message),
    message,
    isRetryable: true,
    suggestedAction: "retry",
  };
}

/**
 * Detect error category from message
 */
function detectCategory(message: string): string {
  for (const [category, patterns] of Object.entries(ERROR_CATEGORIES)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return category;
      }
    }
  }
  return "general";
}

// ============================================================
// Retry Logic (BA-042)
// ============================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const delay =
    config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  // Add jitter (±10%)
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Retry a task with exponential backoff (BA-042)
 */
export async function retryTaskWithBackoff(
  taskId: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<{ shouldRetry: boolean; delayMs: number; reason: string }> {
  // Get task retry info
  const task = await getOne<{
    id: string;
    display_id: string;
    retry_count: number;
    max_retries: number;
    consecutive_failures: number;
    last_error_type: string | null;
  }>(
    `SELECT id, display_id, retry_count, max_retries, consecutive_failures, last_error_type
     FROM tasks WHERE id = ?`,
    [taskId],
  );

  if (!task) {
    return { shouldRetry: false, delayMs: 0, reason: "Task not found" };
  }

  const maxRetries = task.max_retries || config.maxRetries;
  const currentRetry = task.retry_count || 0;

  // Check if we've exceeded max retries
  if (currentRetry >= maxRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: `Max retries (${maxRetries}) exceeded`,
    };
  }

  // Check if error type is permanent
  if (task.last_error_type === "permanent") {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: "Error classified as permanent (non-retryable)",
    };
  }

  // Calculate delay
  const delayMs = calculateBackoffDelay(currentRetry + 1, config);

  // Update retry count
  await run(
    `UPDATE tasks
     SET retry_count = retry_count + 1,
         status = 'pending',
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskId],
  );
  await saveDb();

  return {
    shouldRetry: true,
    delayMs,
    reason: `Retry ${currentRetry + 1}/${maxRetries} after ${delayMs}ms`,
  };
}

// ============================================================
// Consecutive Failures Tracking (BA-043)
// ============================================================

/**
 * Increment consecutive failures counter
 */
export async function incrementConsecutiveFailures(
  taskId: string,
  errorType: ErrorType,
  errorMessage: string,
): Promise<number> {
  await run(
    `UPDATE tasks
     SET consecutive_failures = consecutive_failures + 1,
         last_error_type = ?,
         last_error_message = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [errorType, errorMessage, taskId],
  );
  await saveDb();

  const task = await getOne<{ consecutive_failures: number }>(
    "SELECT consecutive_failures FROM tasks WHERE id = ?",
    [taskId],
  );

  return task?.consecutive_failures || 0;
}

/**
 * Reset consecutive failures counter (on success)
 */
export async function resetConsecutiveFailures(taskId: string): Promise<void> {
  await run(
    `UPDATE tasks
     SET consecutive_failures = 0,
         last_error_type = NULL,
         last_error_message = NULL,
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskId],
  );
  await saveDb();
}

// ============================================================
// SIA Escalation (BA-044)
// ============================================================

const SIA_ESCALATION_THRESHOLD = 3; // Consecutive failures before escalation

/**
 * Check if task should be escalated to SIA (BA-044)
 */
export async function checkSIAEscalation(taskId: string): Promise<{
  shouldEscalate: boolean;
  reason?: string;
}> {
  const task = await getOne<{
    consecutive_failures: number;
    escalated_to_sia: number;
    task_list_id: string | null;
    display_id: string;
    title: string;
  }>(
    `SELECT consecutive_failures, escalated_to_sia, task_list_id, display_id, title
     FROM tasks WHERE id = ?`,
    [taskId],
  );

  if (!task) {
    return { shouldEscalate: false };
  }

  // Already escalated
  if (task.escalated_to_sia === 1) {
    return { shouldEscalate: false, reason: "Already escalated to SIA" };
  }

  // Check for "no progress" - same error repeated (BA-045)
  const recentErrors = await query<{ error_message: string }>(
    `SELECT error_message FROM task_failure_history
     WHERE task_id = ?
     ORDER BY failed_at DESC
     LIMIT 3`,
    [taskId],
  );

  if (recentErrors.length >= 3) {
    const allSame = recentErrors.every(
      (e) => e.error_message === recentErrors[0].error_message,
    );
    if (allSame) {
      return {
        shouldEscalate: true,
        reason: "No progress: same error repeated 3 times",
      };
    }
  }

  // Check consecutive failures threshold
  if (task.consecutive_failures >= SIA_ESCALATION_THRESHOLD) {
    return {
      shouldEscalate: true,
      reason: `${task.consecutive_failures} consecutive failures`,
    };
  }

  return { shouldEscalate: false };
}

/**
 * Escalate task to SIA
 */
export async function escalateToSIA(
  taskId: string,
  reason: string,
  context: FailureContext,
): Promise<string> {
  const escalationId = uuidv4();

  // Mark task as escalated
  await run(
    `UPDATE tasks
     SET escalated_to_sia = 1,
         escalated_at = datetime('now'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [taskId],
  );

  // Create SIA escalation record
  await run(
    `INSERT INTO sia_escalations (
      id, task_id, task_list_id, escalation_reason, failure_context
    ) VALUES (?, ?, ?, ?, ?)`,
    [
      escalationId,
      taskId,
      context.taskListId || null,
      reason === "No progress: same error repeated 3 times"
        ? "no_progress"
        : reason.includes("consecutive failures")
          ? "max_retries_exceeded"
          : "repeated_failure",
      JSON.stringify(context),
    ],
  );
  await saveDb();

  // Emit build.stuck event (BA-046)
  orchestratorEvents.emit("build.stuck", {
    taskId,
    taskListId: context.taskListId,
    consecutiveFailures: context.consecutiveFailures,
    lastErrors: context.recentErrors.map((e) => e.errorMessage),
    noProgressReason: reason,
    escalationId,
  });

  // Spawn async SIA analysis (GAP-012)
  spawnSIAAnalysis(escalationId, context).catch((err) => {
    console.error(`[ErrorHandling] SIA analysis failed: ${err.message}`);
  });

  console.log(
    `[ErrorHandling] Task ${context.taskDisplayId} escalated to SIA: ${reason}`,
  );

  return escalationId;
}

/**
 * Spawn async SIA analysis for an escalation (GAP-012)
 * 
 * Queries the knowledge base for similar issues and stores suggestions.
 */
async function spawnSIAAnalysis(
  escalationId: string,
  context: FailureContext,
): Promise<void> {
  console.log(`[SIA] Starting analysis for escalation ${escalationId}`);

  // Query knowledge base for similar gotchas
  const similarGotchas = await queryKnowledge({
    type: "gotcha",
    limit: 5,
  });

  // Query for relevant patterns
  const relevantPatterns = await queryKnowledge({
    type: "pattern",
    limit: 3,
  });

  // Store SIA analysis results
  const suggestions = [
    ...similarGotchas.map((g) => ({
      type: "gotcha",
      content: g.content,
      confidence: g.confidence || 0.5,
    })),
    ...relevantPatterns.map((p) => ({
      type: "pattern",
      content: p.content,
      confidence: p.confidence || 0.5,
    })),
  ];

  // Update escalation with suggestions
  await run(
    `UPDATE sia_escalations 
     SET analysis_result = ?, analyzed_at = datetime('now')
     WHERE id = ?`,
    [JSON.stringify({ suggestions, analyzedAt: new Date().toISOString() }), escalationId],
  );
  await saveDb();

  console.log(
    `[SIA] Analysis complete for ${escalationId}: ${suggestions.length} suggestions found`,
  );

  // Emit event for UI updates
  orchestratorEvents.emit("sia.analysis_complete", {
    escalationId,
    taskId: context.taskId,
    suggestionsCount: suggestions.length,
  });
}

// ============================================================
// Failure Context Gathering (BA-047)
// ============================================================

/**
 * Gather comprehensive failure context for debugging (BA-047)
 */
export async function gatherFailureContext(
  taskId: string,
  agentId?: string,
  currentStep?: string,
  filePath?: string,
  stackTrace?: string,
  stdoutTail?: string,
  stderrTail?: string,
): Promise<FailureContext> {
  // Get task info
  const task = await getOne<{
    id: string;
    display_id: string;
    title: string;
    task_list_id: string | null;
    consecutive_failures: number;
    retry_count: number;
  }>(
    `SELECT id, display_id, title, task_list_id, consecutive_failures, retry_count
     FROM tasks WHERE id = ?`,
    [taskId],
  );

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Get recent errors
  const recentErrors = await query<{
    error_type: string;
    error_message: string;
    failed_at: string;
  }>(
    `SELECT error_type, error_message, failed_at
     FROM task_failure_history
     WHERE task_id = ?
     ORDER BY failed_at DESC
     LIMIT 5`,
    [taskId],
  );

  return {
    taskId: task.id,
    taskDisplayId: task.display_id,
    taskTitle: task.title,
    taskListId: task.task_list_id || undefined,
    agentId,
    attemptNumber: (task.retry_count || 0) + 1,
    consecutiveFailures: task.consecutive_failures,
    recentErrors: recentErrors.map((e) => ({
      errorType: e.error_type,
      errorMessage: e.error_message,
      failedAt: e.failed_at,
    })),
    currentStep,
    filePath,
    stackTrace,
    stdoutTail,
    stderrTail,
  };
}

// ============================================================
// Record Failure (combines several operations)
// ============================================================

/**
 * Record a task failure with classification and history
 */
export async function recordFailure(
  taskId: string,
  errorMessage: string,
  agentId?: string,
  exitCode?: number | null,
  currentStep?: string,
  filePath?: string,
  stackTrace?: string,
  stdoutTail?: string,
  stderrTail?: string,
): Promise<void> {
  // Classify the error
  const classified = classifyError(errorMessage, exitCode);

  // Get current attempt number
  const task = await getOne<{ retry_count: number }>(
    "SELECT retry_count FROM tasks WHERE id = ?",
    [taskId],
  );
  const attemptNumber = (task?.retry_count || 0) + 1;

  // Record in failure history
  await run(
    `INSERT INTO task_failure_history (
      id, task_id, agent_id, error_type, error_message, error_category,
      attempt_number, current_step, file_path, stack_trace, stdout_tail, stderr_tail
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      taskId,
      agentId || null,
      classified.type,
      classified.message,
      classified.category,
      attemptNumber,
      currentStep || null,
      filePath || null,
      stackTrace || null,
      stdoutTail || null,
      stderrTail || null,
    ],
  );

  // Increment consecutive failures
  await incrementConsecutiveFailures(
    taskId,
    classified.type,
    classified.message,
  );

  await saveDb();
}

// ============================================================
// Failure Decision Making (BA-050)
// ============================================================

/**
 * Make a decision on how to handle a task failure (BA-050)
 */
export async function makeFailureDecision(
  taskId: string,
  errorMessage: string,
  exitCode?: number | null,
): Promise<{
  decision: FailureDecision;
  reason: string;
  delayMs?: number;
  escalationId?: string;
}> {
  // Classify the error
  const classified = classifyError(errorMessage, exitCode);

  // Check if permanent error
  if (classified.type === "permanent") {
    // Check if should escalate to SIA
    const escalationCheck = await checkSIAEscalation(taskId);
    if (escalationCheck.shouldEscalate) {
      const context = await gatherFailureContext(taskId);
      const escalationId = await escalateToSIA(
        taskId,
        escalationCheck.reason || "Permanent error",
        context,
      );
      return {
        decision: "escalate",
        reason: escalationCheck.reason || "Error classified as permanent",
        escalationId,
      };
    }

    return {
      decision: "skip",
      reason: "Error classified as permanent (non-retryable)",
    };
  }

  // Check retry possibility
  const retryResult = await retryTaskWithBackoff(taskId);

  if (retryResult.shouldRetry) {
    return {
      decision: "retry",
      reason: retryResult.reason,
      delayMs: retryResult.delayMs,
    };
  }

  // Max retries exceeded - check for SIA escalation
  const escalationCheck = await checkSIAEscalation(taskId);
  if (escalationCheck.shouldEscalate) {
    const context = await gatherFailureContext(taskId);
    const escalationId = await escalateToSIA(
      taskId,
      escalationCheck.reason || retryResult.reason,
      context,
    );
    return {
      decision: "escalate",
      reason: escalationCheck.reason || retryResult.reason,
      escalationId,
    };
  }

  return {
    decision: "skip",
    reason: retryResult.reason,
  };
}

// ============================================================
// Exports
// ============================================================

export default {
  classifyError,
  calculateBackoffDelay,
  retryTaskWithBackoff,
  incrementConsecutiveFailures,
  resetConsecutiveFailures,
  checkSIAEscalation,
  escalateToSIA,
  gatherFailureContext,
  recordFailure,
  makeFailureDecision,
};
