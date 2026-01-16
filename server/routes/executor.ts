/**
 * Task Executor API Routes
 *
 * REST API for controlling autonomous task execution.
 */

import { Router, Request, Response } from "express";
import * as path from "path";
import {
  getTaskExecutor,
  createTaskExecutor,
} from "../services/task-executor.js";

const router = Router();
const BASE_PATH = process.cwd();

/**
 * GET /api/executor/status
 * Get current executor status
 */
router.get("/status", (_req: Request, res: Response): void => {
  try {
    const executor = getTaskExecutor();
    res.json(executor.getStatus());
  } catch (error) {
    console.error("[ExecutorAPI] Error getting status:", error);
    res.status(500).json({ error: "Failed to get executor status" });
  }
});

/**
 * POST /api/executor/load
 * Load a task list for execution
 * Body: { path: string }
 */
router.post("/load", async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath } = req.body;

    if (!filePath || typeof filePath !== "string") {
      res.status(400).json({ error: "path is required" });
      return;
    }

    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(BASE_PATH, filePath);

    if (!absolutePath.startsWith(BASE_PATH)) {
      res.status(403).json({ error: "Path must be within project directory" });
      return;
    }

    const executor = getTaskExecutor();
    const taskList = await executor.loadTaskList(absolutePath);

    res.json({
      success: true,
      message: `Loaded task list: ${taskList.title}`,
      summary: taskList.summary,
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error loading task list:", error);
    res.status(500).json({ error: "Failed to load task list" });
  }
});

/**
 * POST /api/executor/start
 * Start autonomous execution
 * Body: { config?: Partial<ExecutionConfig> }
 */
router.post("/start", async (req: Request, res: Response): Promise<void> => {
  try {
    const { config } = req.body;

    // Create new executor with config if provided
    if (config) {
      createTaskExecutor(config);
    }

    const executor = getTaskExecutor();

    // Check if task list is loaded
    const status = executor.getStatus();
    if (!status.taskListPath) {
      res.status(400).json({ error: "No task list loaded. Call /load first." });
      return;
    }

    await executor.start();

    res.json({
      success: true,
      message: "Executor started",
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error starting executor:", error);
    res.status(500).json({ error: "Failed to start executor" });
  }
});

/**
 * POST /api/executor/pause
 * Pause execution
 */
router.post("/pause", async (_req: Request, res: Response): Promise<void> => {
  try {
    const executor = getTaskExecutor();
    await executor.pause();

    res.json({
      success: true,
      message: "Executor paused",
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error pausing executor:", error);
    res.status(500).json({ error: "Failed to pause executor" });
  }
});

/**
 * POST /api/executor/resume
 * Resume execution
 */
router.post("/resume", async (_req: Request, res: Response): Promise<void> => {
  try {
    const executor = getTaskExecutor();
    await executor.resume();

    res.json({
      success: true,
      message: "Executor resumed",
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error resuming executor:", error);
    res.status(500).json({ error: "Failed to resume executor" });
  }
});

/**
 * POST /api/executor/stop
 * Stop execution
 */
router.post("/stop", async (_req: Request, res: Response): Promise<void> => {
  try {
    const executor = getTaskExecutor();
    await executor.stop();

    res.json({
      success: true,
      message: "Executor stopped",
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error stopping executor:", error);
    res.status(500).json({ error: "Failed to stop executor" });
  }
});

/**
 * GET /api/executor/next
 * Get the next task to be executed
 */
router.get("/next", (_req: Request, res: Response): void => {
  try {
    const executor = getTaskExecutor();
    const nextTask = executor.getNextTask();

    res.json({
      task: nextTask,
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error getting next task:", error);
    res.status(500).json({ error: "Failed to get next task" });
  }
});

/**
 * POST /api/executor/skip
 * Skip a specific task
 * Body: { taskId: string }
 */
router.post("/skip", async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.body;

    if (!taskId || typeof taskId !== "string") {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    const executor = getTaskExecutor();
    await executor.skipTask(taskId);

    res.json({
      success: true,
      message: `Task ${taskId} skipped`,
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error skipping task:", error);
    res.status(500).json({ error: "Failed to skip task" });
  }
});

/**
 * POST /api/executor/requeue
 * Requeue a failed task
 * Body: { taskId: string }
 */
router.post("/requeue", async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.body;

    if (!taskId || typeof taskId !== "string") {
      res.status(400).json({ error: "taskId is required" });
      return;
    }

    const executor = getTaskExecutor();
    await executor.requeueTask(taskId);

    res.json({
      success: true,
      message: `Task ${taskId} requeued`,
      status: executor.getStatus(),
    });
  } catch (error) {
    console.error("[ExecutorAPI] Error requeuing task:", error);
    res.status(500).json({ error: "Failed to requeue task" });
  }
});

/**
 * POST /api/executor/execute-one
 * Execute a single task manually (without starting the executor loop)
 * Body: { taskId: string } or auto-select next task if not provided
 */
router.post(
  "/execute-one",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId } = req.body;
      const executor = getTaskExecutor();
      const status = executor.getStatus();

      if (!status.taskListPath) {
        res.status(400).json({ error: "No task list loaded" });
        return;
      }

      let task;
      if (taskId) {
        // Find specific task - would need to reload task list
        const { parseTaskList } = await import("../services/task-loader.js");
        const taskList = parseTaskList(status.taskListPath);
        task = taskList.tasks.find((t) => t.id === taskId);
        if (!task) {
          res.status(404).json({ error: `Task ${taskId} not found` });
          return;
        }
      } else {
        task = executor.getNextTask();
        if (!task) {
          res.status(404).json({ error: "No pending tasks available" });
          return;
        }
      }

      const execution = await executor.executeTask(task);

      res.json({
        success: execution.status === "completed",
        execution,
        status: executor.getStatus(),
      });
    } catch (error) {
      console.error("[ExecutorAPI] Error executing task:", error);
      res.status(500).json({ error: "Failed to execute task" });
    }
  },
);

export default router;
