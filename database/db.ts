import initSqlJs, { Database as SqlJsDatabase, SqlValue } from "sql.js";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/index.js";
import { DatabaseError } from "../utils/errors.js";
import { requestCounterService } from "../server/services/request-counter.js";

// Convert boolean parameters to SQLite-compatible values (0/1)
function toSqlParams(params: (string | number | null | boolean)[]): SqlValue[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

let db: SqlJsDatabase | null = null;
let skipDiskWrites = false;

/**
 * Control whether saveDb writes to disk. Used by test setup to prevent
 * intermittent WASM heap corruption from repeated db.export() calls.
 */
export function setSkipDiskWrites(skip: boolean): void {
  skipDiskWrites = skip;
}

/**
 * Initialize and get database instance
 */
export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const SQL = await initSqlJs();

    // Check if database file exists
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      // Create new database
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      db = new SQL.Database();
    }

    return db;
  } catch (error) {
    throw new DatabaseError("initialize", (error as Error).message);
  }
}

/**
 * Save database to disk
 */
export async function saveDb(): Promise<void> {
  if (!db) return;
  if (skipDiskWrites) return;

  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (error) {
    throw new DatabaseError("save", (error as Error).message);
  }
}

/**
 * Close database connection
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await saveDb();
    db.close();
    db = null;
  }
}

/**
 * Reload database from disk (useful when another process has written to the file)
 */
export async function reloadDb(): Promise<void> {
  const config = getConfig();
  const dbPath = config.paths.database;

  try {
    const SQL = await initSqlJs();

    // Close existing connection if any
    if (db) {
      db.close();
      db = null;
    }

    // Reload from disk
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  } catch (error) {
    throw new DatabaseError("reload", (error as Error).message);
  }
}

/**
 * Execute SQL and return results
 */
export async function query<T>(
  sql: string,
  params: (string | number | null | boolean)[] = [],
): Promise<T[]> {
  const database = await getDb();

  try {
    const result = database.exec(sql, toSqlParams(params));

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(
      (row: unknown[]) =>
        Object.fromEntries(
          columns.map((col: string, i: number) => [col, row[i]]),
        ) as T,
    );
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);
    throw new DatabaseError("query", errorMessage || "Unknown error");
  }
}

/**
 * Execute SQL without returning results
 */
export async function run(
  sql: string,
  params: (string | number | null | boolean)[] = [],
): Promise<void> {
  const database = await getDb();

  try {
    database.run(sql, toSqlParams(params));
  } catch (error) {
    throw new DatabaseError("run", (error as Error).message);
  }
}

/**
 * Execute raw SQL (for migrations)
 */
export async function exec(sql: string): Promise<void> {
  const database = await getDb();

  try {
    database.exec(sql);
  } catch (error) {
    throw new DatabaseError("exec", (error as Error).message);
  }
}

/**
 * Get single row
 */
export async function getOne<T>(
  sql: string,
  params: (string | number | null | boolean)[] = [],
): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Insert row and return ID
 */
export async function insert(
  table: string,
  data: Record<string, unknown>,
): Promise<void> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");

  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  await run(sql, values as (string | number | null | boolean)[]);
}

/**
 * Update rows
 */
export async function update(
  table: string,
  data: Record<string, unknown>,
  where: string,
  whereParams: (string | number | null | boolean)[] = [],
): Promise<void> {
  const setClause = Object.keys(data)
    .map((col) => `${col} = ?`)
    .join(", ");
  const values = Object.values(data);

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
  await run(sql, [...values, ...whereParams] as (
    | string
    | number
    | null
    | boolean
  )[]);
}

/**
 * Delete rows
 */
export async function remove(
  table: string,
  where: string,
  whereParams: (string | number | null | boolean)[] = [],
): Promise<void> {
  const sql = `DELETE FROM ${table} WHERE ${where}`;
  await run(sql, whereParams);
}

// ============================================
// Build Agent CRUD Functions
// ============================================

import { v4 as uuidv4 } from "uuid";

/**
 * Build Execution types
 */
export interface DbBuildExecution {
  id: string;
  spec_id: string;
  spec_path: string;
  status: string;
  current_task_id: string | null;
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  options_json: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface DbTaskExecution {
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
  created_at: string;
  [key: string]: unknown;
}

export interface DbBuildCheckpoint {
  id: string;
  build_id: string;
  task_id: string;
  checkpoint_type: string;
  state_json: string;
  completed_tasks: string | null;
  pending_tasks: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface DbBuildDiscovery {
  id: string;
  build_id: string;
  task_id: string | null;
  discovery_type: string;
  content: string;
  file_pattern: string | null;
  action_type: string | null;
  confidence: number;
  created_at: string;
  [key: string]: unknown;
}

// ---- Build Executions ----

/**
 * Create a new build execution
 */
export async function createBuildExecution(data: {
  specId: string;
  specPath: string;
  tasksTotal?: number;
  options?: Record<string, unknown>;
}): Promise<string> {
  const id = uuidv4();
  await insert("build_executions", {
    id,
    spec_id: data.specId,
    spec_path: data.specPath,
    status: "pending",
    tasks_total: data.tasksTotal || 0,
    tasks_completed: 0,
    tasks_failed: 0,
    options_json: data.options ? JSON.stringify(data.options) : null,
  });
  return id;
}

/**
 * Get build execution by ID
 */
export async function getBuildExecution(
  id: string,
): Promise<DbBuildExecution | null> {
  return getOne<DbBuildExecution>(
    "SELECT * FROM build_executions WHERE id = ?",
    [id],
  );
}

/**
 * List build executions
 */
export async function listBuildExecutions(options?: {
  status?: string;
  specId?: string;
  limit?: number;
}): Promise<DbBuildExecution[]> {
  let sql = "SELECT * FROM build_executions WHERE 1=1";
  const params: (string | number)[] = [];

  if (options?.status) {
    sql += " AND status = ?";
    params.push(options.status);
  }
  if (options?.specId) {
    sql += " AND spec_id = ?";
    params.push(options.specId);
  }

  sql += " ORDER BY created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    params.push(options.limit);
  }

  return query<DbBuildExecution>(sql, params);
}

/**
 * Update build execution status
 */
export async function updateBuildExecution(
  id: string,
  data: Partial<{
    status: string;
    currentTaskId: string | null;
    tasksCompleted: number;
    tasksFailed: number;
    startedAt: string;
    completedAt: string;
    errorMessage: string | null;
  }>,
): Promise<void> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.status !== undefined) updates.status = data.status;
  if (data.currentTaskId !== undefined)
    updates.current_task_id = data.currentTaskId;
  if (data.tasksCompleted !== undefined)
    updates.tasks_completed = data.tasksCompleted;
  if (data.tasksFailed !== undefined) updates.tasks_failed = data.tasksFailed;
  if (data.startedAt !== undefined) updates.started_at = data.startedAt;
  if (data.completedAt !== undefined) updates.completed_at = data.completedAt;
  if (data.errorMessage !== undefined)
    updates.error_message = data.errorMessage;

  await update("build_executions", updates, "id = ?", [id]);
}

/**
 * Delete build execution and related data
 */
export async function deleteBuildExecution(id: string): Promise<void> {
  await remove("build_executions", "id = ?", [id]);
}

// ---- Task Executions ----

/**
 * Create a new task execution
 */
export async function createTaskExecution(data: {
  buildId: string;
  taskId: string;
  phase: string;
  action: string;
  filePath: string;
  attempt?: number;
}): Promise<string> {
  const id = uuidv4();
  await insert("task_executions", {
    id,
    build_id: data.buildId,
    task_id: data.taskId,
    phase: data.phase,
    action: data.action,
    file_path: data.filePath,
    attempt: data.attempt || 1,
    status: "pending",
  });
  return id;
}

/**
 * Get task execution by ID
 */
export async function getTaskExecution(
  id: string,
): Promise<DbTaskExecution | null> {
  return getOne<DbTaskExecution>("SELECT * FROM task_executions WHERE id = ?", [
    id,
  ]);
}

/**
 * List task executions for a build
 */
export async function listTaskExecutions(
  buildId: string,
  options?: {
    status?: string;
    phase?: string;
  },
): Promise<DbTaskExecution[]> {
  let sql = "SELECT * FROM task_executions WHERE build_id = ?";
  const params: (string | number)[] = [buildId];

  if (options?.status) {
    sql += " AND status = ?";
    params.push(options.status);
  }
  if (options?.phase) {
    sql += " AND phase = ?";
    params.push(options.phase);
  }

  sql += " ORDER BY created_at ASC";
  return query<DbTaskExecution>(sql, params);
}

/**
 * Update task execution
 */
export async function updateTaskExecution(
  id: string,
  data: Partial<{
    status: string;
    startedAt: string;
    completedAt: string;
    generatedCode: string;
    validationCommand: string;
    validationOutput: string;
    validationSuccess: boolean;
    errorMessage: string | null;
    durationMs: number;
  }>,
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (data.status !== undefined) updates.status = data.status;
  if (data.startedAt !== undefined) updates.started_at = data.startedAt;
  if (data.completedAt !== undefined) updates.completed_at = data.completedAt;
  if (data.generatedCode !== undefined)
    updates.generated_code = data.generatedCode;
  if (data.validationCommand !== undefined)
    updates.validation_command = data.validationCommand;
  if (data.validationOutput !== undefined)
    updates.validation_output = data.validationOutput;
  if (data.validationSuccess !== undefined)
    updates.validation_success = data.validationSuccess ? 1 : 0;
  if (data.errorMessage !== undefined)
    updates.error_message = data.errorMessage;
  if (data.durationMs !== undefined) updates.duration_ms = data.durationMs;

  await update("task_executions", updates, "id = ?", [id]);
}

// ---- Build Checkpoints ----

/**
 * Create a checkpoint
 */
export async function createBuildCheckpoint(data: {
  buildId: string;
  taskId: string;
  checkpointType?: string;
  state: Record<string, unknown>;
  completedTasks?: string[];
  pendingTasks?: string[];
}): Promise<string> {
  const id = uuidv4();
  await insert("build_checkpoints", {
    id,
    build_id: data.buildId,
    task_id: data.taskId,
    checkpoint_type: data.checkpointType || "task_complete",
    state_json: JSON.stringify(data.state),
    completed_tasks: data.completedTasks
      ? JSON.stringify(data.completedTasks)
      : null,
    pending_tasks: data.pendingTasks ? JSON.stringify(data.pendingTasks) : null,
  });
  return id;
}

/**
 * Get latest checkpoint for a build
 */
export async function getLatestCheckpoint(
  buildId: string,
): Promise<DbBuildCheckpoint | null> {
  return getOne<DbBuildCheckpoint>(
    "SELECT * FROM build_checkpoints WHERE build_id = ? ORDER BY created_at DESC LIMIT 1",
    [buildId],
  );
}

/**
 * List checkpoints for a build
 */
export async function listBuildCheckpoints(
  buildId: string,
): Promise<DbBuildCheckpoint[]> {
  return query<DbBuildCheckpoint>(
    "SELECT * FROM build_checkpoints WHERE build_id = ? ORDER BY created_at DESC",
    [buildId],
  );
}

/**
 * Delete old checkpoints (keep last N)
 */
export async function cleanupBuildCheckpoints(
  buildId: string,
  keepLast: number = 5,
): Promise<void> {
  await run(
    `
    DELETE FROM build_checkpoints
    WHERE build_id = ?
    AND id NOT IN (
      SELECT id FROM build_checkpoints
      WHERE build_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
  `,
    [buildId, buildId, keepLast],
  );
}

// ---- Build Discoveries ----

/**
 * Record a discovery (gotcha, pattern, or decision)
 */
export async function createBuildDiscovery(data: {
  buildId: string;
  taskId?: string;
  discoveryType: "gotcha" | "pattern" | "decision";
  content: string;
  filePattern?: string;
  actionType?: string;
  confidence?: number;
}): Promise<string> {
  const id = uuidv4();
  await insert("build_discoveries", {
    id,
    build_id: data.buildId,
    task_id: data.taskId || null,
    discovery_type: data.discoveryType,
    content: data.content,
    file_pattern: data.filePattern || null,
    action_type: data.actionType || null,
    confidence: data.confidence || 0.5,
  });
  return id;
}

/**
 * List discoveries for a build
 */
export async function listBuildDiscoveries(
  buildId: string,
  options?: {
    type?: string;
  },
): Promise<DbBuildDiscovery[]> {
  let sql = "SELECT * FROM build_discoveries WHERE build_id = ?";
  const params: (string | number)[] = [buildId];

  if (options?.type) {
    sql += " AND discovery_type = ?";
    params.push(options.type);
  }

  sql += " ORDER BY created_at DESC";
  return query<DbBuildDiscovery>(sql, params);
}

/**
 * Get all gotchas matching a file pattern
 */
export async function getGotchasForFile(
  filePattern: string,
): Promise<DbBuildDiscovery[]> {
  return query<DbBuildDiscovery>(
    `SELECT * FROM build_discoveries
     WHERE discovery_type = 'gotcha'
     AND (file_pattern IS NULL OR ? LIKE '%' || file_pattern || '%')
     ORDER BY confidence DESC`,
    [filePattern],
  );
}

// ============================================
// API Call Statistics Functions
// ============================================

import {
  CallStats,
  StatsSummary,
  CallStatsFilters,
} from "../types/api-stats.js";

/**
 * Record an API call (fire-and-forget, doesn't throw)
 */
export function recordApiCall(
  userId: string | null,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
): void {
  try {
    if (!db) return;
    db.run(
      `INSERT INTO api_calls (user_id, endpoint, method, status_code, response_time_ms)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, endpoint, method, statusCode, responseTimeMs],
    );
  } catch (error) {
    console.error("Failed to record API call:", error);
  }
}

/**
 * Get aggregated call statistics
 */
export async function getCallStats(
  filters: CallStatsFilters = {},
): Promise<CallStats[]> {
  let sql = `
    SELECT endpoint, method, COUNT(*) as count, AVG(response_time_ms) as avgResponseTime
    FROM api_calls
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (filters.endpoint) {
    sql += " AND endpoint = ?";
    params.push(filters.endpoint);
  }
  if (filters.from) {
    sql += " AND created_at >= ?";
    params.push(filters.from);
  }
  if (filters.to) {
    sql += " AND created_at <= ?";
    params.push(filters.to);
  }

  sql += " GROUP BY endpoint, method ORDER BY count DESC";

  const results = await query<{
    endpoint: string;
    method: string;
    count: number;
    avgResponseTime: number;
  }>(sql, params);
  return results.map((r) => ({
    endpoint: r.endpoint,
    method: r.method,
    count: Number(r.count),
    avgResponseTime: Math.round(Number(r.avgResponseTime)),
  }));
}

/**
 * Get summary statistics for the last 24 hours
 */
export async function getStatsSummary(): Promise<StatsSummary> {
  const result = await getOne<{
    totalCalls: number;
    uniqueEndpoints: number;
    avgResponseTime: number;
  }>(
    `SELECT
      COUNT(*) as totalCalls,
      COUNT(DISTINCT endpoint) as uniqueEndpoints,
      AVG(response_time_ms) as avgResponseTime
    FROM api_calls
    WHERE created_at >= datetime('now', '-1 day')`,
  );

  return {
    totalCalls: Number(result?.totalCalls || 0),
    uniqueEndpoints: Number(result?.uniqueEndpoints || 0),
    avgResponseTime: Math.round(Number(result?.avgResponseTime || 0)),
    period: "last_24h",
    requestCount: requestCounterService.getCount(),
  };
}

/**
 * Get total call count with optional filters
 * When no filters are provided, returns the in-memory request counter (total since startup)
 */
export async function getCallCount(
  filters: CallStatsFilters = {},
): Promise<number> {
  // If no filters are provided, return the in-memory request counter
  if (!filters.endpoint && !filters.from && !filters.to) {
    return requestCounterService.getCount();
  }

  let sql = "SELECT COUNT(*) as count FROM api_calls WHERE 1=1";
  const params: (string | number)[] = [];

  if (filters.endpoint) {
    sql += " AND endpoint = ?";
    params.push(filters.endpoint);
  }
  if (filters.from) {
    sql += " AND created_at >= ?";
    params.push(filters.from);
  }
  if (filters.to) {
    sql += " AND created_at <= ?";
    params.push(filters.to);
  }

  const result = await getOne<{ count: number }>(sql, params);
  return Number(result?.count || 0);
}

// ============================================
// User Profile Functions
// ============================================

import {
  UserProfile,
  ProfileUpdateInput,
  UserPreferences,
  PreferencesUpdateInput,
  PublicProfile,
} from "../types/profile.js";

function mapProfileRow(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    displayName: row.display_name as string | null,
    bio: row.bio as string | null,
    location: row.location as string | null,
    website: row.website as string | null,
    avatarPath: row.avatar_path as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPreferencesRow(row: Record<string, unknown>): UserPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    theme: row.theme as "light" | "dark" | "system",
    language: row.language as string,
    timezone: row.timezone as string,
    emailNotifications: !!row.email_notifications,
    pushNotifications: !!row.push_notifications,
    weeklyDigest: !!row.weekly_digest,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * Get user profile
 */
export async function getUserProfile(
  userId: string,
): Promise<UserProfile | null> {
  const row = await getOne<Record<string, unknown>>(
    "SELECT * FROM account_profiles WHERE user_id = ?",
    [userId],
  );
  if (!row) return null;
  return mapProfileRow(row);
}

/**
 * Get or create user profile
 */
export async function getOrCreateProfile(userId: string): Promise<UserProfile> {
  let profile = await getUserProfile(userId);
  if (!profile) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO account_profiles (id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [id, userId, now, now],
    );
    profile = await getUserProfile(userId);
    if (!profile) throw new Error("Failed to create profile");
  }
  return profile;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  input: ProfileUpdateInput,
): Promise<UserProfile> {
  const profile = await getOrCreateProfile(userId);
  const now = new Date().toISOString();
  await run(
    `UPDATE account_profiles
     SET display_name = ?, bio = ?, location = ?, website = ?, updated_at = ?
     WHERE user_id = ?`,
    [
      input.displayName ?? profile.displayName,
      input.bio ?? profile.bio,
      input.location ?? profile.location,
      input.website ?? profile.website,
      now,
      userId,
    ],
  );
  const updated = await getUserProfile(userId);
  if (!updated) throw new Error("Failed to update profile");
  return updated;
}

/**
 * Update avatar path
 */
export async function updateAvatarPath(
  userId: string,
  avatarPath: string | null,
): Promise<void> {
  await run(
    "UPDATE account_profiles SET avatar_path = ?, updated_at = ? WHERE user_id = ?",
    [avatarPath, new Date().toISOString(), userId],
  );
}

/**
 * Get public profile
 */
export async function getPublicProfile(
  userId: string,
): Promise<PublicProfile | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarPath: profile.avatarPath,
  };
}

/**
 * Get user preferences
 */
export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences | null> {
  const row = await getOne<Record<string, unknown>>(
    "SELECT * FROM account_preferences WHERE user_id = ?",
    [userId],
  );
  if (!row) return null;
  return mapPreferencesRow(row);
}

/**
 * Get or create user preferences
 */
export async function getOrCreatePreferences(
  userId: string,
): Promise<UserPreferences> {
  let prefs = await getUserPreferences(userId);
  if (!prefs) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await run(
      `INSERT INTO account_preferences (id, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [id, userId, now, now],
    );
    prefs = await getUserPreferences(userId);
    if (!prefs) throw new Error("Failed to create preferences");
  }
  return prefs;
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  input: PreferencesUpdateInput,
): Promise<UserPreferences> {
  const prefs = await getOrCreatePreferences(userId);
  const now = new Date().toISOString();
  await run(
    `UPDATE account_preferences
     SET theme = ?, language = ?, timezone = ?,
         email_notifications = ?, push_notifications = ?, weekly_digest = ?,
         updated_at = ?
     WHERE user_id = ?`,
    [
      input.theme ?? prefs.theme,
      input.language ?? prefs.language,
      input.timezone ?? prefs.timezone,
      input.emailNotifications !== undefined
        ? input.emailNotifications
          ? 1
          : 0
        : prefs.emailNotifications
          ? 1
          : 0,
      input.pushNotifications !== undefined
        ? input.pushNotifications
          ? 1
          : 0
        : prefs.pushNotifications
          ? 1
          : 0,
      input.weeklyDigest !== undefined
        ? input.weeklyDigest
          ? 1
          : 0
        : prefs.weeklyDigest
          ? 1
          : 0,
      now,
      userId,
    ],
  );
  const updated = await getUserPreferences(userId);
  if (!updated) throw new Error("Failed to update preferences");
  return updated;
}

// ============================================
// Notification Functions
// ============================================

import {
  Notification,
  DbNotification,
  NotificationDelivery,
  DbNotificationDelivery,
  NotificationTemplate,
  DbNotificationTemplate,
  ChannelPreference,
  DbChannelPreference,
  CreateNotificationInput,
  NotificationListFilters,
  NotificationChannel,
  NotificationCategory,
} from "../types/notification.js";

/**
 * Map database row to Notification object
 */
function mapNotificationRow(row: DbNotification): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category as NotificationCategory,
    title: row.title,
    body: row.body,
    data: row.data ? JSON.parse(row.data) : null,
    priority: row.priority as Notification["priority"],
    readAt: row.read_at,
    archivedAt: row.archived_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to NotificationDelivery object
 */
function mapDeliveryRow(row: DbNotificationDelivery): NotificationDelivery {
  return {
    id: row.id,
    notificationId: row.notification_id,
    channel: row.channel as NotificationChannel,
    status: row.status as NotificationDelivery["status"],
    error: row.error,
    retryCount: row.retry_count,
    nextRetryAt: row.next_retry_at,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
  };
}

/**
 * Map database row to NotificationTemplate object
 */
function mapTemplateRow(row: DbNotificationTemplate): NotificationTemplate {
  return {
    id: row.id,
    type: row.type,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    emailSubject: row.email_subject,
    emailBody: row.email_body,
    telegramText: row.telegram_text,
    defaultChannels: JSON.parse(row.default_channels) as NotificationChannel[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map database row to ChannelPreference object
 */
function mapChannelPrefRow(row: DbChannelPreference): ChannelPreference {
  return {
    id: row.id,
    userId: row.user_id,
    notificationType: row.notification_type,
    channels: JSON.parse(row.channels) as NotificationChannel[],
    mutedUntil: row.muted_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new notification
 */
export async function createNotification(
  input: CreateNotificationInput & {
    title: string;
    body: string;
    category: NotificationCategory;
  },
): Promise<Notification> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO user_notifications (id, user_id, type, category, title, body, data, priority, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.type,
      input.category,
      input.title,
      input.body,
      input.data ? JSON.stringify(input.data) : null,
      input.priority || "normal",
      input.expiresAt || null,
      now,
    ],
  );

  const notification = await getNotificationById(id);
  if (!notification) throw new Error("Failed to create notification");
  return notification;
}

/**
 * Get notification by ID
 */
export async function getNotificationById(
  id: string,
): Promise<Notification | null> {
  const row = await getOne<DbNotification>(
    "SELECT * FROM user_notifications WHERE id = ?",
    [id],
  );
  if (!row) return null;
  return mapNotificationRow(row);
}

/**
 * Get notifications for a user with filters
 */
export async function getNotifications(
  userId: string,
  filters: NotificationListFilters = {},
): Promise<Notification[]> {
  const {
    limit = 20,
    offset = 0,
    unreadOnly = false,
    category,
    type,
  } = filters;

  let sql =
    "SELECT * FROM user_notifications WHERE user_id = ? AND archived_at IS NULL";
  const params: (string | number)[] = [userId];

  if (unreadOnly) {
    sql += " AND read_at IS NULL";
  }

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = await query<DbNotification>(sql, params);
  return rows.map(mapNotificationRow);
}

/**
 * Get total notification count for a user
 */
export async function getNotificationCount(
  userId: string,
  filters: { unreadOnly?: boolean; category?: string; type?: string } = {},
): Promise<number> {
  let sql =
    "SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ? AND archived_at IS NULL";
  const params: (string | number)[] = [userId];

  if (filters.unreadOnly) {
    sql += " AND read_at IS NULL";
  }

  if (filters.category) {
    sql += " AND category = ?";
    params.push(filters.category);
  }

  if (filters.type) {
    sql += " AND type = ?";
    params.push(filters.type);
  }

  const result = await getOne<{ count: number }>(sql, params);
  return Number(result?.count || 0);
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM user_notifications WHERE user_id = ? AND read_at IS NULL AND archived_at IS NULL",
    [userId],
  );
  return Number(result?.count || 0);
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(
  id: string,
): Promise<Notification | null> {
  const now = new Date().toISOString();
  await run(
    "UPDATE user_notifications SET read_at = ? WHERE id = ? AND read_at IS NULL",
    [now, id],
  );
  return getNotificationById(id);
}

/**
 * Mark notification as archived
 */
export async function markNotificationArchived(
  id: string,
): Promise<Notification | null> {
  const now = new Date().toISOString();
  await run("UPDATE user_notifications SET archived_at = ? WHERE id = ?", [
    now,
    id,
  ]);
  return getNotificationById(id);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(
  userId: string,
): Promise<number> {
  const now = new Date().toISOString();
  const countBefore = await getUnreadCount(userId);
  await run(
    "UPDATE user_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
    [now, userId],
  );
  return countBefore;
}

/**
 * Delete old/expired notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const now = new Date().toISOString();
  const countResult = await getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM user_notifications WHERE expires_at IS NOT NULL AND expires_at < ?",
    [now],
  );
  const count = Number(countResult?.count || 0);

  if (count > 0) {
    await run(
      "DELETE FROM user_notifications WHERE expires_at IS NOT NULL AND expires_at < ?",
      [now],
    );
  }

  return count;
}

// ---- Notification Deliveries ----

/**
 * Create a delivery record
 */
export async function createDelivery(
  notificationId: string,
  channel: NotificationChannel,
): Promise<NotificationDelivery> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await run(
    `INSERT INTO user_notification_deliveries (id, notification_id, channel, status, created_at)
     VALUES (?, ?, ?, 'pending', ?)`,
    [id, notificationId, channel, now],
  );

  const delivery = await getDeliveryById(id);
  if (!delivery) throw new Error("Failed to create delivery");
  return delivery;
}

/**
 * Get delivery by ID
 */
export async function getDeliveryById(
  id: string,
): Promise<NotificationDelivery | null> {
  const row = await getOne<DbNotificationDelivery>(
    "SELECT * FROM user_notification_deliveries WHERE id = ?",
    [id],
  );
  if (!row) return null;
  return mapDeliveryRow(row);
}

/**
 * Update delivery status
 */
export async function updateDeliveryStatus(
  id: string,
  status: NotificationDelivery["status"],
  error?: string,
): Promise<void> {
  const now = new Date().toISOString();

  let sql = "UPDATE user_notification_deliveries SET status = ?";
  const params: (string | null)[] = [status];

  if (status === "sent") {
    sql += ", sent_at = ?";
    params.push(now);
  } else if (status === "delivered") {
    sql += ", delivered_at = ?";
    params.push(now);
  }

  if (error !== undefined) {
    sql += ", error = ?";
    params.push(error);
  }

  sql += " WHERE id = ?";
  params.push(id);

  await run(sql, params);
}

/**
 * Get failed deliveries due for retry
 */
export async function getFailedDeliveries(): Promise<NotificationDelivery[]> {
  const now = new Date().toISOString();
  const rows = await query<DbNotificationDelivery>(
    `SELECT * FROM user_notification_deliveries
     WHERE status = 'failed'
       AND retry_count < 4
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY next_retry_at ASC
     LIMIT 100`,
    [now],
  );
  return rows.map(mapDeliveryRow);
}

/**
 * Mark delivery for retry with exponential backoff
 */
export async function markDeliveryForRetry(
  id: string,
  nextRetryAt: string,
): Promise<void> {
  await run(
    `UPDATE user_notification_deliveries
     SET retry_count = retry_count + 1, next_retry_at = ?
     WHERE id = ?`,
    [nextRetryAt, id],
  );
}

// ---- Notification Templates ----

/**
 * Get template by type
 */
export async function getTemplate(
  type: string,
): Promise<NotificationTemplate | null> {
  const row = await getOne<DbNotificationTemplate>(
    "SELECT * FROM notification_templates WHERE type = ?",
    [type],
  );
  if (!row) return null;
  return mapTemplateRow(row);
}

/**
 * Get all templates
 */
export async function getAllTemplates(): Promise<NotificationTemplate[]> {
  const rows = await query<DbNotificationTemplate>(
    "SELECT * FROM notification_templates ORDER BY type",
  );
  return rows.map(mapTemplateRow);
}

// ---- Channel Preferences ----

/**
 * Get user's channel preference for a notification type
 */
export async function getUserChannelPref(
  userId: string,
  notificationType: string,
): Promise<ChannelPreference | null> {
  const row = await getOne<DbChannelPreference>(
    "SELECT * FROM notification_channel_prefs WHERE user_id = ? AND notification_type = ?",
    [userId, notificationType],
  );
  if (!row) return null;
  return mapChannelPrefRow(row);
}

/**
 * Get all channel preferences for a user
 */
export async function getAllUserChannelPrefs(
  userId: string,
): Promise<ChannelPreference[]> {
  const rows = await query<DbChannelPreference>(
    "SELECT * FROM notification_channel_prefs WHERE user_id = ? ORDER BY notification_type",
    [userId],
  );
  return rows.map(mapChannelPrefRow);
}

/**
 * Set user's channel preference for a notification type
 */
export async function setUserChannelPrefs(
  userId: string,
  notificationType: string,
  channels: NotificationChannel[],
  mutedUntil?: string,
): Promise<ChannelPreference> {
  const existing = await getUserChannelPref(userId, notificationType);
  const now = new Date().toISOString();

  if (existing) {
    await run(
      `UPDATE notification_channel_prefs
       SET channels = ?, muted_until = ?, updated_at = ?
       WHERE user_id = ? AND notification_type = ?`,
      [
        JSON.stringify(channels),
        mutedUntil || null,
        now,
        userId,
        notificationType,
      ],
    );
  } else {
    const id = uuidv4();
    await run(
      `INSERT INTO notification_channel_prefs (id, user_id, notification_type, channels, muted_until, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        notificationType,
        JSON.stringify(channels),
        mutedUntil || null,
        now,
        now,
      ],
    );
  }

  const pref = await getUserChannelPref(userId, notificationType);
  if (!pref) throw new Error("Failed to set channel preference");
  return pref;
}

/**
 * Get effective channels for a user and notification type
 * Considers user preferences, muting, and template defaults
 */
export async function getEffectiveChannels(
  userId: string,
  type: string,
): Promise<NotificationChannel[]> {
  const pref = await getUserChannelPref(userId, type);

  if (pref) {
    // Check if muted
    if (pref.mutedUntil && new Date(pref.mutedUntil) > new Date()) {
      return [];
    }
    return pref.channels;
  }

  // Fall back to template defaults
  const template = await getTemplate(type);
  return template?.defaultChannels || ["in_app"];
}

/**
 * Get user's email address (placeholder - would come from user table)
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  // In a real implementation, this would query the users table
  const row = await getOne<{ email: string }>(
    "SELECT email FROM users WHERE id = ?",
    [userId],
  );
  return row?.email || null;
}

/**
 * Get user's Telegram chat ID (placeholder - would come from user settings)
 */
export async function getUserTelegram(userId: string): Promise<string | null> {
  // In a real implementation, this would query user settings
  const row = await getOne<{ telegram_chat_id: string }>(
    "SELECT telegram_chat_id FROM user_integrations WHERE user_id = ? AND provider = ?",
    [userId, "telegram"],
  );
  return row?.telegram_chat_id || null;
}

// Export types
export type { SqlJsDatabase };
