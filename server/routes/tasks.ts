/**
 * Task Management API Routes
 *
 * REST API for viewing and managing build tasks.
 */

import { Router, Request, Response } from "express";
import { query, getOne, run } from "../../database/db.js";
import * as fs from "fs";

const router = Router();

// Task status type for kanban columns
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "failed"
  | "blocked";

export interface Task {
  id: string;
  phase: string;
  action: string;
  file: string;
  status: TaskStatus;
  description?: string;
  requirements: string[];
  dependsOn: string[];
  assignedAgent?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  buildId?: string;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  count: number;
}

// Task-Agent Binding Types (EXE-006)
export type AssignmentType = "auto" | "manual" | "fallback" | "retry";
export type BindingStatus =
  | "assigned"
  | "active"
  | "completed"
  | "failed"
  | "abandoned";
export type ExitReason =
  | "success"
  | "error"
  | "timeout"
  | "cancelled"
  | "reassigned";

export interface TaskAgentBinding {
  id: string;
  taskExecutionId: string;
  agentId: string;
  agentType: string;
  assignmentType: AssignmentType;
  assignedAt: string;
  startedAt?: string;
  completedAt?: string;
  status: BindingStatus;
  exitReason?: ExitReason;

  // Performance metrics
  durationMs?: number;
  apiCalls: number;
  tokensUsed: number;
  costUsd: number;

  // Execution details
  errorMessage?: string;
  filesTouched?: string[]; // JSON array of file paths
  checkpointsCreated: number;
  rollbacksPerformed: number;

  // Metadata
  contextSnapshot?: string; // JSON snapshot
  createdAt: string;
  updatedAt: string;
}

export interface CurrentTaskAssignment {
  id: string;
  taskExecutionId: string;
  taskId: string;
  phase: string;
  filePath: string;
  agentId: string;
  agentType: string;
  assignmentType: AssignmentType;
  assignedAt: string;
  startedAt?: string;
  status: BindingStatus;
  taskStatus: string;
  agentRegistrationType?: string;
  agentState?: string;
}

export interface AgentPerformance {
  agentId: string;
  agentType: string;
  totalAssignments: number;
  completedCount: number;
  failedCount: number;
  abandonedCount: number;
  avgDurationMs: number;
  totalApiCalls: number;
  totalTokens: number;
  totalCostUsd: number;
  successRatePct: number;
  firstAssignment: string;
  lastAssignment: string;
}

export interface TaskExecutionHistory {
  executionId: string;
  taskId: string;
  phase: string;
  action: string;
  filePath: string;
  currentStatus: string;
  agentAttempts: number;
  agentHistory: string; // Comma-separated list of "agentType(status)"
  lastCompletedAt?: string;
  totalDurationMs: number;
  totalTokensUsed: number;
  totalCostUsd: number;
}

/**
 * GET /api/tasks
 * List all tasks with optional filtering
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, buildId, limit = "100" } = req.query;

    let sql = `
      SELECT
        te.id,
        te.task_id,
        te.build_id,
        te.status,
        te.started_at,
        te.completed_at,
        te.duration_ms,
        te.error,
        te.output,
        be.spec_path
      FROM task_executions te
      JOIN build_executions be ON te.build_id = be.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (status) {
      sql += ` AND te.status = ?`;
      params.push(status as string);
    }

    if (buildId) {
      sql += ` AND te.build_id = ?`;
      params.push(buildId as string);
    }

    sql += ` ORDER BY te.started_at DESC LIMIT ?`;
    params.push(parseInt(limit as string, 10));

    let taskExecutions: Array<{
      id: string;
      task_id: string;
      build_id: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      duration_ms: number | null;
      error: string | null;
      spec_path: string;
    }> = [];

    try {
      taskExecutions = await query<{
        id: string;
        task_id: string;
        build_id: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        duration_ms: number | null;
        error: string | null;
        spec_path: string;
      }>(sql, params);
    } catch {
      // Table may not exist yet
    }

    // Enrich with task metadata from spec files if available
    const tasks = taskExecutions.map((te) => ({
      id: te.id,
      taskId: te.task_id,
      buildId: te.build_id,
      status: te.status as TaskStatus,
      startedAt: te.started_at,
      completedAt: te.completed_at,
      durationMs: te.duration_ms,
      error: te.error,
      specPath: te.spec_path,
    }));

    res.json(tasks);
  } catch (error) {
    console.error("[TasksAPI] Error listing tasks:", error);
    res.status(500).json({ error: "Failed to list tasks" });
  }
});

/**
 * GET /api/tasks/kanban
 * Get tasks organized by status for kanban board
 */
router.get("/kanban", async (req: Request, res: Response): Promise<void> => {
  try {
    const { buildId } = req.query;

    // Get the latest build if no buildId specified
    let targetBuildId = buildId as string | undefined;
    if (!targetBuildId) {
      try {
        const latestBuild = await getOne<{ id: string }>(
          `SELECT id FROM build_executions ORDER BY created_at DESC LIMIT 1`,
        );
        targetBuildId = latestBuild?.id;
      } catch {
        // Table may not exist yet
      }
    }

    if (!targetBuildId) {
      // Return empty kanban if no builds exist
      res.json({
        buildId: null,
        columns: [
          { id: "pending", title: "Pending", tasks: [], count: 0 },
          { id: "in_progress", title: "In Progress", tasks: [], count: 0 },
          { id: "complete", title: "Complete", tasks: [], count: 0 },
          { id: "failed", title: "Failed", tasks: [], count: 0 },
          { id: "blocked", title: "Blocked", tasks: [], count: 0 },
        ],
      });
      return;
    }

    // Get all tasks for the build
    let taskExecutions: Array<{
      id: string;
      task_id: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
      duration_ms: number | null;
      error: string | null;
    }> = [];

    try {
      taskExecutions = await query<{
        id: string;
        task_id: string;
        status: string;
        started_at: string | null;
        completed_at: string | null;
        duration_ms: number | null;
        error: string | null;
      }>(
        `
        SELECT * FROM task_executions
        WHERE build_id = ?
        ORDER BY started_at ASC
      `,
        [targetBuildId],
      );
    } catch {
      // Table may not exist yet
    }

    // Get build info for spec path
    let specPath: string | null = null;
    try {
      const build = await getOne<{ spec_path: string }>(
        `SELECT spec_path FROM build_executions WHERE id = ?`,
        [targetBuildId],
      );
      specPath = build?.spec_path || null;
    } catch {
      // Table may not exist yet
    }

    // Try to load task definitions from tasks.md if available
    const taskDefinitions: Map<string, Partial<Task>> = new Map();
    if (specPath) {
      const tasksPath = specPath.replace("spec.md", "tasks.md");
      if (fs.existsSync(tasksPath)) {
        try {
          const content = fs.readFileSync(tasksPath, "utf-8");
          // Parse YAML frontmatter and task blocks (simplified)
          const taskBlocks = content
            .split(/---\s*\n/)
            .filter((b) => b.includes("id:"));
          for (const block of taskBlocks) {
            const idMatch = block.match(/id:\s*["']?([^"'\n]+)/);
            const phaseMatch = block.match(/phase:\s*["']?([^"'\n]+)/);
            const actionMatch = block.match(/action:\s*["']?([^"'\n]+)/);
            const fileMatch = block.match(/file:\s*["']?([^"'\n]+)/);
            if (idMatch) {
              taskDefinitions.set(idMatch[1], {
                phase: phaseMatch?.[1],
                action: actionMatch?.[1],
                file: fileMatch?.[1],
              });
            }
          }
        } catch (e) {
          console.warn("[TasksAPI] Could not parse tasks.md:", e);
        }
      }
    }

    // Group tasks by status
    const columns: KanbanColumn[] = [
      { id: "pending", title: "Pending", tasks: [], count: 0 },
      { id: "in_progress", title: "In Progress", tasks: [], count: 0 },
      { id: "complete", title: "Complete", tasks: [], count: 0 },
      { id: "failed", title: "Failed", tasks: [], count: 0 },
      { id: "blocked", title: "Blocked", tasks: [], count: 0 },
    ];

    for (const te of taskExecutions) {
      const def = taskDefinitions.get(te.task_id) || {};
      const task: Task = {
        id: te.id,
        phase: def.phase || "unknown",
        action: def.action || "unknown",
        file: def.file || te.task_id,
        status: te.status as TaskStatus,
        requirements: [],
        dependsOn: [],
        startedAt: te.started_at || undefined,
        completedAt: te.completed_at || undefined,
        error: te.error || undefined,
        buildId: targetBuildId,
      };

      const column = columns.find((c) => c.id === te.status);
      if (column) {
        column.tasks.push(task);
        column.count++;
      }
    }

    res.json({
      buildId: targetBuildId,
      columns,
      totalTasks: taskExecutions.length,
    });
  } catch (error) {
    console.error("[TasksAPI] Error getting kanban:", error);
    res.status(500).json({ error: "Failed to get kanban board" });
  }
});

/**
 * GET /api/tasks/summary
 * Get task summary statistics
 */
router.get("/summary", async (_req: Request, res: Response): Promise<void> => {
  try {
    let summary: {
      total: number;
      pending: number;
      in_progress: number;
      complete: number;
      failed: number;
      blocked: number;
    } | null = null;

    try {
      summary = await getOne<{
        total: number;
        pending: number;
        in_progress: number;
        complete: number;
        failed: number;
        blocked: number;
      }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
          SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as complete,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
        FROM task_executions
        WHERE build_id = (SELECT id FROM build_executions ORDER BY created_at DESC LIMIT 1)
      `);
    } catch {
      // Table may not exist yet
    }

    res.json(
      summary || {
        total: 0,
        pending: 0,
        in_progress: 0,
        complete: 0,
        failed: 0,
        blocked: 0,
      },
    );
  } catch (error) {
    console.error("[TasksAPI] Error getting summary:", error);
    res.status(500).json({ error: "Failed to get task summary" });
  }
});

/**
 * GET /api/tasks/:id
 * Get detailed task information
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    let task: Record<string, unknown> | null = null;
    try {
      task = await getOne<Record<string, unknown>>(
        `
        SELECT
          te.*,
          be.spec_path,
          be.status as build_status
        FROM task_executions te
        JOIN build_executions be ON te.build_id = be.id
        WHERE te.id = ? OR te.task_id = ?
      `,
        [id, id],
      );
    } catch {
      // Table may not exist yet
    }

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error("[TasksAPI] Error getting task:", error);
    res.status(500).json({ error: "Failed to get task" });
  }
});

/**
 * PUT /api/tasks/:id/status
 * Update task status (for manual overrides)
 */
router.put(
  "/:id/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, error } = req.body;

      const validStatuses = [
        "pending",
        "in_progress",
        "complete",
        "failed",
        "blocked",
      ];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      try {
        await run(
          `
        UPDATE task_executions
        SET status = ?, error = ?, completed_at = CASE WHEN ? IN ('complete', 'failed') THEN datetime('now') ELSE completed_at END
        WHERE id = ?
      `,
          [status, error || null, status, id],
        );
      } catch {
        // Table may not exist yet
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[TasksAPI] Error updating task:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  },
);

/**
 * GET /api/tasks/from-file
 * Load tasks directly from a tasks.md file
 */
router.get("/from-file", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    // Simple YAML-like parser for tasks
    const tasks: Partial<Task>[] = [];
    const taskBlocks = content
      .split(/---\s*\n/)
      .filter((b) => b.trim().length > 0);

    for (const block of taskBlocks) {
      if (!block.includes("id:")) continue;

      const task: Partial<Task> = {
        status: "pending",
        requirements: [],
        dependsOn: [],
      };

      const lines = block.split("\n");
      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts
          .join(":")
          .trim()
          .replace(/^["']|["']$/g, "");

        switch (key.trim()) {
          case "id":
            task.id = value;
            break;
          case "phase":
            task.phase = value;
            break;
          case "action":
            task.action = value;
            break;
          case "file":
            task.file = value;
            break;
          case "status":
            task.status = value as TaskStatus;
            break;
          case "description":
            task.description = value;
            break;
        }
      }

      if (task.id) {
        tasks.push(task);
      }
    }

    res.json(tasks);
  } catch (error) {
    console.error("[TasksAPI] Error loading tasks from file:", error);
    res.status(500).json({ error: "Failed to load tasks" });
  }
});

export default router;
