/**
 * Pipeline API Routes
 *
 * REST API for the Pipeline Dashboard - visualizing parallel execution lanes,
 * waves, agents, and conflicts.
 *
 * Routes:
 * - GET /api/pipeline/status - Get overall pipeline status
 * - GET /api/pipeline/lanes - Get all lanes for current session
 * - GET /api/pipeline/lanes/:laneId - Get lane details
 * - GET /api/pipeline/waves - Get all waves for current session
 * - GET /api/pipeline/waves/:waveNumber - Get specific wave details
 * - GET /api/pipeline/conflicts - Get all conflicts
 * - GET /api/pipeline/events - Get recent pipeline events
 * - POST /api/pipeline/lanes - Create a new lane
 * - POST /api/pipeline/lanes/:laneId/tasks - Assign task to lane
 *
 * Reference: docs/specs/ui/PARALLELIZATION-UI-PLAN.md
 */

import { Router, Request, Response } from "express";
import { query, getOne, run } from "../../database/db.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// ====================
// Type Definitions
// ====================

export interface Lane {
  id: string;
  sessionId: string;
  name: string;
  category: string;
  filePatterns: string[];
  status: "idle" | "active" | "blocked" | "complete";
  blockReason?: string;
  currentAgentId?: string;
  tasksTotal: number;
  tasksCompleted: number;
  tasks: LaneTask[];
}

export interface LaneTask {
  id: string;
  taskId: string;
  displayId?: string;
  title: string;
  waveNumber: number;
  positionInWave: number;
  status: "pending" | "running" | "complete" | "failed" | "blocked" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  blockReason?: string;
  blockingTaskId?: string;
  agentId?: string;
  agentName?: string;
}

export interface Wave {
  id: string;
  sessionId: string;
  waveNumber: number;
  status: "pending" | "active" | "complete";
  tasksTotal: number;
  tasksCompleted: number;
  tasksRunning: number;
  tasksFailed: number;
  tasksBlocked: number;
  maxParallelism: number;
  actualParallelism: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export interface Conflict {
  id: string;
  sessionId: string;
  taskAId: string;
  taskADisplayId?: string;
  taskATitle?: string;
  taskBId: string;
  taskBDisplayId?: string;
  taskBTitle?: string;
  conflictType: "file_conflict" | "dependency" | "resource_lock";
  details: string;
  filePath?: string;
  operationA?: string;
  operationB?: string;
  resolvedAt?: string;
}

export interface PipelineStatus {
  sessionId: string;
  status: "idle" | "running" | "paused" | "complete";
  lanes: Lane[];
  waves: Wave[];
  activeWaveNumber: number;
  agents: AgentStatus[];
  conflicts: Conflict[];
  totalTasks: number;
  completedTasks: number;
  percentComplete: number;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: "idle" | "working" | "error";
  currentTaskId?: string;
  currentTaskTitle?: string;
  laneId?: string;
  heartbeatAt?: string;
  heartbeatAgeSeconds: number;
}

export interface PipelineEvent {
  id: string;
  sessionId: string;
  timestamp: string;
  eventType: string;
  payload: Record<string, unknown>;
}

// Filter option types for dropdowns
export interface ProjectOption {
  projectId: string;
  projectName: string;
  projectCode: string;
  taskCount: number;
}

export interface TaskListOption {
  id: string;
  name: string;
  projectId: string | null;
  taskCount: number;
  status: string;
}

// ====================
// Database Row Types
// ====================

interface LaneRow {
  id: string;
  session_id: string;
  name: string;
  category: string;
  file_patterns: string | null;
  status: string;
  block_reason: string | null;
  current_agent_id: string | null;
  tasks_total: number;
  tasks_completed: number;
  created_at: string;
  updated_at: string;
}

interface LaneTaskRow {
  id: string;
  lane_id: string;
  task_id: string;
  wave_number: number;
  position_in_wave: number;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  block_reason: string | null;
  blocking_task_id: string | null;
  agent_id: string | null;
  display_id: string | null;
  title: string;
  agent_name: string | null;
}

interface WaveRow {
  id: string;
  session_id: string;
  wave_number: number;
  status: string;
  tasks_total: number;
  tasks_completed: number;
  tasks_running: number;
  tasks_failed: number;
  tasks_blocked: number;
  max_parallelism: number;
  actual_parallelism: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface ConflictRow {
  id: string;
  session_id: string;
  task_a_id: string;
  task_b_id: string;
  conflict_type: string;
  details: string;
  file_path: string | null;
  operation_a: string | null;
  operation_b: string | null;
  resolved_at: string | null;
  created_at: string;
  task_a_display_id: string | null;
  task_a_title: string | null;
  task_b_display_id: string | null;
  task_b_title: string | null;
}

interface AgentRow {
  id: string;
  name: string;
  status: string;
  current_task_id: string | null;
  current_task_title: string | null;
  lane_id: string | null;
  last_heartbeat: string | null;
}

interface EventRow {
  id: string;
  session_id: string;
  timestamp: string;
  event_type: string;
  payload: string;
  created_at: string;
}

interface SessionRow {
  id: string;
  status: string;
}

// ====================
// Helper Functions
// ====================

function parseJsonSafe<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * Get the current active execution session
 */
async function getActiveSession(): Promise<SessionRow | null> {
  // Try to get running session first
  let session = await getOne<SessionRow>(
    `SELECT id, status FROM task_list_execution_runs
     WHERE status IN ('running', 'paused')
     ORDER BY started_at DESC LIMIT 1`,
  );

  // If no active session, get the most recent one
  if (!session) {
    session = await getOne<SessionRow>(
      `SELECT id, status FROM task_list_execution_runs
       ORDER BY started_at DESC LIMIT 1`,
    );
  }

  return session;
}

/**
 * Convert a lane database row to API format
 */
function mapLaneRow(row: LaneRow, tasks: LaneTask[]): Lane {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    category: row.category,
    filePatterns: parseJsonSafe(row.file_patterns, []),
    status: row.status as Lane["status"],
    blockReason: row.block_reason ?? undefined,
    currentAgentId: row.current_agent_id ?? undefined,
    tasksTotal: row.tasks_total,
    tasksCompleted: row.tasks_completed,
    tasks,
  };
}

/**
 * Convert a wave database row to API format
 */
function mapWaveRow(row: WaveRow): Wave {
  return {
    id: row.id,
    sessionId: row.session_id,
    waveNumber: row.wave_number,
    status: row.status as Wave["status"],
    tasksTotal: row.tasks_total,
    tasksCompleted: row.tasks_completed,
    tasksRunning: row.tasks_running,
    tasksFailed: row.tasks_failed,
    tasksBlocked: row.tasks_blocked,
    maxParallelism: row.max_parallelism,
    actualParallelism: row.actual_parallelism,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    durationMs: row.duration_ms ?? undefined,
  };
}

/**
 * Convert a conflict database row to API format
 */
function mapConflictRow(row: ConflictRow): Conflict {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskAId: row.task_a_id,
    taskADisplayId: row.task_a_display_id ?? undefined,
    taskATitle: row.task_a_title ?? undefined,
    taskBId: row.task_b_id,
    taskBDisplayId: row.task_b_display_id ?? undefined,
    taskBTitle: row.task_b_title ?? undefined,
    conflictType: row.conflict_type as Conflict["conflictType"],
    details: row.details,
    filePath: row.file_path ?? undefined,
    operationA: row.operation_a ?? undefined,
    operationB: row.operation_b ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

// ====================
// Build Pipeline from Task Data (when no active execution)
// ====================

interface TaskDataRow {
  id: string;
  display_id: string | null;
  title: string;
  status: string;
  phase: number | null;
  category: string | null;
  task_list_id: string | null;
  task_list_name: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface FileImpactRow {
  task_id: string;
  file_path: string;
  operation: string;
}

/**
 * Build pipeline visualization from existing task data
 * Used when no active execution session exists
 */
async function buildPipelineFromTaskData(
  taskListId?: string,
  projectId?: string,
): Promise<PipelineStatus> {
  // Get tasks, optionally filtered by task list and/or project
  let taskSql = `
    SELECT t.id, t.display_id, t.title, t.status, t.phase, t.category,
           t.task_list_id, tl.name as task_list_name,
           t.created_at, t.started_at, t.completed_at
    FROM tasks t
    LEFT JOIN task_lists_v2 tl ON t.task_list_id = tl.id
    WHERE t.phase IS NOT NULL
  `;
  const params: string[] = [];

  if (taskListId) {
    taskSql += ` AND t.task_list_id = ?`;
    params.push(taskListId);
  }

  if (projectId && projectId !== "all") {
    if (projectId === "unassigned") {
      taskSql += ` AND COALESCE(t.project_id, tl.project_id) IS NULL`;
    } else {
      taskSql += ` AND (t.project_id = ? OR tl.project_id = ?)`;
      params.push(projectId, projectId);
    }
  }

  taskSql += ` ORDER BY t.phase, t.category, t.created_at`;

  const taskRows = await query<TaskDataRow>(taskSql, params);

  if (taskRows.length === 0) {
    return {
      sessionId: "preview",
      status: "idle",
      lanes: [],
      waves: [],
      activeWaveNumber: 0,
      agents: [],
      conflicts: [],
      totalTasks: 0,
      completedTasks: 0,
      percentComplete: 0,
    };
  }

  // Get file impacts for conflict detection
  const fileImpacts = await query<FileImpactRow>(
    `SELECT task_id, file_path, operation FROM task_file_impacts`,
  );

  // Build file impact map
  const taskFileMap = new Map<string, { path: string; op: string }[]>();
  for (const impact of fileImpacts) {
    if (!taskFileMap.has(impact.task_id)) {
      taskFileMap.set(impact.task_id, []);
    }
    taskFileMap.get(impact.task_id)!.push({
      path: impact.file_path,
      op: impact.operation,
    });
  }

  // Group tasks by category (for lanes) and phase (for waves)
  const categoryTasks = new Map<string, TaskDataRow[]>();
  const phaseNumbers = new Set<number>();

  for (const task of taskRows) {
    const category = task.category || task.task_list_name || "general";
    if (!categoryTasks.has(category)) {
      categoryTasks.set(category, []);
    }
    categoryTasks.get(category)!.push(task);
    phaseNumbers.add(task.phase || 1);
  }

  // Build lanes
  const lanes: Lane[] = [];
  let laneIndex = 0;
  for (const [category, tasks] of categoryTasks) {
    const laneTasks: LaneTask[] = tasks.map((t, i) => ({
      id: `lt-${t.id}`,
      taskId: t.id,
      displayId: t.display_id || undefined,
      title: t.title,
      waveNumber: t.phase || 1,
      positionInWave: i,
      status: mapTaskStatus(t.status),
      startedAt: t.started_at || undefined,
      completedAt: t.completed_at || undefined,
      durationMs:
        t.started_at && t.completed_at
          ? new Date(t.completed_at).getTime() -
            new Date(t.started_at).getTime()
          : undefined,
    }));

    const completedCount = laneTasks.filter(
      (t) => t.status === "complete",
    ).length;
    const hasBlocked = laneTasks.some((t) => t.status === "blocked");
    const hasRunning = laneTasks.some((t) => t.status === "running");

    // Determine file patterns from file impacts
    const filePatterns = new Set<string>();
    for (const task of tasks) {
      const impacts = taskFileMap.get(task.id) || [];
      for (const impact of impacts) {
        // Extract directory pattern
        const dir = impact.path.split("/").slice(0, -1).join("/") + "/*";
        filePatterns.add(dir);
      }
    }

    lanes.push({
      id: `lane-${laneIndex++}`,
      sessionId: "preview",
      name: formatCategoryName(category),
      category: mapCategoryToLaneType(category),
      filePatterns: Array.from(filePatterns).slice(0, 5),
      status:
        completedCount === laneTasks.length
          ? "complete"
          : hasBlocked
            ? "blocked"
            : hasRunning
              ? "active"
              : "idle",
      tasksTotal: laneTasks.length,
      tasksCompleted: completedCount,
      tasks: laneTasks,
    });
  }

  // Build waves
  const sortedPhases = Array.from(phaseNumbers).sort((a, b) => a - b);
  const waves: Wave[] = sortedPhases.map((phaseNum) => {
    const phaseTasks = taskRows.filter((t) => (t.phase || 1) === phaseNum);
    const completedCount = phaseTasks.filter(
      (t) => t.status === "completed" || t.status === "complete",
    ).length;
    const runningCount = phaseTasks.filter(
      (t) => t.status === "in_progress" || t.status === "running",
    ).length;
    const failedCount = phaseTasks.filter((t) => t.status === "failed").length;
    const blockedCount = phaseTasks.filter(
      (t) => t.status === "blocked",
    ).length;

    const allComplete = completedCount === phaseTasks.length;
    const hasRunning = runningCount > 0;

    return {
      id: `wave-${phaseNum}`,
      sessionId: "preview",
      waveNumber: phaseNum,
      status: allComplete ? "complete" : hasRunning ? "active" : "pending",
      tasksTotal: phaseTasks.length,
      tasksCompleted: completedCount,
      tasksRunning: runningCount,
      tasksFailed: failedCount,
      tasksBlocked: blockedCount,
      maxParallelism: Math.min(phaseTasks.length, 6),
      actualParallelism: runningCount,
    };
  });

  // Find active wave
  const activeWave = waves.find((w) => w.status === "active");
  const activeWaveNumber = activeWave?.waveNumber ?? (waves.length > 0 ? 1 : 0);

  // Detect conflicts from file impacts
  const conflicts: Conflict[] = [];
  const taskIds = taskRows.map((t) => t.id);
  for (let i = 0; i < taskIds.length; i++) {
    for (let j = i + 1; j < taskIds.length; j++) {
      const taskA = taskRows[i];
      const taskB = taskRows[j];
      const impactsA = taskFileMap.get(taskA.id) || [];
      const impactsB = taskFileMap.get(taskB.id) || [];

      // Check for conflicting operations on same file
      for (const ia of impactsA) {
        for (const ib of impactsB) {
          if (ia.path === ib.path && isConflictingOps(ia.op, ib.op)) {
            conflicts.push({
              id: `conflict-${conflicts.length}`,
              sessionId: "preview",
              taskAId: taskA.id,
              taskADisplayId: taskA.display_id || undefined,
              taskATitle: taskA.title,
              taskBId: taskB.id,
              taskBDisplayId: taskB.display_id || undefined,
              taskBTitle: taskB.title,
              conflictType: "file_conflict",
              details: `Both tasks ${ia.op} ${ib.op} ${ia.path}`,
              filePath: ia.path,
              operationA: ia.op,
              operationB: ib.op,
            });
          }
        }
      }
    }
  }

  // Calculate totals
  const totalTasks = taskRows.length;
  const completedTasks = taskRows.filter(
    (t) => t.status === "completed" || t.status === "complete",
  ).length;
  const runningTasks = taskRows.filter(
    (t) => t.status === "in_progress" || t.status === "running",
  ).length;
  const percentComplete =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Determine overall status: complete > running > idle
  let overallStatus: "idle" | "running" | "paused" | "complete" = "idle";
  if (totalTasks > 0 && completedTasks === totalTasks) {
    overallStatus = "complete";
  } else if (runningTasks > 0) {
    overallStatus = "running";
  }

  return {
    sessionId: "preview",
    status: overallStatus,
    lanes,
    waves,
    activeWaveNumber,
    agents: [],
    conflicts,
    totalTasks,
    completedTasks,
    percentComplete,
  };
}

/**
 * Map task status to LaneTask status
 */
function mapTaskStatus(status: string): LaneTask["status"] {
  switch (status) {
    case "completed":
    case "complete":
      return "complete";
    case "in_progress":
    case "running":
      return "running";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
    case "skipped":
      return "skipped";
    default:
      return "pending";
  }
}

/**
 * Format category name for display
 */
function formatCategoryName(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Map category to lane type
 */
function mapCategoryToLaneType(category: string): string {
  const lower = category.toLowerCase();
  if (
    lower.includes("database") ||
    lower.includes("db") ||
    lower.includes("migration")
  ) {
    return "database";
  }
  if (lower.includes("type") || lower.includes("interface")) {
    return "types";
  }
  if (
    lower.includes("api") ||
    lower.includes("route") ||
    lower.includes("server")
  ) {
    return "api";
  }
  if (
    lower.includes("ui") ||
    lower.includes("frontend") ||
    lower.includes("component")
  ) {
    return "ui";
  }
  if (lower.includes("test")) {
    return "tests";
  }
  if (
    lower.includes("infra") ||
    lower.includes("config") ||
    lower.includes("build")
  ) {
    return "infrastructure";
  }
  return "general";
}

/**
 * Check if two file operations conflict
 */
function isConflictingOps(opA: string, opB: string): boolean {
  // READ operations don't conflict with each other
  if (opA === "READ" && opB === "READ") return false;
  // Any write operation conflicts with any other write
  const writeOps = ["CREATE", "UPDATE", "DELETE"];
  return writeOps.includes(opA) || writeOps.includes(opB);
}

// ====================
// Routes
// ====================

/**
 * GET /api/pipeline/status
 * Get overall pipeline status including lanes, waves, agents, and conflicts
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const taskListId = req.query.taskListId as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const session = await getActiveSession();

    if (!session) {
      // No active execution session - build visualization from task data
      return res.json(await buildPipelineFromTaskData(taskListId, projectId));
    }

    // Get lanes with their tasks
    const laneRows = await query<LaneRow>(
      `SELECT * FROM execution_lanes WHERE session_id = ? ORDER BY category, name`,
      [session.id],
    );

    const lanes: Lane[] = [];
    for (const laneRow of laneRows) {
      const taskRows = await query<LaneTaskRow>(
        `SELECT lt.*, t.display_id, t.title, ba.name as agent_name
         FROM lane_tasks lt
         JOIN tasks t ON lt.task_id = t.id
         LEFT JOIN build_agent_instances ba ON lt.agent_id = ba.id
         WHERE lt.lane_id = ?
         ORDER BY lt.wave_number, lt.position_in_wave`,
        [laneRow.id],
      );

      const tasks: LaneTask[] = taskRows.map((tr) => ({
        id: tr.id,
        taskId: tr.task_id,
        displayId: tr.display_id ?? undefined,
        title: tr.title,
        waveNumber: tr.wave_number,
        positionInWave: tr.position_in_wave,
        status: tr.status as LaneTask["status"],
        startedAt: tr.started_at ?? undefined,
        completedAt: tr.completed_at ?? undefined,
        durationMs: tr.duration_ms ?? undefined,
        blockReason: tr.block_reason ?? undefined,
        blockingTaskId: tr.blocking_task_id ?? undefined,
        agentId: tr.agent_id ?? undefined,
        agentName: tr.agent_name ?? undefined,
      }));

      lanes.push(mapLaneRow(laneRow, tasks));
    }

    // Get waves
    const waveRows = await query<WaveRow>(
      `SELECT * FROM execution_waves WHERE session_id = ? ORDER BY wave_number`,
      [session.id],
    );
    const waves = waveRows.map(mapWaveRow);

    // Get active wave number
    const activeWave = waves.find((w) => w.status === "active");
    const activeWaveNumber =
      activeWave?.waveNumber ?? (waves.length > 0 ? 1 : 0);

    // Get agents
    const agentRows = await query<AgentRow>(
      `SELECT ba.id, ba.name, ba.status, ba.current_task_id,
              t.title as current_task_title, lt.lane_id, ba.last_heartbeat
       FROM build_agent_instances ba
       LEFT JOIN tasks t ON ba.current_task_id = t.id
       LEFT JOIN lane_tasks lt ON t.id = lt.task_id
       WHERE ba.session_id = ?`,
      [session.id],
    );

    const now = Date.now();
    const agents: AgentStatus[] = agentRows.map((ar) => ({
      id: ar.id,
      name: ar.name,
      status: ar.status as AgentStatus["status"],
      currentTaskId: ar.current_task_id ?? undefined,
      currentTaskTitle: ar.current_task_title ?? undefined,
      laneId: ar.lane_id ?? undefined,
      heartbeatAt: ar.last_heartbeat ?? undefined,
      heartbeatAgeSeconds: ar.last_heartbeat
        ? Math.floor((now - new Date(ar.last_heartbeat).getTime()) / 1000)
        : 0,
    }));

    // Get conflicts
    const conflictRows = await query<ConflictRow>(
      `SELECT tc.*,
              ta.display_id as task_a_display_id, ta.title as task_a_title,
              tb.display_id as task_b_display_id, tb.title as task_b_title
       FROM task_conflicts tc
       JOIN tasks ta ON tc.task_a_id = ta.id
       JOIN tasks tb ON tc.task_b_id = tb.id
       WHERE tc.session_id = ? AND tc.resolved_at IS NULL`,
      [session.id],
    );
    const conflicts = conflictRows.map(mapConflictRow);

    // Calculate totals
    const totalTasks = lanes.reduce((sum, l) => sum + l.tasksTotal, 0);
    const completedTasks = lanes.reduce((sum, l) => sum + l.tasksCompleted, 0);
    const percentComplete =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const status: PipelineStatus = {
      sessionId: session.id,
      status: session.status as PipelineStatus["status"],
      lanes,
      waves,
      activeWaveNumber,
      agents,
      conflicts,
      totalTasks,
      completedTasks,
      percentComplete,
    };

    return res.json(status);
  } catch (err) {
    console.error("[Pipeline] Error fetching status:", err);
    return res.status(500).json({
      error: "Failed to fetch pipeline status",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/lanes
 * Get all lanes for the current session
 */
router.get("/lanes", async (_req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.json([]);
    }

    const laneRows = await query<LaneRow>(
      `SELECT * FROM execution_lanes WHERE session_id = ? ORDER BY category, name`,
      [session.id],
    );

    const lanes: Lane[] = [];
    for (const laneRow of laneRows) {
      const taskRows = await query<LaneTaskRow>(
        `SELECT lt.*, t.display_id, t.title, ba.name as agent_name
         FROM lane_tasks lt
         JOIN tasks t ON lt.task_id = t.id
         LEFT JOIN build_agent_instances ba ON lt.agent_id = ba.id
         WHERE lt.lane_id = ?
         ORDER BY lt.wave_number, lt.position_in_wave`,
        [laneRow.id],
      );

      const tasks: LaneTask[] = taskRows.map((tr) => ({
        id: tr.id,
        taskId: tr.task_id,
        displayId: tr.display_id ?? undefined,
        title: tr.title,
        waveNumber: tr.wave_number,
        positionInWave: tr.position_in_wave,
        status: tr.status as LaneTask["status"],
        startedAt: tr.started_at ?? undefined,
        completedAt: tr.completed_at ?? undefined,
        durationMs: tr.duration_ms ?? undefined,
        blockReason: tr.block_reason ?? undefined,
        blockingTaskId: tr.blocking_task_id ?? undefined,
        agentId: tr.agent_id ?? undefined,
        agentName: tr.agent_name ?? undefined,
      }));

      lanes.push(mapLaneRow(laneRow, tasks));
    }

    return res.json(lanes);
  } catch (err) {
    console.error("[Pipeline] Error fetching lanes:", err);
    return res.status(500).json({
      error: "Failed to fetch lanes",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/lanes/:laneId
 * Get details for a specific lane
 */
router.get("/lanes/:laneId", async (req: Request, res: Response) => {
  try {
    const { laneId } = req.params;

    const laneRow = await getOne<LaneRow>(
      `SELECT * FROM execution_lanes WHERE id = ?`,
      [laneId],
    );

    if (!laneRow) {
      return res.status(404).json({ error: "Lane not found" });
    }

    const taskRows = await query<LaneTaskRow>(
      `SELECT lt.*, t.display_id, t.title, ba.name as agent_name
       FROM lane_tasks lt
       JOIN tasks t ON lt.task_id = t.id
       LEFT JOIN build_agent_instances ba ON lt.agent_id = ba.id
       WHERE lt.lane_id = ?
       ORDER BY lt.wave_number, lt.position_in_wave`,
      [laneId],
    );

    const tasks: LaneTask[] = taskRows.map((tr) => ({
      id: tr.id,
      taskId: tr.task_id,
      displayId: tr.display_id ?? undefined,
      title: tr.title,
      waveNumber: tr.wave_number,
      positionInWave: tr.position_in_wave,
      status: tr.status as LaneTask["status"],
      startedAt: tr.started_at ?? undefined,
      completedAt: tr.completed_at ?? undefined,
      durationMs: tr.duration_ms ?? undefined,
      blockReason: tr.block_reason ?? undefined,
      blockingTaskId: tr.blocking_task_id ?? undefined,
      agentId: tr.agent_id ?? undefined,
      agentName: tr.agent_name ?? undefined,
    }));

    return res.json(mapLaneRow(laneRow, tasks));
  } catch (err) {
    console.error("[Pipeline] Error fetching lane:", err);
    return res.status(500).json({
      error: "Failed to fetch lane",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/waves
 * Get all waves for the current session
 */
router.get("/waves", async (_req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.json([]);
    }

    const waveRows = await query<WaveRow>(
      `SELECT * FROM execution_waves WHERE session_id = ? ORDER BY wave_number`,
      [session.id],
    );

    return res.json(waveRows.map(mapWaveRow));
  } catch (err) {
    console.error("[Pipeline] Error fetching waves:", err);
    return res.status(500).json({
      error: "Failed to fetch waves",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/waves/:waveNumber
 * Get details for a specific wave
 */
router.get("/waves/:waveNumber", async (req: Request, res: Response) => {
  try {
    const waveNumber = parseInt(req.params.waveNumber, 10);
    const session = await getActiveSession();

    if (!session) {
      return res.status(404).json({ error: "No active session" });
    }

    const waveRow = await getOne<WaveRow>(
      `SELECT * FROM execution_waves WHERE session_id = ? AND wave_number = ?`,
      [session.id, waveNumber],
    );

    if (!waveRow) {
      return res.status(404).json({ error: "Wave not found" });
    }

    // Get tasks in this wave
    const taskRows = await query<LaneTaskRow>(
      `SELECT lt.*, t.display_id, t.title, ba.name as agent_name, el.name as lane_name
       FROM lane_tasks lt
       JOIN tasks t ON lt.task_id = t.id
       JOIN execution_lanes el ON lt.lane_id = el.id
       LEFT JOIN build_agent_instances ba ON lt.agent_id = ba.id
       WHERE el.session_id = ? AND lt.wave_number = ?
       ORDER BY el.category, el.name`,
      [session.id, waveNumber],
    );

    return res.json({
      ...mapWaveRow(waveRow),
      tasks: taskRows.map((tr) => ({
        id: tr.id,
        taskId: tr.task_id,
        displayId: tr.display_id ?? undefined,
        title: tr.title,
        waveNumber: tr.wave_number,
        positionInWave: tr.position_in_wave,
        status: tr.status as LaneTask["status"],
        startedAt: tr.started_at ?? undefined,
        completedAt: tr.completed_at ?? undefined,
        durationMs: tr.duration_ms ?? undefined,
        blockReason: tr.block_reason ?? undefined,
        blockingTaskId: tr.blocking_task_id ?? undefined,
        agentId: tr.agent_id ?? undefined,
        agentName: tr.agent_name ?? undefined,
      })),
    });
  } catch (err) {
    console.error("[Pipeline] Error fetching wave:", err);
    return res.status(500).json({
      error: "Failed to fetch wave",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/conflicts
 * Get all conflicts for the current session
 */
router.get("/conflicts", async (_req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.json([]);
    }

    const conflictRows = await query<ConflictRow>(
      `SELECT tc.*,
              ta.display_id as task_a_display_id, ta.title as task_a_title,
              tb.display_id as task_b_display_id, tb.title as task_b_title
       FROM task_conflicts tc
       JOIN tasks ta ON tc.task_a_id = ta.id
       JOIN tasks tb ON tc.task_b_id = tb.id
       WHERE tc.session_id = ?`,
      [session.id],
    );

    return res.json(conflictRows.map(mapConflictRow));
  } catch (err) {
    console.error("[Pipeline] Error fetching conflicts:", err);
    return res.status(500).json({
      error: "Failed to fetch conflicts",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/events
 * Get recent pipeline events for the execution stream
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.json([]);
    }

    const limit = parseInt(req.query.limit as string, 10) || 100;
    const after = req.query.after as string;

    let sql = `SELECT * FROM pipeline_events WHERE session_id = ?`;
    const params: (string | number)[] = [session.id];

    if (after) {
      sql += ` AND timestamp > ?`;
      params.push(after);
    }

    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const eventRows = await query<EventRow>(sql, params);

    const events: PipelineEvent[] = eventRows.map((er) => ({
      id: er.id,
      sessionId: er.session_id,
      timestamp: er.timestamp,
      eventType: er.event_type,
      payload: parseJsonSafe(er.payload, {}),
    }));

    // Return in chronological order
    return res.json(events.reverse());
  } catch (err) {
    console.error("[Pipeline] Error fetching events:", err);
    return res.status(500).json({
      error: "Failed to fetch events",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/projects
 * Get unique project IDs with task counts for filtering
 */
router.get("/projects", async (_req: Request, res: Response) => {
  try {
    const projects = await query<{
      project_id: string;
      project_name: string;
      project_code: string;
      task_count: number;
    }>(
      `SELECT
         COALESCE(t.project_id, tl.project_id, 'unassigned') as project_id,
         COALESCE(p.name, 'Unassigned') as project_name,
         COALESCE(p.code, 'N/A') as project_code,
         COUNT(t.id) as task_count
       FROM tasks t
       LEFT JOIN task_lists_v2 tl ON t.task_list_id = tl.id
       LEFT JOIN projects p ON p.id = COALESCE(t.project_id, tl.project_id)
       WHERE t.phase IS NOT NULL
       GROUP BY COALESCE(t.project_id, tl.project_id, 'unassigned')
       ORDER BY task_count DESC`,
    );

    const result: ProjectOption[] = projects.map((p) => ({
      projectId: p.project_id,
      projectName: p.project_name,
      projectCode: p.project_code,
      taskCount: p.task_count,
    }));

    return res.json(result);
  } catch (err) {
    console.error("[Pipeline] Error fetching projects:", err);
    return res.status(500).json({
      error: "Failed to fetch projects",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/task-lists
 * Get task lists with optional project filtering
 */
router.get("/task-lists", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;

    let sql = `
      SELECT
        tl.id,
        tl.name,
        tl.project_id,
        tl.status,
        COUNT(t.id) as task_count
      FROM task_lists_v2 tl
      LEFT JOIN tasks t ON t.task_list_id = tl.id AND t.phase IS NOT NULL
    `;
    const params: string[] = [];

    if (projectId && projectId !== "all") {
      if (projectId === "unassigned") {
        sql += ` WHERE tl.project_id IS NULL`;
      } else {
        sql += ` WHERE tl.project_id = ?`;
        params.push(projectId);
      }
    }

    sql += ` GROUP BY tl.id ORDER BY tl.name`;

    const taskLists = await query<{
      id: string;
      name: string;
      project_id: string | null;
      status: string;
      task_count: number;
    }>(sql, params);

    const result: TaskListOption[] = taskLists.map((tl) => ({
      id: tl.id,
      name: tl.name,
      projectId: tl.project_id,
      taskCount: tl.task_count,
      status: tl.status,
    }));

    return res.json(result);
  } catch (err) {
    console.error("[Pipeline] Error fetching task lists:", err);
    return res.status(500).json({
      error: "Failed to fetch task lists",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/pipeline/lanes
 * Create a new execution lane
 */
router.post("/lanes", async (req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.status(400).json({ error: "No active execution session" });
    }

    const { name, category, filePatterns } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: "Name and category are required" });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO execution_lanes (id, session_id, name, category, file_patterns, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'idle', ?, ?)`,
      [
        id,
        session.id,
        name,
        category,
        JSON.stringify(filePatterns || []),
        now,
        now,
      ],
    );

    const laneRow = await getOne<LaneRow>(
      `SELECT * FROM execution_lanes WHERE id = ?`,
      [id],
    );

    return res.status(201).json(mapLaneRow(laneRow!, []));
  } catch (err) {
    console.error("[Pipeline] Error creating lane:", err);
    return res.status(500).json({
      error: "Failed to create lane",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/pipeline/lanes/:laneId/tasks
 * Assign a task to a lane
 */
router.post("/lanes/:laneId/tasks", async (req: Request, res: Response) => {
  try {
    const { laneId } = req.params;
    const { taskId, waveNumber, positionInWave } = req.body;

    if (!taskId || waveNumber === undefined) {
      return res
        .status(400)
        .json({ error: "taskId and waveNumber are required" });
    }

    // Verify lane exists
    const lane = await getOne<LaneRow>(
      `SELECT * FROM execution_lanes WHERE id = ?`,
      [laneId],
    );
    if (!lane) {
      return res.status(404).json({ error: "Lane not found" });
    }

    // Verify task exists
    const task = await getOne<{ id: string; title: string }>(
      `SELECT id, title FROM tasks WHERE id = ?`,
      [taskId],
    );
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const id = uuidv4();

    await run(
      `INSERT INTO lane_tasks (id, lane_id, task_id, wave_number, position_in_wave, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))`,
      [id, laneId, taskId, waveNumber, positionInWave ?? 0],
    );

    // Update lane task counts
    await run(
      `UPDATE execution_lanes SET tasks_total = tasks_total + 1, updated_at = datetime('now') WHERE id = ?`,
      [laneId],
    );

    return res.status(201).json({
      id,
      laneId,
      taskId,
      waveNumber,
      positionInWave: positionInWave ?? 0,
      status: "pending",
    });
  } catch (err) {
    console.error("[Pipeline] Error assigning task to lane:", err);
    return res.status(500).json({
      error: "Failed to assign task to lane",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * POST /api/pipeline/events
 * Record a pipeline event (used by backend services)
 */
router.post("/events", async (req: Request, res: Response) => {
  try {
    const session = await getActiveSession();
    if (!session) {
      return res.status(400).json({ error: "No active execution session" });
    }

    const { eventType, payload } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: "eventType is required" });
    }

    const id = uuidv4();
    const timestamp = new Date().toISOString();

    await run(
      `INSERT INTO pipeline_events (id, session_id, timestamp, event_type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.id,
        timestamp,
        eventType,
        JSON.stringify(payload || {}),
        timestamp,
      ],
    );

    return res.status(201).json({
      id,
      sessionId: session.id,
      timestamp,
      eventType,
      payload: payload || {},
    });
  } catch (err) {
    console.error("[Pipeline] Error recording event:", err);
    return res.status(500).json({
      error: "Failed to record event",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ====================
// Task Detail Types
// ====================

export interface TaskDetailInfo {
  // Core task data
  id: string;
  displayId?: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  priority?: string;
  effort?: string;
  phase?: number;
  position?: number;
  owner?: string;
  assignedAgentId?: string;
  queue?: string;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;

  // Task list info
  taskList?: {
    id: string;
    name: string;
    description?: string;
    status: string;
    projectId?: string;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    createdAt: string;
    updatedAt: string;
  };

  // Dependencies (11 relationship types per task-data-model-diagram.md)
  dependencies: {
    // Original 6 types
    dependsOn: TaskRelation[];
    blocks: TaskRelation[];
    relatedTo: TaskRelation[];
    duplicateOf: TaskRelation[];
    parentOf: TaskRelation[];
    childOf: TaskRelation[];
    // Additional 6 types
    supersedes: TaskRelation[];
    implements: TaskRelation[];
    conflictsWith: TaskRelation[];
    enables: TaskRelation[];
    inspiredBy: TaskRelation[];
    tests: TaskRelation[];
  };

  // File impacts
  fileImpacts: {
    id: string;
    filePath: string;
    operation: string;
    confidence: number;
    source: string;
    wasAccurate?: boolean;
    createdAt: string;
  }[];

  // File changes (actual changes after execution)
  fileChanges: {
    id: string;
    filePath: string;
    operation: string;
    linesAdded?: number;
    linesRemoved?: number;
    recordedAt: string;
  }[];

  // Test results
  testResults: {
    id: string;
    testLevel: number;
    testScope?: string;
    testName?: string;
    command: string;
    exitCode: number;
    stdout?: string;
    stderr?: string;
    durationMs: number;
    passed: boolean;
    agentId?: string;
    createdAt: string;
  }[];

  // State history
  stateHistory: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedBy: string;
    actorType: string;
    reason?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
  }[];

  // Versions
  versions: {
    id: string;
    version: number;
    changedFields: string[];
    changeReason?: string;
    isCheckpoint: boolean;
    checkpointName?: string;
    createdBy: string;
    createdAt: string;
  }[];

  // Appendices
  appendices: {
    id: string;
    appendixType: string;
    contentType: string;
    content?: string;
    referenceId?: string;
    referenceTable?: string;
    metadata?: Record<string, unknown>;
    position: number;
    createdAt: string;
  }[];

  // PRD connections
  prds: {
    id: string;
    slug: string;
    title: string;
    status: string;
    linkType: string;
    requirementRef?: string;
  }[];
}

export interface TaskRelation {
  taskId: string;
  displayId?: string;
  title: string;
  status: string;
  relationshipType: string;
}

// ====================
// Task Detail Database Row Types
// ====================

interface TaskRow {
  id: string;
  display_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string | null;
  effort: string | null;
  phase: number | null;
  position: number | null;
  owner: string | null;
  assigned_agent_id: string | null;
  queue: string | null;
  project_id: string | null;
  task_list_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface TaskListRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  project_id: string | null;
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  created_at: string;
  updated_at: string;
}

interface RelationshipRow {
  id: string;
  source_task_id: string;
  target_task_id: string;
  relationship_type: string;
  related_task_id: string;
  related_display_id: string | null;
  related_title: string;
  related_status: string;
}

interface FileImpactDbRow {
  id: string;
  task_id: string;
  file_path: string;
  operation: string;
  confidence: number;
  source: string;
  was_accurate: number | null;
  created_at: string;
}

interface FileChangeRow {
  id: string;
  task_id: string;
  file_path: string;
  operation: string;
  lines_added: number | null;
  lines_removed: number | null;
  recorded_at: string;
}

interface TestResultRow {
  id: string;
  task_id: string;
  test_level: number;
  test_scope: string | null;
  test_name: string | null;
  command: string;
  exit_code: number;
  stdout: string | null;
  stderr: string | null;
  duration_ms: number;
  passed: number;
  agent_id: string | null;
  created_at: string;
}

interface StateHistoryRow {
  id: string;
  task_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string;
  actor_type: string;
  reason: string | null;
  metadata: string | null;
  created_at: string;
}

interface VersionRow {
  id: string;
  task_id: string;
  version: number;
  changed_fields: string;
  change_reason: string | null;
  is_checkpoint: number;
  checkpoint_name: string | null;
  created_by: string;
  created_at: string;
}

interface AppendixRow {
  id: string;
  task_id: string;
  appendix_type: string;
  content_type: string;
  content: string | null;
  reference_id: string | null;
  reference_table: string | null;
  metadata: string | null;
  position: number;
  created_at: string;
}

interface PrdLinkRow {
  prd_id: string;
  prd_slug: string;
  prd_title: string;
  prd_status: string;
  link_type: string;
  requirement_ref: string | null;
}

// ====================
// Task Detail Route
// ====================

/**
 * GET /api/pipeline/tasks/:taskId
 * Get complete task details including all related data
 */
router.get("/tasks/:taskId", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;

    // Get core task data
    const task = await getOne<TaskRow>(`SELECT * FROM tasks WHERE id = ?`, [
      taskId,
    ]);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Get task list info if task belongs to one
    let taskList: TaskDetailInfo["taskList"] | undefined;
    if (task.task_list_id) {
      const tlRow = await getOne<TaskListRow>(
        `SELECT * FROM task_lists_v2 WHERE id = ?`,
        [task.task_list_id],
      );
      if (tlRow) {
        taskList = {
          id: tlRow.id,
          name: tlRow.name,
          description: tlRow.description ?? undefined,
          status: tlRow.status,
          projectId: tlRow.project_id ?? undefined,
          totalTasks: tlRow.total_tasks,
          completedTasks: tlRow.completed_tasks,
          failedTasks: tlRow.failed_tasks,
          createdAt: tlRow.created_at,
          updatedAt: tlRow.updated_at,
        };
      }
    }

    // Get dependencies (outgoing relationships - this task depends on/blocks others)
    const outgoingRels = await query<RelationshipRow>(
      `SELECT tr.*, t.id as related_task_id, t.display_id as related_display_id,
              t.title as related_title, t.status as related_status
       FROM task_relationships tr
       JOIN tasks t ON tr.target_task_id = t.id
       WHERE tr.source_task_id = ?`,
      [taskId],
    );

    // Get incoming relationships - other tasks that depend on/block this one
    const incomingRels = await query<RelationshipRow>(
      `SELECT tr.*, t.id as related_task_id, t.display_id as related_display_id,
              t.title as related_title, t.status as related_status
       FROM task_relationships tr
       JOIN tasks t ON tr.source_task_id = t.id
       WHERE tr.target_task_id = ?`,
      [taskId],
    );

    const dependencies: TaskDetailInfo["dependencies"] = {
      // Original 6 types
      dependsOn: [],
      blocks: [],
      relatedTo: [],
      duplicateOf: [],
      parentOf: [],
      childOf: [],
      // Additional 6 types
      supersedes: [],
      implements: [],
      conflictsWith: [],
      enables: [],
      inspiredBy: [],
      tests: [],
    };

    // Process outgoing relationships
    for (const rel of outgoingRels) {
      const relation: TaskRelation = {
        taskId: rel.related_task_id,
        displayId: rel.related_display_id ?? undefined,
        title: rel.related_title,
        status: rel.related_status,
        relationshipType: rel.relationship_type,
      };

      switch (rel.relationship_type) {
        // Original 6 types
        case "depends_on":
          dependencies.dependsOn.push(relation);
          break;
        case "blocks":
          dependencies.blocks.push(relation);
          break;
        case "related_to":
          dependencies.relatedTo.push(relation);
          break;
        case "duplicate_of":
          dependencies.duplicateOf.push(relation);
          break;
        case "parent_of":
          dependencies.parentOf.push(relation);
          break;
        case "child_of":
          dependencies.childOf.push(relation);
          break;
        // Additional 6 types
        case "supersedes":
          dependencies.supersedes.push(relation);
          break;
        case "implements":
          dependencies.implements.push(relation);
          break;
        case "conflicts_with":
          dependencies.conflictsWith.push(relation);
          break;
        case "enables":
          dependencies.enables.push(relation);
          break;
        case "inspired_by":
          dependencies.inspiredBy.push(relation);
          break;
        case "tests":
          dependencies.tests.push(relation);
          break;
      }
    }

    // Process incoming relationships (reverse the meaning)
    for (const rel of incomingRels) {
      const relation: TaskRelation = {
        taskId: rel.related_task_id,
        displayId: rel.related_display_id ?? undefined,
        title: rel.related_title,
        status: rel.related_status,
        relationshipType: rel.relationship_type,
      };

      // Reverse the relationship type for incoming
      switch (rel.relationship_type) {
        // Original 6 types
        case "depends_on":
          // If another task depends on us, we block them
          dependencies.blocks.push({
            ...relation,
            relationshipType: "blocked_by",
          });
          break;
        case "blocks":
          // If another task blocks us, we depend on them
          dependencies.dependsOn.push({
            ...relation,
            relationshipType: "blocked_by",
          });
          break;
        case "related_to":
          dependencies.relatedTo.push(relation);
          break;
        case "parent_of":
          dependencies.childOf.push({
            ...relation,
            relationshipType: "child_of",
          });
          break;
        case "child_of":
          dependencies.parentOf.push({
            ...relation,
            relationshipType: "parent_of",
          });
          break;
        // Additional 6 types (handle incoming/reverse relationships)
        case "supersedes":
          // If another task supersedes us, we are superseded by them
          // Note: No reverse array, just track that we're superseded
          break;
        case "implements":
          // If another task implements us, we are implemented by them
          // Note: No reverse array, just track that we're implemented
          break;
        case "conflicts_with":
          // Conflicts are symmetric
          dependencies.conflictsWith.push(relation);
          break;
        case "enables":
          // If another task enables us, we are enabled by them
          dependencies.dependsOn.push({
            ...relation,
            relationshipType: "enabled_by",
          });
          break;
        case "inspired_by":
          // If another task was inspired by us, we inspired them
          // Note: No reverse array for this
          break;
        case "tests":
          // If another task tests us, we are tested by them
          // Note: No reverse array for this
          break;
      }
    }

    // Get file impacts
    const fileImpactRows = await query<FileImpactDbRow>(
      `SELECT * FROM task_file_impacts WHERE task_id = ? ORDER BY file_path`,
      [taskId],
    );

    const fileImpacts = fileImpactRows.map((fi) => ({
      id: fi.id,
      filePath: fi.file_path,
      operation: fi.operation,
      confidence: fi.confidence,
      source: fi.source,
      wasAccurate: fi.was_accurate === null ? undefined : fi.was_accurate === 1,
      createdAt: fi.created_at,
    }));

    // Get file changes
    const fileChangeRows = await query<FileChangeRow>(
      `SELECT * FROM task_file_changes WHERE task_id = ? ORDER BY recorded_at`,
      [taskId],
    );

    const fileChanges = fileChangeRows.map((fc) => ({
      id: fc.id,
      filePath: fc.file_path,
      operation: fc.operation,
      linesAdded: fc.lines_added ?? undefined,
      linesRemoved: fc.lines_removed ?? undefined,
      recordedAt: fc.recorded_at,
    }));

    // Get test results
    const testResultRows = await query<TestResultRow>(
      `SELECT * FROM task_test_results WHERE task_id = ? ORDER BY test_level, created_at`,
      [taskId],
    );

    const testResults = testResultRows.map((tr) => ({
      id: tr.id,
      testLevel: tr.test_level,
      testScope: tr.test_scope ?? undefined,
      testName: tr.test_name ?? undefined,
      command: tr.command,
      exitCode: tr.exit_code,
      stdout: tr.stdout ?? undefined,
      stderr: tr.stderr ?? undefined,
      durationMs: tr.duration_ms,
      passed: tr.passed === 1,
      agentId: tr.agent_id ?? undefined,
      createdAt: tr.created_at,
    }));

    // Get state history
    const stateHistoryRows = await query<StateHistoryRow>(
      `SELECT * FROM task_state_history WHERE task_id = ? ORDER BY created_at DESC`,
      [taskId],
    );

    const stateHistory = stateHistoryRows.map((sh) => ({
      id: sh.id,
      fromStatus: sh.from_status ?? undefined,
      toStatus: sh.to_status,
      changedBy: sh.changed_by,
      actorType: sh.actor_type,
      reason: sh.reason ?? undefined,
      metadata: sh.metadata ? parseJsonSafe(sh.metadata, {}) : undefined,
      createdAt: sh.created_at,
    }));

    // Get versions
    const versionRows = await query<VersionRow>(
      `SELECT * FROM task_versions WHERE task_id = ? ORDER BY version DESC`,
      [taskId],
    );

    const versions = versionRows.map((v) => ({
      id: v.id,
      version: v.version,
      changedFields: parseJsonSafe<string[]>(v.changed_fields, []),
      changeReason: v.change_reason ?? undefined,
      isCheckpoint: v.is_checkpoint === 1,
      checkpointName: v.checkpoint_name ?? undefined,
      createdBy: v.created_by,
      createdAt: v.created_at,
    }));

    // Get appendices
    const appendixRows = await query<AppendixRow>(
      `SELECT * FROM task_appendices WHERE task_id = ? ORDER BY position`,
      [taskId],
    );

    const appendices = appendixRows.map((a) => ({
      id: a.id,
      appendixType: a.appendix_type,
      contentType: a.content_type,
      content: a.content ?? undefined,
      referenceId: a.reference_id ?? undefined,
      referenceTable: a.reference_table ?? undefined,
      metadata: a.metadata ? parseJsonSafe(a.metadata, {}) : undefined,
      position: a.position,
      createdAt: a.created_at,
    }));

    // Get PRD connections
    const prdLinkRows = await query<PrdLinkRow>(
      `SELECT p.id as prd_id, p.slug as prd_slug, p.title as prd_title,
              p.status as prd_status, pt.link_type, pt.requirement_ref
       FROM prd_tasks pt
       JOIN prds p ON pt.prd_id = p.id
       WHERE pt.task_id = ?`,
      [taskId],
    );

    const prds = prdLinkRows.map((pr) => ({
      id: pr.prd_id,
      slug: pr.prd_slug,
      title: pr.prd_title,
      status: pr.prd_status,
      linkType: pr.link_type,
      requirementRef: pr.requirement_ref ?? undefined,
    }));

    // Build response
    const taskDetail: TaskDetailInfo = {
      id: task.id,
      displayId: task.display_id ?? undefined,
      title: task.title,
      description: task.description ?? undefined,
      category: task.category ?? undefined,
      status: task.status,
      priority: task.priority ?? undefined,
      effort: task.effort ?? undefined,
      phase: task.phase ?? undefined,
      position: task.position ?? undefined,
      owner: task.owner ?? undefined,
      assignedAgentId: task.assigned_agent_id ?? undefined,
      queue: task.queue ?? undefined,
      projectId: task.project_id ?? undefined,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
      startedAt: task.started_at ?? undefined,
      completedAt: task.completed_at ?? undefined,
      taskList,
      dependencies,
      fileImpacts,
      fileChanges,
      testResults,
      stateHistory,
      versions,
      appendices,
      prds,
    };

    return res.json(taskDetail);
  } catch (err) {
    console.error("[Pipeline] Error fetching task detail:", err);
    return res.status(500).json({
      error: "Failed to fetch task detail",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ====================
// Acceptance Criteria Endpoints
// ====================

import { taskTestService } from "../services/task-agent/task-test-service.js";
import type { VerifiedByType } from "../../types/task-test.js";

/**
 * GET /api/pipeline/tasks/:taskId/acceptance-criteria
 * Get acceptance criteria with persisted verification status
 */
router.get(
  "/tasks/:taskId/acceptance-criteria",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const result = await taskTestService.checkAcceptanceCriteria(taskId);
      return res.json(result);
    } catch (err) {
      console.error("[Pipeline] Error fetching acceptance criteria:", err);
      return res.status(500).json({
        error: "Failed to fetch acceptance criteria",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * PUT /api/pipeline/tasks/:taskId/acceptance-criteria/:appendixId/:criterionIndex
 * Update a single acceptance criterion status
 */
router.put(
  "/tasks/:taskId/acceptance-criteria/:appendixId/:criterionIndex",
  async (req: Request, res: Response) => {
    try {
      const { taskId, appendixId, criterionIndex } = req.params;
      const { met, notes, verifiedBy } = req.body as {
        met: boolean;
        notes?: string;
        verifiedBy?: VerifiedByType;
      };

      if (typeof met !== "boolean") {
        return res
          .status(400)
          .json({ error: "'met' field is required and must be a boolean" });
      }

      const result = await taskTestService.updateAcceptanceCriterionStatus(
        taskId,
        appendixId,
        parseInt(criterionIndex, 10),
        met,
        verifiedBy || "user",
        notes,
      );

      return res.json(result);
    } catch (err) {
      console.error("[Pipeline] Error updating acceptance criterion:", err);
      return res.status(500).json({
        error: "Failed to update acceptance criterion",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * PUT /api/pipeline/tasks/:taskId/acceptance-criteria
 * Bulk update acceptance criteria
 */
router.put(
  "/tasks/:taskId/acceptance-criteria",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { updates, verifiedBy } = req.body as {
        updates: {
          appendixId: string;
          criterionIndex: number;
          met: boolean;
          notes?: string;
        }[];
        verifiedBy?: VerifiedByType;
      };

      if (!Array.isArray(updates) || updates.length === 0) {
        return res
          .status(400)
          .json({ error: "'updates' array is required and must not be empty" });
      }

      const results = await taskTestService.bulkUpdateAcceptanceCriteria(
        taskId,
        updates,
        verifiedBy || "user",
      );

      return res.json({ updated: results.length, results });
    } catch (err) {
      console.error("[Pipeline] Error bulk updating acceptance criteria:", err);
      return res.status(500).json({
        error: "Failed to bulk update acceptance criteria",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * DELETE /api/pipeline/tasks/:taskId/acceptance-criteria
 * Reset/delete all acceptance criteria results for a task
 */
router.delete(
  "/tasks/:taskId/acceptance-criteria",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { mode } = req.query as { mode?: "reset" | "delete" };

      if (mode === "delete") {
        await taskTestService.deleteAcceptanceCriteriaResults(taskId);
        return res.json({ message: "Acceptance criteria results deleted" });
      } else {
        // Default to reset (mark all as not met)
        await taskTestService.resetAcceptanceCriteria(taskId);
        return res.json({ message: "Acceptance criteria results reset" });
      }
    } catch (err) {
      console.error("[Pipeline] Error resetting acceptance criteria:", err);
      return res.status(500).json({
        error: "Failed to reset acceptance criteria",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

// ====================
// Task Readiness Endpoints
// ====================

import {
  taskReadinessService,
  ReadinessScore,
  BulkReadinessResult,
} from "../services/task-agent/task-readiness-service.js";

/**
 * GET /api/pipeline/tasks/:taskId/readiness
 * Get readiness score for a single task
 */
router.get("/tasks/:taskId/readiness", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const readiness = await taskReadinessService.calculateReadiness(taskId);
    return res.json(readiness);
  } catch (err) {
    console.error("[Pipeline] Error calculating task readiness:", err);
    return res.status(500).json({
      error: "Failed to calculate task readiness",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GET /api/pipeline/task-lists/:taskListId/readiness
 * Get bulk readiness scores for all tasks in a task list
 */
router.get(
  "/task-lists/:taskListId/readiness",
  async (req: Request, res: Response) => {
    try {
      const { taskListId } = req.params;
      const result =
        await taskReadinessService.calculateBulkReadiness(taskListId);

      // Convert Map to serializable object
      const tasksObj: Record<string, ReadinessScore> = {};
      for (const [taskId, score] of result.tasks) {
        tasksObj[taskId] = score;
      }

      return res.json({
        taskListId: result.taskListId,
        tasks: tasksObj,
        summary: result.summary,
        calculatedAt: result.calculatedAt,
      });
    } catch (err) {
      console.error("[Pipeline] Error calculating bulk readiness:", err);
      return res.status(500).json({
        error: "Failed to calculate bulk readiness",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/pipeline/tasks/:taskId/readiness/invalidate
 * Invalidate readiness cache for a task
 */
router.post(
  "/tasks/:taskId/readiness/invalidate",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      await taskReadinessService.invalidateCache(taskId);
      return res.json({ message: "Cache invalidated", taskId });
    } catch (err) {
      console.error("[Pipeline] Error invalidating readiness cache:", err);
      return res.status(500).json({
        error: "Failed to invalidate readiness cache",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/pipeline/task-lists/:taskListId/readiness/invalidate
 * Invalidate readiness cache for all tasks in a task list
 */
router.post(
  "/task-lists/:taskListId/readiness/invalidate",
  async (req: Request, res: Response) => {
    try {
      const { taskListId } = req.params;
      await taskReadinessService.invalidateTaskListCache(taskListId);
      return res.json({
        message: "Cache invalidated for task list",
        taskListId,
      });
    } catch (err) {
      console.error(
        "[Pipeline] Error invalidating task list readiness cache:",
        err,
      );
      return res.status(500).json({
        error: "Failed to invalidate task list readiness cache",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

// ====================
// Auto-Populate Endpoints
// ====================

import {
  taskAutoPopulateService,
  AutoPopulateField,
  Suggestion,
} from "../services/task-agent/task-auto-populate-service.js";

// Store suggestions temporarily for apply endpoint (in production, use Redis or DB)
const suggestionCache = new Map<
  string,
  { suggestions: Suggestion[]; expiresAt: number }
>();

/**
 * POST /api/pipeline/tasks/:taskId/auto-populate
 * Generate suggestions for a specific field
 */
router.post(
  "/tasks/:taskId/auto-populate",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { field } = req.body as { field: AutoPopulateField };

      if (!field) {
        return res.status(400).json({ error: "field is required in body" });
      }

      const validFields: AutoPopulateField[] = [
        "acceptance_criteria",
        "file_impacts",
        "test_commands",
        "dependencies",
        "description",
      ];

      if (!validFields.includes(field)) {
        return res.status(400).json({
          error: `Invalid field. Must be one of: ${validFields.join(", ")}`,
        });
      }

      const result = await taskAutoPopulateService.suggest(taskId, field);

      // Cache suggestions for apply endpoint (5 minute TTL)
      const cacheKey = `${taskId}:${field}`;
      suggestionCache.set(cacheKey, {
        suggestions: result.suggestions,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json(result);
    } catch (err) {
      console.error(
        "[Pipeline] Error generating auto-populate suggestions:",
        err,
      );
      return res.status(500).json({
        error: "Failed to generate suggestions",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/pipeline/tasks/:taskId/auto-populate/apply
 * Apply selected suggestions to the task
 */
router.post(
  "/tasks/:taskId/auto-populate/apply",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { field, suggestionIds } = req.body as {
        field: AutoPopulateField;
        suggestionIds: string[];
      };

      if (!field || !suggestionIds) {
        return res.status(400).json({
          error: "field and suggestionIds are required in body",
        });
      }

      // Get cached suggestions
      const cacheKey = `${taskId}:${field}`;
      const cached = suggestionCache.get(cacheKey);

      if (!cached || cached.expiresAt < Date.now()) {
        return res.status(400).json({
          error: "Suggestions expired. Please regenerate suggestions first.",
        });
      }

      const result = await taskAutoPopulateService.apply(
        taskId,
        field,
        suggestionIds,
        cached.suggestions,
      );

      // Clear cache after applying
      suggestionCache.delete(cacheKey);

      // Invalidate readiness cache
      await taskReadinessService.invalidateCache(taskId);

      return res.json(result);
    } catch (err) {
      console.error(
        "[Pipeline] Error applying auto-populate suggestions:",
        err,
      );
      return res.status(500).json({
        error: "Failed to apply suggestions",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
