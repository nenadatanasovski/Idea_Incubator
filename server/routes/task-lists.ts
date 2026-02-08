/**
 * Task List Management API Routes
 *
 * REST API for browsing, selecting, and managing task list files.
 */

import { Router, Request, Response } from "express";
import * as path from "path";
import * as fs from "fs";
import {
  parseTaskList,
  getTaskListsSummary,
  updateTaskStatus,
  addTask,
  getNextPendingTask,
  getTasksBySection,
  ParsedTask,
} from "../services/task-loader.js";
import { query } from "../../database/db.js";

const router = Router();

// Base path for the project
const BASE_PATH = process.cwd();

/**
 * GET /api/task-lists
 * List all available task list files with summaries
 */
router.get("/", (_req: Request, res: Response): void => {
  try {
    const summaries = getTaskListsSummary(BASE_PATH);
    res.json(summaries);
  } catch (error) {
    console.error("[TaskListsAPI] Error listing task lists:", error);
    res.status(500).json({ error: "Failed to list task lists" });
  }
});

/**
 * GET /api/task-lists/parse
 * Parse a specific task list file
 * Query params: path (file path)
 */
router.get("/parse", (req: Request, res: Response): void => {
  try {
    const { path: filePath } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    // Security: ensure path is within project
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const taskList = parseTaskList(absolutePath);
    res.json(taskList);
  } catch (error) {
    console.error("[TaskListsAPI] Error parsing task list:", error);
    res.status(500).json({ error: "Failed to parse task list" });
  }
});

/**
 * GET /api/task-lists/next
 * Get the next pending task from a task list
 * Query params: path (file path), priority (optional min priority P1-P4)
 */
router.get("/next", (req: Request, res: Response): void => {
  try {
    const { path: filePath, priority } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const taskList = parseTaskList(absolutePath);
    const minPriority = priority as "P1" | "P2" | "P3" | "P4" | undefined;
    const nextTask = getNextPendingTask(taskList, minPriority);

    res.json({
      task: nextTask,
      remaining: taskList.summary.pending,
      total: taskList.summary.total,
    });
  } catch (error) {
    console.error("[TaskListsAPI] Error getting next task:", error);
    res.status(500).json({ error: "Failed to get next task" });
  }
});

/**
 * GET /api/task-lists/section
 * Get tasks from a specific section
 * Query params: path (file path), section (section name)
 */
router.get("/section", (req: Request, res: Response): void => {
  try {
    const { path: filePath, section } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    if (!section || typeof section !== "string") {
      res.status(400).json({ error: "section query parameter is required" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const taskList = parseTaskList(absolutePath);
    const tasks = getTasksBySection(taskList, section);

    res.json({
      section,
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    console.error("[TaskListsAPI] Error getting section tasks:", error);
    res.status(500).json({ error: "Failed to get section tasks" });
  }
});

/**
 * PUT /api/task-lists/status
 * Update a task's status in the markdown file
 * Body: { path, taskId, status }
 */
router.put("/status", (req: Request, res: Response): void => {
  try {
    const { path: filePath, taskId, status } = req.body;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }

    if (!taskId || typeof taskId !== "string") {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    const validStatuses = ["pending", "in_progress", "complete"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: "Invalid status. Must be pending, in_progress, or complete",
      });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const success = updateTaskStatus(absolutePath, taskId, status);

    if (success) {
      res.json({
        success: true,
        message: `Task ${taskId} updated to ${status}`,
      });
    } else {
      res.status(404).json({ error: `Task ${taskId} not found in file` });
    }
  } catch (error) {
    console.error("[TaskListsAPI] Error updating task status:", error);
    res.status(500).json({ error: "Failed to update task status" });
  }
});

/**
 * POST /api/task-lists/task
 * Add a new task to a task list
 * Body: { path, section, id, description, priority }
 */
router.post("/task", (req: Request, res: Response): void => {
  try {
    const { path: filePath, section, id, description, priority } = req.body;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }

    if (!section || typeof section !== "string") {
      res.status(400).json({ error: "section is required" });
      return;
    }

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "id is required" });
      return;
    }

    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "description is required" });
      return;
    }

    const validPriorities = ["P1", "P2", "P3", "P4"];
    if (!validPriorities.includes(priority)) {
      res
        .status(400)
        .json({ error: "Invalid priority. Must be P1, P2, P3, or P4" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const success = addTask(absolutePath, section, {
      id,
      description,
      priority,
    });

    if (success) {
      res.json({
        success: true,
        message: `Task ${id} added to section ${section}`,
      });
    } else {
      res
        .status(404)
        .json({ error: `Section ${section} not found or has no table` });
    }
  } catch (error) {
    console.error("[TaskListsAPI] Error adding task:", error);
    res.status(500).json({ error: "Failed to add task" });
  }
});

/**
 * GET /api/task-lists/execution-queue
 * Get all pending tasks organized for execution
 * Query params: path (file path), limit (optional, default 10)
 */
router.get("/execution-queue", (req: Request, res: Response): void => {
  try {
    const { path: filePath, limit = "10" } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const taskList = parseTaskList(absolutePath);
    const maxLimit = parseInt(limit as string, 10);

    // Get pending tasks sorted by priority
    const pendingTasks = taskList.tasks
      .filter((t) => t.status === "pending")
      .sort((a, b) => {
        const priorityOrder = { P1: 1, P2: 2, P3: 3, P4: 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, maxLimit);

    // Get in-progress tasks
    const inProgressTasks = taskList.tasks.filter(
      (t) => t.status === "in_progress",
    );

    res.json({
      filePath: absolutePath,
      title: taskList.title,
      inProgress: inProgressTasks,
      queue: pendingTasks,
      summary: taskList.summary,
    });
  } catch (error) {
    console.error("[TaskListsAPI] Error getting execution queue:", error);
    res.status(500).json({ error: "Failed to get execution queue" });
  }
});

/**
 * Enriched task with execution metadata from database
 */
interface EnrichedTask extends ParsedTask {
  // Execution data from DB
  assignedAgent?: string;
  agentType?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  attempts?: number;
  error?: string;

  // Blocking info
  blockingQuestion?: {
    id: string;
    content: string;
    type: string;
    priority: string;
    createdAt: string;
    options?: string[];
  };

  // Computed fields
  isStuck?: boolean;
  stuckReason?: string;
  elapsedMs?: number;
}

/**
 * GET /api/task-lists/enriched
 * Get task list with enriched execution data from database
 * Query params: path (file path)
 */
router.get("/enriched", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.query;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path query parameter is required" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    // Parse markdown task list
    const taskList = parseTaskList(absolutePath);

    // Get execution data from task_queue
    const queueData = await query<{
      task_id: string;
      status: string;
      assigned_agent: string | null;
      attempts: number;
      started_at: string | null;
      completed_at: string | null;
      last_error: string | null;
    }>(
      `
      SELECT task_id, status, assigned_agent, attempts, started_at, completed_at, last_error
      FROM task_queue
      WHERE task_list_path = ?
    `,
      [absolutePath],
    );

    // Get agent binding data for active/recent tasks
    const bindingData = await query<{
      task_id: string;
      agent_id: string;
      agent_type: string;
      status: string;
      started_at: string | null;
      duration_ms: number | null;
    }>(
      `
      SELECT
        tq.task_id,
        tab.agent_id,
        tab.agent_type,
        tab.status,
        tab.started_at,
        tab.duration_ms
      FROM task_agent_bindings tab
      JOIN task_executions te ON tab.task_execution_id = te.id
      JOIN task_queue tq ON te.task_id = tq.task_id AND te.build_id = (
        SELECT MAX(build_id) FROM task_executions
        WHERE task_id = tq.task_id
      )
      WHERE tq.task_list_path = ?
      ORDER BY tab.assigned_at DESC
    `,
      [absolutePath],
    ).catch(() => []);

    // Get blocking questions for in-progress tasks
    const blockingQuestions = await query<{
      id: string;
      task_id: string;
      content: string;
      type: string;
      priority: number;
      options: string | null;
      created_at: string;
    }>(
      `
      SELECT id, task_id, content, type, priority, options, created_at
      FROM questions
      WHERE status = 'pending'
        AND blocking = 1
        AND task_list_name = ?
    `,
      [path.basename(absolutePath)],
    ).catch(() => []);

    // Create lookup maps
    const queueMap = new Map(queueData.map((q) => [q.task_id, q]));
    const bindingMap = new Map(bindingData.map((b) => [b.task_id, b]));
    const questionMap = new Map(blockingQuestions.map((q) => [q.task_id, q]));

    // Enrich tasks
    const enrichedTasks: EnrichedTask[] = taskList.tasks.map((task) => {
      const queueInfo = queueMap.get(task.id);
      const bindingInfo = bindingMap.get(task.id);
      const blockingQ = questionMap.get(task.id);

      const enriched: EnrichedTask = {
        ...task,
      };

      // Add execution data
      if (queueInfo) {
        enriched.assignedAgent = queueInfo.assigned_agent || undefined;
        enriched.startedAt = queueInfo.started_at || undefined;
        enriched.completedAt = queueInfo.completed_at || undefined;
        enriched.attempts = queueInfo.attempts;
        enriched.error = queueInfo.last_error || undefined;
      }

      // Add agent binding data
      if (bindingInfo) {
        enriched.agentType = bindingInfo.agent_type;
        enriched.durationMs = bindingInfo.duration_ms || undefined;
        // Prefer binding's started_at if available
        if (bindingInfo.started_at) {
          enriched.startedAt = bindingInfo.started_at;
        }
      }

      // Add blocking question
      if (blockingQ) {
        enriched.blockingQuestion = {
          id: blockingQ.id,
          content: blockingQ.content,
          type: blockingQ.type,
          priority:
            blockingQ.priority >= 8
              ? "critical"
              : blockingQ.priority >= 6
                ? "high"
                : "medium",
          createdAt: blockingQ.created_at,
          options: blockingQ.options
            ? JSON.parse(blockingQ.options)
            : undefined,
        };
      }

      // Compute stuck status for in-progress tasks
      if (task.status === "in_progress") {
        const now = Date.now();
        const startTime = enriched.startedAt
          ? new Date(enriched.startedAt).getTime()
          : 0;
        enriched.elapsedMs = startTime ? now - startTime : undefined;

        // Consider stuck if:
        // 1. Has blocking question
        // 2. Running for > 30 minutes with no agent
        // 3. Running for > 2 hours total
        if (blockingQ) {
          enriched.isStuck = true;
          enriched.stuckReason = "Awaiting human response";
        } else if (
          !enriched.assignedAgent &&
          enriched.elapsedMs &&
          enriched.elapsedMs > 30 * 60 * 1000
        ) {
          enriched.isStuck = true;
          enriched.stuckReason = "No agent assigned";
        } else if (
          enriched.elapsedMs &&
          enriched.elapsedMs > 2 * 60 * 60 * 1000
        ) {
          enriched.isStuck = true;
          enriched.stuckReason = "Running too long (>2h)";
        }
      }

      return enriched;
    });

    res.json({
      ...taskList,
      tasks: enrichedTasks,
      enriched: true,
    });
  } catch (error) {
    console.error("[TaskListsAPI] Error getting enriched task list:", error);
    res.status(500).json({ error: "Failed to get enriched task list" });
  }
});

/**
 * GET /api/task-lists/task-detail
 * Get the detailed markdown content for a specific task
 * Query params: id (task ID like COM-001)
 */
router.get("/task-detail", (req: Request, res: Response): void => {
  try {
    const { id } = req.query;

    if (!id || typeof id !== "string") {
      res.status(400).json({ error: "id query parameter is required" });
      return;
    }

    // Task detail files are in docs/bootstrap/tasks/{ID}.md
    const taskDetailPath = path.join(
      BASE_PATH,
      "docs/bootstrap/tasks",
      `${id}.md`,
    );

    // Check if file exists
    if (!fs.existsSync(taskDetailPath)) {
      res
        .status(404)
        .json({ error: "Task detail file not found", path: taskDetailPath });
      return;
    }

    const content = fs.readFileSync(taskDetailPath, "utf-8");

    // Parse basic metadata from the markdown
    let title = id;
    let summary = "";
    let requirements: string[] = [];
    let passCriteria: string[] = [];

    // Extract title from first h1
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1];
    }

    // Extract summary section
    const summaryMatch = content.match(
      /## Summary\n\n([\s\S]*?)(?=\n---|\n##)/,
    );
    if (summaryMatch) {
      summary = summaryMatch[1].trim();
    }

    // Extract requirements - get numbered items with their bold titles
    const reqMatch = content.match(
      /## Requirements\n\n([\s\S]*?)(?=\n---|\n##)/,
    );
    if (reqMatch) {
      const reqLines = reqMatch[1]
        .split("\n")
        .filter((l) => l.match(/^\d+\.\s/));
      requirements = reqLines
        .map((l) => {
          // Extract the bold title if present: "1. **Title**: description" -> "Title: description"
          const boldMatch = l.match(/^\d+\.\s*\*\*([^*]+)\*\*:?\s*(.*)/);
          if (boldMatch) {
            return boldMatch[2]
              ? `${boldMatch[1]}: ${boldMatch[2]}`
              : boldMatch[1];
          }
          // Otherwise just remove the number prefix
          return l.replace(/^\d+\.\s*/, "").trim();
        })
        .filter((r) => r.length > 0);
    }

    // Extract pass criteria
    const passMatch = content.match(
      /## Pass Criteria[\s\S]*?\| # \| Criterion[\s\S]*?\n([\s\S]*?)(?=\n\n\*\*FAIL|\n---|\n##)/,
    );
    if (passMatch) {
      const criteriaRows = passMatch[1]
        .split("\n")
        .filter((l) => l.startsWith("|"));
      passCriteria = criteriaRows
        .map((row) => {
          const cols = row
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c);
          return cols[1] || "";
        })
        .filter((c) => c);
    }

    res.json({
      id,
      title,
      summary,
      requirements,
      passCriteria,
      rawContent: content,
      filePath: taskDetailPath,
    });
  } catch (error) {
    console.error("[TaskListsAPI] Error fetching task detail:", error);
    res.status(500).json({ error: "Failed to fetch task detail" });
  }
});

export default router;
