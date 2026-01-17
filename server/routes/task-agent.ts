/**
 * Task Agent API Routes
 *
 * Exposes the Parallel Task Execution services via REST API.
 *
 * Routes:
 * - POST /api/task-agent/tasks - Create a new task (listless or in list)
 * - GET /api/task-agent/evaluation-queue - Get tasks in Evaluation Queue
 * - GET /api/task-agent/evaluation-queue/stats - Get queue statistics
 * - POST /api/task-agent/tasks/:id/move - Move task to a task list
 * - GET /api/task-agent/grouping-suggestions - Get grouping suggestions
 * - POST /api/task-agent/grouping-suggestions/:id/accept - Accept suggestion
 * - POST /api/task-agent/grouping-suggestions/:id/reject - Reject suggestion
 * - GET /api/task-agent/task-lists/:id/parallelism - Get parallelism analysis
 * - POST /api/task-agent/task-lists/:id/execute - Start parallel execution
 *
 * Part of: Phase 8 API Implementation
 */

import { Router, Request, Response } from "express";

// Import services
import evaluationQueueManager from "../services/task-agent/evaluation-queue-manager.js";
import taskCreationService from "../services/task-agent/task-creation-service.js";
import taskAnalysisPipeline from "../services/task-agent/task-analysis-pipeline.js";
import autoGroupingEngine from "../services/task-agent/auto-grouping-engine.js";
import parallelismCalculator from "../services/task-agent/parallelism-calculator.js";
import buildAgentOrchestrator from "../services/task-agent/build-agent-orchestrator.js";
import circularDependencyPrevention from "../services/task-agent/circular-dependency-prevention.js";

// Import sub-routers (Task System V2)
import taskImpactsRouter from "./task-agent/task-impacts.js";
import taskAppendicesRouter from "./task-agent/task-appendices.js";
import taskVersionsRouter from "./task-agent/task-versions.js";
import taskCascadeRouter from "./task-agent/task-cascade.js";
import taskTestsRouter from "./task-agent/task-tests.js";
import taskHistoryRouter from "./task-agent/task-history.js";

const router = Router();

// Mount sub-routers
router.use("/tasks", taskImpactsRouter); // /api/task-agent/tasks/:taskId/impacts
router.use("/tasks", taskAppendicesRouter); // /api/task-agent/tasks/:taskId/appendices
router.use("/tasks", taskVersionsRouter); // /api/task-agent/tasks/:taskId/versions
router.use("/tasks", taskCascadeRouter); // /api/task-agent/tasks/:taskId/cascade
router.use("/tasks", taskTestsRouter); // /api/task-agent/tasks/:taskId/tests
router.use("/tasks", taskHistoryRouter); // /api/task-agent/tasks/:taskId/history

/**
 * Create a new task
 * POST /api/task-agent/tasks
 *
 * Body: { title, description?, projectId?, category?, targetTaskListId? }
 */
router.post("/tasks", async (req: Request, res: Response) => {
  try {
    const { title, description, projectId, category, targetTaskListId } =
      req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Title is required" });
    }

    let task;

    if (targetTaskListId) {
      // Create directly in task list
      task = await taskCreationService.createTaskInList({
        title,
        description,
        projectId,
        category,
        taskListId: targetTaskListId,
      });
    } else {
      // Create in Evaluation Queue (listless)
      task = await taskCreationService.createListlessTask({
        title,
        description,
        projectId,
        category,
      });
    }

    // Run analysis pipeline asynchronously
    taskAnalysisPipeline.analyzeTask(task.task.id).catch(console.error);

    return res.status(201).json(task);
  } catch (err) {
    console.error("[task-agent] Error creating task:", err);
    return res.status(500).json({
      error: "Failed to create task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get tasks in Evaluation Queue
 * GET /api/task-agent/evaluation-queue
 */
router.get("/evaluation-queue", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const tasks = await evaluationQueueManager.getQueuedTasks(projectId);
    return res.json(tasks);
  } catch (err) {
    console.error("[task-agent] Error getting evaluation queue:", err);
    return res.status(500).json({
      error: "Failed to get evaluation queue",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get Evaluation Queue statistics
 * GET /api/task-agent/evaluation-queue/stats
 */
router.get("/evaluation-queue/stats", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const stats = await evaluationQueueManager.getQueueStats(projectId);
    return res.json(stats);
  } catch (err) {
    console.error("[task-agent] Error getting queue stats:", err);
    return res.status(500).json({
      error: "Failed to get queue stats",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get stale tasks in Evaluation Queue
 * GET /api/task-agent/evaluation-queue/stale
 */
router.get("/evaluation-queue/stale", async (req: Request, res: Response) => {
  try {
    const daysThreshold = parseInt(req.query.days as string) || 3;
    const tasks =
      await evaluationQueueManager.getStaleQueuedTasks(daysThreshold);
    return res.json(tasks);
  } catch (err) {
    console.error("[task-agent] Error getting stale tasks:", err);
    return res.status(500).json({
      error: "Failed to get stale tasks",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Move task to a task list
 * POST /api/task-agent/tasks/:id/move
 *
 * Body: { taskListId }
 */
router.post("/tasks/:id/move", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { taskListId } = req.body;

    if (!taskListId) {
      return res.status(400).json({ error: "taskListId is required" });
    }

    // Check for circular dependencies
    const cycleCheck = await circularDependencyPrevention.checkNearCycles(id);
    if (cycleCheck.length > 0) {
      return res.status(400).json({
        error: "Moving this task would create circular dependencies",
        cycles: cycleCheck,
      });
    }

    await evaluationQueueManager.moveToTaskList(id, taskListId);

    return res.json({ success: true, taskId: id, taskListId });
  } catch (err) {
    console.error("[task-agent] Error moving task:", err);
    return res.status(500).json({
      error: "Failed to move task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GAP-004: Diagnose a failed task for SIA
 * GET /api/task-agent/tasks/:id/diagnose
 *
 * Returns comprehensive diagnostic context including:
 * - Task info and state
 * - Execution history
 * - Error patterns
 * - Related gotchas from knowledge base
 */
router.get("/tasks/:id/diagnose", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const context = await buildAgentOrchestrator.getDiagnosisContext(id);

    if (!context.taskInfo) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.json(context);
  } catch (err) {
    console.error("[task-agent] Error diagnosing task:", err);
    return res.status(500).json({
      error: "Failed to diagnose task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * GAP-004: Retry a failed task with context from previous execution
 * POST /api/task-agent/tasks/:id/retry
 *
 * Spawns a new build agent with resume context from previous attempts.
 */
router.post("/tasks/:id/retry", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get task info to find task list
    const { getOne } = await import("../../database/db.js");
    const task = await getOne<{ task_list_id: string | null }>(
      "SELECT task_list_id FROM tasks WHERE id = ?",
      [id],
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!task.task_list_id) {
      return res.status(400).json({
        error: "Task must be in a task list to be retried",
      });
    }

    const agent = await buildAgentOrchestrator.retryTaskWithContext(
      id,
      task.task_list_id,
    );

    return res.json({
      success: true,
      taskId: id,
      agentId: agent.id,
    });
  } catch (err) {
    console.error("[task-agent] Error retrying task:", err);
    return res.status(500).json({
      error: "Failed to retry task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get grouping suggestions
 * GET /api/task-agent/grouping-suggestions
 */
router.get("/grouping-suggestions", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const suggestions =
      await autoGroupingEngine.getPendingSuggestions(projectId);
    return res.json(suggestions);
  } catch (err) {
    console.error("[task-agent] Error getting suggestions:", err);
    return res.status(500).json({
      error: "Failed to get suggestions",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Trigger grouping analysis
 * POST /api/task-agent/grouping-suggestions/analyze
 */
router.post(
  "/grouping-suggestions/analyze",
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.body;
      const suggestions = await autoGroupingEngine.analyzeTasks(projectId);
      return res.json(suggestions);
    } catch (err) {
      console.error("[task-agent] Error analyzing for grouping:", err);
      return res.status(500).json({
        error: "Failed to analyze for grouping",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Accept grouping suggestion
 * POST /api/task-agent/grouping-suggestions/:id/accept
 */
router.post(
  "/grouping-suggestions/:id/accept",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await autoGroupingEngine.acceptSuggestion(id);
      return res.json(result);
    } catch (err) {
      console.error("[task-agent] Error accepting suggestion:", err);
      return res.status(500).json({
        error: "Failed to accept suggestion",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Reject grouping suggestion
 * POST /api/task-agent/grouping-suggestions/:id/reject
 */
router.post(
  "/grouping-suggestions/:id/reject",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await autoGroupingEngine.rejectSuggestion(id);
      return res.json({ success: true });
    } catch (err) {
      console.error("[task-agent] Error rejecting suggestion:", err);
      return res.status(500).json({
        error: "Failed to reject suggestion",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Get parallelism analysis for a task list
 * GET /api/task-agent/task-lists/:id/parallelism
 */
router.get(
  "/task-lists/:id/parallelism",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parallelism =
        await parallelismCalculator.getTaskListParallelism(id);
      return res.json(parallelism);
    } catch (err) {
      console.error("[task-agent] Error getting parallelism:", err);
      return res.status(500).json({
        error: "Failed to get parallelism analysis",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Calculate execution waves for a task list
 * POST /api/task-agent/task-lists/:id/waves
 */
router.post("/task-lists/:id/waves", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const waves = await parallelismCalculator.calculateWaves(id);
    return res.json(waves);
  } catch (err) {
    console.error("[task-agent] Error calculating waves:", err);
    return res.status(500).json({
      error: "Failed to calculate waves",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Start parallel execution for a task list
 * POST /api/task-agent/task-lists/:id/execute
 */
router.post("/task-lists/:id/execute", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { maxConcurrent } = req.body;

    await buildAgentOrchestrator.startExecution(id, maxConcurrent);
    return res.json({ success: true, taskListId: id, status: "executing" });
  } catch (err) {
    console.error("[task-agent] Error starting execution:", err);
    return res.status(500).json({
      error: "Failed to start execution",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Stop execution for a task list
 * POST /api/task-agent/task-lists/:id/stop
 */
router.post("/task-lists/:id/stop", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await buildAgentOrchestrator.pauseExecution(id);
    return res.json({ success: true, taskListId: id, status: "stopped" });
  } catch (err) {
    console.error("[task-agent] Error stopping execution:", err);
    return res.status(500).json({
      error: "Failed to stop execution",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get active Build Agents
 * GET /api/task-agent/agents
 */
router.get("/agents", async (req: Request, res: Response) => {
  try {
    const taskListId = req.query.taskListId as string | undefined;
    const agents = await buildAgentOrchestrator.getActiveAgents(taskListId);
    return res.json(agents);
  } catch (err) {
    console.error("[task-agent] Error getting agents:", err);
    return res.status(500).json({
      error: "Failed to get agents",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Record agent heartbeat
 * POST /api/task-agent/agents/:id/heartbeat
 *
 * Body: { status, taskId?, progressPercent?, currentStep?, memoryMb?, cpuPercent? }
 */
router.post("/agents/:id/heartbeat", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      taskId,
      progressPercent,
      currentStep,
      memoryMb,
      cpuPercent,
    } = req.body;

    await buildAgentOrchestrator.recordHeartbeat({
      agentId: id,
      status: status || "running",
      taskId,
      progressPercent,
      currentStep,
      memoryMb,
      cpuPercent,
      recordedAt: new Date().toISOString(),
    });
    return res.json({ success: true });
  } catch (err) {
    console.error("[task-agent] Error recording heartbeat:", err);
    return res.status(500).json({
      error: "Failed to record heartbeat",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Check for circular dependencies
 * POST /api/task-agent/dependencies/check-cycle
 *
 * Body: { sourceTaskId, targetTaskId }
 */
router.post(
  "/dependencies/check-cycle",
  async (req: Request, res: Response) => {
    try {
      const { sourceTaskId, targetTaskId } = req.body;

      if (!sourceTaskId || !targetTaskId) {
        return res
          .status(400)
          .json({ error: "sourceTaskId and targetTaskId are required" });
      }

      const result = await circularDependencyPrevention.wouldCreateCycle(
        sourceTaskId,
        targetTaskId,
      );
      return res.json(result);
    } catch (err) {
      console.error("[task-agent] Error checking cycle:", err);
      return res.status(500).json({
        error: "Failed to check for cycles",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Detect existing cycles in the dependency graph
 * GET /api/task-agent/dependencies/cycles
 */
router.get("/dependencies/cycles", async (req: Request, res: Response) => {
  try {
    const projectId = req.query.projectId as string | undefined;
    const cycles =
      await circularDependencyPrevention.detectExistingCycles(projectId);
    return res.json(cycles);
  } catch (err) {
    console.error("[task-agent] Error detecting cycles:", err);
    return res.status(500).json({
      error: "Failed to detect cycles",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Apply a cycle resolution
 * POST /api/task-agent/dependencies/resolve-cycle
 *
 * Body: { sourceTaskId, targetTaskId }
 */
router.post(
  "/dependencies/resolve-cycle",
  async (req: Request, res: Response) => {
    try {
      const { sourceTaskId, targetTaskId } = req.body;

      if (!sourceTaskId || !targetTaskId) {
        return res
          .status(400)
          .json({ error: "sourceTaskId and targetTaskId are required" });
      }

      const success = await circularDependencyPrevention.applyResolution(
        sourceTaskId,
        targetTaskId,
      );
      return res.json({ success });
    } catch (err) {
      console.error("[task-agent] Error resolving cycle:", err);
      return res.status(500).json({
        error: "Failed to resolve cycle",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Add dependency between tasks (with cycle check)
 * POST /api/task-agent/dependencies
 *
 * Body: { sourceTaskId, targetTaskId }
 */
router.post("/dependencies", async (req: Request, res: Response) => {
  try {
    const { sourceTaskId, targetTaskId } = req.body;

    if (!sourceTaskId || !targetTaskId) {
      return res
        .status(400)
        .json({ error: "sourceTaskId and targetTaskId are required" });
    }

    const result = await circularDependencyPrevention.safeAddDependency(
      sourceTaskId,
      targetTaskId,
    );

    if (!result.added) {
      return res.status(400).json({
        error: "Adding this dependency would create a cycle",
        cycleDetected: result.cycleDetected,
      });
    }

    return res.json({ success: true, added: true });
  } catch (err) {
    console.error("[task-agent] Error adding dependency:", err);
    return res.status(500).json({
      error: "Failed to add dependency",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get task dependencies
 * GET /api/task-agent/tasks/:id/dependencies
 */
router.get("/tasks/:id/dependencies", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dependencies =
      await circularDependencyPrevention.getTaskDependencies(id);
    return res.json(dependencies);
  } catch (err) {
    console.error("[task-agent] Error getting dependencies:", err);
    return res.status(500).json({
      error: "Failed to get dependencies",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
