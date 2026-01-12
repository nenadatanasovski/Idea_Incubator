// agents/sia/execution-analyzer.ts - Analyze Build Agent executions

import { getDb } from '../../database/db.js';
import {
  ExecutionAnalysis,
  TaskResult,
  FailureInfo,
  RetryInfo,
  ExtractedGotcha,
  ExtractedPattern,
} from '../../types/sia.js';
import { extractGotchas } from './gotcha-extractor.js';
import { extractPatterns } from './pattern-extractor.js';

/**
 * Database row types (from task_executions table)
 */
interface TaskExecutionRow {
  id: string;
  build_id: string;
  task_id: string;
  phase: string;
  action: string;
  file_path: string;
  attempt: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  generated_code: string | null;
  validation_command: string | null;
  validation_output: string | null;
  validation_success: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

interface BuildExecutionRow {
  id: string;
  spec_id: string;
  spec_path: string;
  status: string;
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

/**
 * Analyze a build execution and extract learnings
 */
export async function analyzeExecution(
  executionId: string
): Promise<ExecutionAnalysis> {
  // Load build execution
  const build = await loadBuildExecution(executionId);
  if (!build) {
    throw new Error(`Build execution ${executionId} not found`);
  }

  // Load all task executions for this build
  const taskRows = await loadTaskExecutions(executionId);

  // Convert to TaskResult objects
  const taskResults = taskRows.map(rowToTaskResult);

  // Identify failures
  const failures = identifyFailures(taskRows);

  // Identify retries (tasks that were attempted multiple times)
  const retries = identifyRetries(taskRows);

  // Extract gotchas from failures
  const extractedGotchas = extractGotchas(failures);

  // Extract patterns from successful tasks with generated code
  const successfulTasks = taskResults.filter(
    (t) => t.status === 'success' && t.codeWritten
  );
  const extractedPatterns = extractPatterns(successfulTasks);

  // Calculate statistics
  const successfulCount = taskResults.filter((t) => t.status === 'success').length;
  const failedCount = taskResults.filter((t) => t.status === 'failed').length;
  const retriedCount = retries.length;

  return {
    executionId,
    agentType: 'build',
    totalTasks: taskResults.length,
    successfulTasks: successfulCount,
    failedTasks: failedCount,
    retriedTasks: retriedCount,
    extractedGotchas,
    extractedPatterns,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Load a build execution from the database
 */
export async function loadBuildExecution(
  id: string
): Promise<BuildExecutionRow | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM build_executions WHERE id = ?');
  stmt.bind([id]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const row = stmt.getAsObject() as unknown as BuildExecutionRow;
  stmt.free();
  return row;
}

/**
 * Load all task executions for a build
 */
export async function loadTaskExecutions(
  buildId: string
): Promise<TaskExecutionRow[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM task_executions
    WHERE build_id = ?
    ORDER BY created_at ASC
  `);
  stmt.bind([buildId]);

  const rows: TaskExecutionRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as TaskExecutionRow);
  }
  stmt.free();

  return rows;
}

/**
 * Convert a database row to a TaskResult
 */
function rowToTaskResult(row: TaskExecutionRow): TaskResult {
  let status: TaskResult['status'] = 'failed';
  if (row.status === 'completed') {
    status = 'success';
  } else if (row.status === 'skipped') {
    status = 'skipped';
  }

  return {
    taskId: row.task_id,
    status,
    file: row.file_path,
    action: row.action,
    errorMessage: row.error_message || undefined,
    retryCount: row.attempt - 1,
    durationMs: row.duration_ms || 0,
    codeWritten: row.generated_code || undefined,
  };
}

/**
 * Identify failures from task execution rows
 */
export function identifyFailures(rows: TaskExecutionRow[]): FailureInfo[] {
  const failures: FailureInfo[] = [];

  for (const row of rows) {
    if (row.status === 'failed' && row.error_message) {
      // Check if this failure was eventually fixed (retry succeeded)
      const laterSuccess = rows.find(
        (r) =>
          r.task_id === row.task_id &&
          r.attempt > row.attempt &&
          r.status === 'completed'
      );

      failures.push({
        taskId: row.task_id,
        file: row.file_path,
        action: row.action,
        errorType: categorizeErrorFromMessage(row.error_message),
        errorMessage: row.error_message,
        stackTrace: extractStackTrace(row.validation_output),
        fixApplied: laterSuccess?.generated_code || undefined,
      });
    }
  }

  return failures;
}

/**
 * Identify retry patterns (tasks attempted multiple times)
 */
export function identifyRetries(rows: TaskExecutionRow[]): RetryInfo[] {
  // Group by task_id
  const taskGroups = new Map<string, TaskExecutionRow[]>();
  for (const row of rows) {
    const existing = taskGroups.get(row.task_id) || [];
    existing.push(row);
    taskGroups.set(row.task_id, existing);
  }

  const retries: RetryInfo[] = [];

  for (const [taskId, attempts] of taskGroups) {
    if (attempts.length > 1) {
      // Sort by attempt number
      attempts.sort((a, b) => a.attempt - b.attempt);

      const lastAttempt = attempts[attempts.length - 1];
      const errors = attempts
        .filter((a) => a.error_message)
        .map((a) => a.error_message as string);

      retries.push({
        taskId,
        attempts: attempts.length,
        finalStatus: lastAttempt.status === 'completed' ? 'success' : 'failed',
        errors,
      });
    }
  }

  return retries;
}

/**
 * Categorize error based on message content
 */
function categorizeErrorFromMessage(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('typescript') || lower.includes('ts') || lower.includes('type ')) {
    return 'typescript';
  }
  if (lower.includes('sql') || lower.includes('database') || lower.includes('sqlite')) {
    return 'database';
  }
  if (lower.includes('import') || lower.includes('module') || lower.includes('require')) {
    return 'module';
  }
  if (lower.includes('async') || lower.includes('await') || lower.includes('promise')) {
    return 'async';
  }
  if (lower.includes('validation') || lower.includes('test')) {
    return 'validation';
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'timeout';
  }

  return 'unknown';
}

/**
 * Extract stack trace from validation output
 */
function extractStackTrace(output: string | null): string | undefined {
  if (!output) return undefined;

  // Look for common stack trace patterns
  const stackMatch = output.match(/at\s+\S+\s+\([^)]+\)/g);
  if (stackMatch && stackMatch.length > 0) {
    return stackMatch.slice(0, 5).join('\n');
  }

  return undefined;
}

/**
 * Get recent completed builds for analysis
 */
export async function getRecentCompletedBuilds(
  limit: number = 10
): Promise<BuildExecutionRow[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM build_executions
    WHERE status IN ('completed', 'failed')
    ORDER BY completed_at DESC
    LIMIT ?
  `);
  stmt.bind([limit]);

  const rows: BuildExecutionRow[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as BuildExecutionRow);
  }
  stmt.free();

  return rows;
}

/**
 * Analyze multiple executions and aggregate results
 */
export async function analyzeMultipleExecutions(
  executionIds: string[]
): Promise<{
  analyses: ExecutionAnalysis[];
  aggregatedGotchas: ExtractedGotcha[];
  aggregatedPatterns: ExtractedPattern[];
}> {
  const analyses: ExecutionAnalysis[] = [];
  const allGotchas: ExtractedGotcha[] = [];
  const allPatterns: ExtractedPattern[] = [];

  for (const id of executionIds) {
    try {
      const analysis = await analyzeExecution(id);
      analyses.push(analysis);
      allGotchas.push(...analysis.extractedGotchas);
      allPatterns.push(...analysis.extractedPatterns);
    } catch (error) {
      // Skip builds that can't be analyzed
      console.warn(`Failed to analyze execution ${id}:`, error);
    }
  }

  // Deduplicate gotchas and patterns
  const uniqueGotchas = deduplicateGotchas(allGotchas);
  const uniquePatterns = deduplicatePatterns(allPatterns);

  return {
    analyses,
    aggregatedGotchas: uniqueGotchas,
    aggregatedPatterns: uniquePatterns,
  };
}

/**
 * Deduplicate gotchas by fix content
 */
function deduplicateGotchas(gotchas: ExtractedGotcha[]): ExtractedGotcha[] {
  const seen = new Map<string, ExtractedGotcha>();
  for (const gotcha of gotchas) {
    const key = `${gotcha.filePattern}:${gotcha.fix}`;
    if (!seen.has(key)) {
      seen.set(key, gotcha);
    }
  }
  return Array.from(seen.values());
}

/**
 * Deduplicate patterns by description
 */
function deduplicatePatterns(patterns: ExtractedPattern[]): ExtractedPattern[] {
  const seen = new Map<string, ExtractedPattern>();
  for (const pattern of patterns) {
    if (!seen.has(pattern.description)) {
      seen.set(pattern.description, pattern);
    }
  }
  return Array.from(seen.values());
}
