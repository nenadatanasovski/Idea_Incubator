/**
 * Log Cleanup Service
 *
 * Manages retention and cleanup of execution logs to prevent unbounded growth.
 * Part of: GAP-008 - Build Agent Gap Remediation
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";

/**
 * Retention policy configuration
 */
interface RetentionPolicy {
  id: string;
  tableName: string;
  retentionDays: number;
  maxRowsPerTask: number | null;
  lastCleanupAt: string | null;
  nextCleanupAt: string | null;
  enabled: boolean;
}

/**
 * Cleanup result
 */
interface CleanupResult {
  tableName: string;
  rowsDeleted: number;
  durationMs: number;
  reason: "retention" | "max_rows";
}

/**
 * Get all enabled retention policies
 */
export async function getEnabledPolicies(): Promise<RetentionPolicy[]> {
  const rows = await query<{
    id: string;
    table_name: string;
    retention_days: number;
    max_rows_per_task: number | null;
    last_cleanup_at: string | null;
    next_cleanup_at: string | null;
    enabled: number;
  }>(`SELECT * FROM retention_policies WHERE enabled = 1`);

  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    retentionDays: row.retention_days,
    maxRowsPerTask: row.max_rows_per_task,
    lastCleanupAt: row.last_cleanup_at,
    nextCleanupAt: row.next_cleanup_at,
    enabled: row.enabled === 1,
  }));
}

/**
 * Run cleanup for a specific table based on retention days
 */
async function cleanupByRetention(
  tableName: string,
  retentionDays: number,
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffStr = cutoffDate.toISOString();

  // Different tables have different created_at column names
  const createdAtColumn =
    tableName === "agent_heartbeats" ? "created_at" : "created_at";

  const result = await run(
    `DELETE FROM ${tableName} WHERE ${createdAtColumn} < ?`,
    [cutoffStr],
  );

  return result;
}

/**
 * Run cleanup for a specific table based on max rows per task
 */
async function cleanupByMaxRows(
  tableName: string,
  maxRowsPerTask: number,
): Promise<number> {
  // This only applies to tables with task_id column
  if (tableName === "task_execution_log") {
    // Delete oldest entries beyond the limit for each task
    const result = await run(
      `DELETE FROM task_execution_log
       WHERE id IN (
         SELECT id FROM (
           SELECT id, task_id,
                  ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at DESC) as rn
           FROM task_execution_log
         ) ranked
         WHERE rn > ?
       )`,
      [maxRowsPerTask],
    );
    return result;
  }

  if (tableName === "agent_heartbeats") {
    const result = await run(
      `DELETE FROM agent_heartbeats
       WHERE id IN (
         SELECT id FROM (
           SELECT id, agent_id,
                  ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY created_at DESC) as rn
           FROM agent_heartbeats
         ) ranked
         WHERE rn > ?
       )`,
      [maxRowsPerTask],
    );
    return result;
  }

  return 0;
}

/**
 * Record cleanup operation in cleanup_log
 */
async function recordCleanup(
  tableName: string,
  rowsDeleted: number,
  reason: "retention" | "max_rows",
  durationMs: number,
): Promise<void> {
  await run(
    `INSERT INTO cleanup_log (id, table_name, rows_deleted, cleanup_reason, completed_at, duration_ms)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`,
    [uuidv4(), tableName, rowsDeleted, reason, durationMs],
  );
}

/**
 * Update policy last/next cleanup times
 */
async function updatePolicyTimestamp(policyId: string): Promise<void> {
  // Schedule next cleanup for tomorrow at the same time
  await run(
    `UPDATE retention_policies
     SET last_cleanup_at = datetime('now'),
         next_cleanup_at = datetime('now', '+1 day'),
         updated_at = datetime('now')
     WHERE id = ?`,
    [policyId],
  );
}

/**
 * Run cleanup for a single policy
 */
export async function runCleanupForPolicy(
  policy: RetentionPolicy,
): Promise<CleanupResult[]> {
  const results: CleanupResult[] = [];

  // Cleanup by retention days
  const startRetention = Date.now();
  const rowsByRetention = await cleanupByRetention(
    policy.tableName,
    policy.retentionDays,
  );
  const durationRetention = Date.now() - startRetention;

  if (rowsByRetention > 0) {
    await recordCleanup(
      policy.tableName,
      rowsByRetention,
      "retention",
      durationRetention,
    );
    results.push({
      tableName: policy.tableName,
      rowsDeleted: rowsByRetention,
      durationMs: durationRetention,
      reason: "retention",
    });
    console.log(
      `[LogCleanup] Deleted ${rowsByRetention} rows from ${policy.tableName} (retention: ${policy.retentionDays} days)`,
    );
  }

  // Cleanup by max rows per task
  if (policy.maxRowsPerTask) {
    const startMaxRows = Date.now();
    const rowsByMaxRows = await cleanupByMaxRows(
      policy.tableName,
      policy.maxRowsPerTask,
    );
    const durationMaxRows = Date.now() - startMaxRows;

    if (rowsByMaxRows > 0) {
      await recordCleanup(
        policy.tableName,
        rowsByMaxRows,
        "max_rows",
        durationMaxRows,
      );
      results.push({
        tableName: policy.tableName,
        rowsDeleted: rowsByMaxRows,
        durationMs: durationMaxRows,
        reason: "max_rows",
      });
      console.log(
        `[LogCleanup] Deleted ${rowsByMaxRows} rows from ${policy.tableName} (max rows: ${policy.maxRowsPerTask})`,
      );
    }
  }

  // Update policy timestamp
  await updatePolicyTimestamp(policy.id);
  await saveDb();

  return results;
}

/**
 * Run cleanup for all enabled policies
 */
export async function runAllCleanups(): Promise<CleanupResult[]> {
  console.log("[LogCleanup] Starting cleanup for all enabled policies");
  const policies = await getEnabledPolicies();
  const allResults: CleanupResult[] = [];

  for (const policy of policies) {
    try {
      const results = await runCleanupForPolicy(policy);
      allResults.push(...results);
    } catch (error) {
      console.error(
        `[LogCleanup] Error cleaning up ${policy.tableName}:`,
        error,
      );
    }
  }

  console.log(
    `[LogCleanup] Completed. Total rows deleted: ${allResults.reduce((sum, r) => sum + r.rowsDeleted, 0)}`,
  );
  return allResults;
}

/**
 * Get cleanup statistics
 */
export async function getCleanupStats(): Promise<{
  policies: RetentionPolicy[];
  recentCleanups: Array<{
    tableName: string;
    rowsDeleted: number;
    reason: string;
    completedAt: string;
  }>;
  tableSizes: Array<{ tableName: string; rowCount: number }>;
}> {
  const policies = await getEnabledPolicies();

  const recentCleanups = await query<{
    table_name: string;
    rows_deleted: number;
    cleanup_reason: string;
    completed_at: string;
  }>(
    `SELECT table_name, rows_deleted, cleanup_reason, completed_at
     FROM cleanup_log
     ORDER BY completed_at DESC
     LIMIT 20`,
  );

  // Get current table sizes
  const tableSizes: Array<{ tableName: string; rowCount: number }> = [];

  for (const policy of policies) {
    try {
      const result = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${policy.tableName}`,
      );
      tableSizes.push({
        tableName: policy.tableName,
        rowCount: result?.count || 0,
      });
    } catch (error) {
      // Table might not exist yet
      tableSizes.push({ tableName: policy.tableName, rowCount: 0 });
    }
  }

  return {
    policies,
    recentCleanups: recentCleanups.map((r) => ({
      tableName: r.table_name,
      rowsDeleted: r.rows_deleted,
      reason: r.cleanup_reason,
      completedAt: r.completed_at,
    })),
    tableSizes,
  };
}

/**
 * Start periodic cleanup (every 24 hours)
 */
let cleanupInterval: NodeJS.Timeout | null = null;

export function startPeriodicCleanup(intervalHours: number = 24): void {
  if (cleanupInterval) {
    console.log("[LogCleanup] Periodic cleanup already running");
    return;
  }

  const intervalMs = intervalHours * 60 * 60 * 1000;
  console.log(
    `[LogCleanup] Starting periodic cleanup every ${intervalHours} hours`,
  );

  // Run immediately
  runAllCleanups().catch(console.error);

  // Then run periodically
  cleanupInterval = setInterval(() => {
    runAllCleanups().catch(console.error);
  }, intervalMs);
}

export function stopPeriodicCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log("[LogCleanup] Stopped periodic cleanup");
  }
}

export default {
  getEnabledPolicies,
  runCleanupForPolicy,
  runAllCleanups,
  getCleanupStats,
  startPeriodicCleanup,
  stopPeriodicCleanup,
};
