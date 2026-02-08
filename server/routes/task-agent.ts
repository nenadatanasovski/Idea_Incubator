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
import { getOne } from "../../database/db.js";

// Import services
import evaluationQueueManager from "../services/task-agent/evaluation-queue-manager.js";
import taskCreationService from "../services/task-agent/task-creation-service.js";
import * as taskAutoInitService from "../services/task-agent/task-auto-initialization-service.js";
import taskAnalysisPipeline from "../services/task-agent/task-analysis-pipeline.js";
import autoGroupingEngine from "../services/task-agent/auto-grouping-engine.js";
import parallelismCalculator from "../services/task-agent/parallelism-calculator.js";
import buildAgentOrchestrator from "../services/task-agent/build-agent-orchestrator.js";
import circularDependencyPrevention from "../services/task-agent/circular-dependency-prevention.js";
import taskDecomposer from "../services/task-agent/task-decomposer.js";
import {
  emitDecompositionStarted,
  emitDecompositionCompleted,
  emitDecompositionFailed,
} from "../websocket.js";
import { eventService } from "../services/event-service.js";

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
    const {
      title,
      description,
      projectId,
      category,
      targetTaskListId,
      prdId,
      requirementRef,
    } = req.body;

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

    // Auto-initialize task with effort, priority, file impacts, and acceptance criteria
    // This runs SYNCHRONOUSLY so the data is available immediately in the response
    let autoInitResult: taskAutoInitService.AutoInitResult | null = null;
    try {
      autoInitResult = await taskAutoInitService.initializeAndApply({
        taskId: task.task.id,
        title,
        description,
        category: category || "task",
        projectId,
        prdId,
        requirementRef,
      });
      console.log(
        `[task-agent] Auto-initialized task ${task.task.displayId}: ` +
          `effort=${autoInitResult.effort}, priority=${autoInitResult.priority}, ` +
          `files=${autoInitResult.fileImpacts.length}, AC=${autoInitResult.acceptanceCriteria.length}`,
      );
    } catch (err) {
      console.warn(
        "[task-agent] Auto-initialization failed, using defaults:",
        err,
      );
    }

    // Run analysis pipeline asynchronously (for relationships, duplicates, grouping)
    taskAnalysisPipeline.analyzeTask(task.task.id).catch(console.error);

    // Emit task_created event
    eventService
      .emitEvent({
        type: "task_created",
        source: "task-agent",
        payload: {
          taskId: task.task.id,
          displayId: task.task.displayId,
          title: task.task.title,
          taskListId: targetTaskListId || null,
          inEvaluationQueue: !targetTaskListId,
        },
        taskId: task.task.id,
        projectId: projectId || undefined,
      })
      .catch(console.error);

    // Return enriched response with auto-initialized data
    return res.status(201).json({
      ...task,
      task: {
        ...task.task,
        // Override with auto-calculated values if available
        effort: autoInitResult?.effort || task.task.effort,
        priority: autoInitResult?.priority || task.task.priority,
        phase: autoInitResult?.phase || task.task.phase,
      },
      // Include auto-populated data for immediate display
      autoPopulated: autoInitResult
        ? {
            fileImpacts: autoInitResult.fileImpacts,
            acceptanceCriteria: autoInitResult.acceptanceCriteria,
            effort: autoInitResult.effort,
            priority: autoInitResult.priority,
            phase: autoInitResult.phase,
          }
        : null,
    });
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

    // Emit task_moved event
    eventService
      .emitEvent({
        type: "task_moved",
        source: "task-agent",
        payload: {
          taskId: id,
          targetTaskListId: taskListId,
          fromEvaluationQueue: true,
        },
        taskId: id,
      })
      .catch(console.error);

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
 * Decompose a task into atomic subtasks
 * POST /api/task-agent/tasks/:id/decompose
 *
 * Analyzes the task and generates decomposition suggestions with:
 * - PRD/spec context loading
 * - Intelligent AC splitting
 * - Test command distribution per subtask type
 *
 * Guards against infinite decomposition:
 * - Cannot decompose tasks that are already decomposed (status = "skipped")
 * - Cannot decompose subtasks (tasks with child_of relationship)
 */
router.post("/tasks/:id/decompose", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getOne } = await import("../../database/db.js");

    // Check if task exists and is not already decomposed
    const task = await getOne<{ id: string; status: string; title: string }>(
      "SELECT id, status, title FROM tasks WHERE id = ?",
      [id],
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // Guard 1: Prevent re-decomposition of already decomposed tasks
    if (task.status === "skipped") {
      return res.status(400).json({
        error: "Task already decomposed",
        message:
          "This task has already been decomposed and marked as skipped. Edit or delete its subtasks instead.",
      });
    }

    // Guard 2: Prevent decomposition of subtasks (tasks that are children of decomposed parents)
    const isSubtask = await getOne<{ id: string }>(
      `SELECT id FROM task_relationships
       WHERE source_task_id = ? AND relationship_type = 'child_of'
       LIMIT 1`,
      [id],
    );

    if (isSubtask) {
      return res.status(400).json({
        error: "Cannot decompose subtask",
        message:
          "This task is a subtask from a previous decomposition. Complete it or modify it directly instead of decomposing further.",
      });
    }

    const result = await taskDecomposer.decompose(id);

    // Transform to frontend-expected format
    return res.json({
      originalTaskId: result.originalTaskId,
      subtasks: result.suggestedTasks.map((s) => ({
        title: s.title,
        description: s.description,
        category: s.category,
        estimatedEffort: s.estimatedEffort,
        fileImpacts: s.impacts.map((i) => i.targetPath),
        acceptanceCriteria: s.acceptanceCriteria,
        testCommands: s.testCommands,
        dependsOnIndex: s.dependsOnIndex,
      })),
      reasoning: result.decompositionReason,
      estimatedTotalEffort: result.totalEstimatedEffort,
      contextUsed: result.contextUsed,
    });
  } catch (err) {
    console.error("[task-agent] Error decomposing task:", err);
    return res.status(500).json({
      error: "Failed to decompose task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Preview task decomposition (dry-run)
 * GET /api/task-agent/tasks/:id/decompose/preview
 *
 * Returns what decomposition would create without executing
 */
router.get(
  "/tasks/:id/decompose/preview",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await taskDecomposer.preview(id);

      return res.json({
        originalTaskId: result.originalTaskId,
        subtasks: result.suggestedTasks.map((s) => ({
          title: s.title,
          description: s.description,
          category: s.category,
          estimatedEffort: s.estimatedEffort,
          fileImpacts: s.impacts.map((i) => i.targetPath),
          acceptanceCriteria: s.acceptanceCriteria,
          testCommands: s.testCommands,
          dependsOnIndex: s.dependsOnIndex,
          sourceContext: s.sourceContext,
        })),
        reasoning: result.decompositionReason,
        estimatedTotalEffort: result.totalEstimatedEffort,
        contextUsed: result.contextUsed,
        isPreview: true,
      });
    } catch (err) {
      console.error("[task-agent] Error previewing decomposition:", err);
      return res.status(500).json({
        error: "Failed to preview decomposition",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Execute task decomposition with user-edited subtasks
 * POST /api/task-agent/tasks/:id/decompose/execute
 *
 * Body: { subtasks: Array<ProposedSubtask> }
 *
 * Creates actual subtasks and marks original as skipped
 */
router.post(
  "/tasks/:id/decompose/execute",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { subtasks } = req.body;

      if (!subtasks || !Array.isArray(subtasks)) {
        return res.status(400).json({ error: "subtasks array is required" });
      }

      const taskId = id;

      // Import type for proper type annotation
      type TaskCategory =
        | "feature"
        | "bug"
        | "task"
        | "story"
        | "epic"
        | "spike"
        | "improvement"
        | "documentation"
        | "test"
        | "devops"
        | "design"
        | "research"
        | "infrastructure"
        | "security"
        | "performance"
        | "other";

      // Convert frontend format to EnhancedSplitSuggestion format
      const splits = subtasks.map(
        (s: {
          title: string;
          description?: string;
          category: string;
          estimatedEffort: string;
          fileImpacts: string[];
          acceptanceCriteria: string[];
          testCommands?: string[];
          dependsOnIndex?: number;
        }) => ({
          title: s.title,
          description: s.description || "",
          category: s.category as TaskCategory,
          estimatedEffort: s.estimatedEffort as string,
          dependencies:
            s.dependsOnIndex !== undefined ? [s.dependsOnIndex.toString()] : [],
          dependsOnIndex: s.dependsOnIndex,
          impacts: (s.fileImpacts || []).map((fp: string) => ({
            taskId: "",
            impactType: "file" as const,
            operation: "UPDATE" as const,
            targetPath: fp,
          })),
          acceptanceCriteria: s.acceptanceCriteria || [],
          testCommands: s.testCommands || [],
          sourceContext: {
            reasoning: "User-edited decomposition",
          },
        }),
      );

      // Emit WebSocket event for decomposition start
      emitDecompositionStarted(taskId, taskId, "User-initiated decomposition");

      const createdTasks = await taskDecomposer.executeDecomposition(
        taskId,
        splits,
      );

      // Emit WebSocket event for decomposition completion
      emitDecompositionCompleted(
        taskId,
        taskId,
        createdTasks.map((t) => t.id),
        createdTasks.length,
      );

      // Invalidate readiness cache for the parent task
      // This ensures UI shows updated status immediately
      const { taskReadinessService } =
        await import("../services/task-agent/task-readiness-service.js");
      await taskReadinessService.invalidateCache(taskId);

      return res.json({
        success: true,
        subtaskIds: createdTasks.map((t) => t.id),
        parentStatus: "skipped",
        createdCount: createdTasks.length,
      });
    } catch (err) {
      const taskId = req.params.id;
      console.error("[task-agent] Error executing decomposition:", err);

      // Emit WebSocket event for decomposition failure
      emitDecompositionFailed(
        taskId,
        taskId,
        err instanceof Error ? err.message : "Unknown error",
      );

      return res.status(500).json({
        error: "Failed to execute decomposition",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

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
 * Force recalculate parallelism analysis for a task list
 * POST /api/task-agent/task-lists/:id/parallelism/recalculate
 *
 * Query params:
 * - fix=true: Auto-resolve file conflicts by adding dependencies
 *
 * Returns conflict details with task info for UI display
 */
router.post(
  "/task-lists/:id/parallelism/recalculate",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const shouldFix = req.query.fix === "true";

      let analyses;
      let resolutions: Array<{
        taskAId: string;
        taskBId: string;
        resolution: string;
        dependencyDirection?: string;
      }> = [];
      let waves;

      if (shouldFix) {
        // Use analyzeAndResolve to fix conflicts
        const result = await parallelismCalculator.analyzeAndResolve(id, true);
        analyses = result.analyses;
        resolutions = result.resolutions;
        waves = result.waves;
      } else {
        // Just analyze without fixing
        analyses = await parallelismCalculator.analyzeParallelism(id, true);
        waves = await parallelismCalculator.calculateWaves(id);
      }

      const maxParallel = Math.max(...waves.map((w) => w.taskCount), 0);

      // Get file conflicts (not dependencies)
      const fileConflicts = analyses.filter(
        (a) => !a.canParallel && a.conflictType === "file_conflict",
      );
      const dependencyCount = analyses.filter(
        (a) => !a.canParallel && a.conflictType === "dependency",
      ).length;

      // Get task info for conflicts
      const taskIds = new Set<string>();
      fileConflicts.forEach((a) => {
        taskIds.add(a.taskAId);
        taskIds.add(a.taskBId);
      });

      const taskInfoMap = new Map<
        string,
        { displayId: string; title: string }
      >();
      if (taskIds.size > 0) {
        const { query: dbQuery } = await import("../../database/db.js");
        const taskIdArray = Array.from(taskIds);
        const placeholders = taskIdArray.map(() => "?").join(",");
        const taskRows = await dbQuery<{
          id: string;
          display_id: string;
          title: string;
        }>(
          `SELECT id, display_id, title FROM tasks WHERE id IN (${placeholders})`,
          taskIdArray,
        );
        taskRows.forEach((t) => {
          taskInfoMap.set(t.id, { displayId: t.display_id, title: t.title });
        });
      }

      // Build enriched conflicts array
      const conflicts = fileConflicts.map((a) => {
        const taskA = taskInfoMap.get(a.taskAId);
        const taskB = taskInfoMap.get(a.taskBId);
        const conflictingFiles = a.conflictDetails?.conflictingFiles || [];
        const firstFile = conflictingFiles[0];

        return {
          id: a.id,
          taskAId: a.taskAId,
          taskADisplayId: taskA?.displayId || a.taskAId.slice(0, 8),
          taskATitle: taskA?.title || "Unknown",
          taskBId: a.taskBId,
          taskBDisplayId: taskB?.displayId || a.taskBId.slice(0, 8),
          taskBTitle: taskB?.title || "Unknown",
          conflictType: "file_conflict",
          filePath: firstFile?.filePath,
          operationA: firstFile?.operationA,
          operationB: firstFile?.operationB,
          allFileConflicts: conflictingFiles,
        };
      });

      const resolvedCount = resolutions.filter(
        (r) => r.resolution === "dependency_added",
      ).length;

      return res.json({
        taskListId: id,
        totalWaves: waves.length,
        maxParallel,
        conflictCount: fileConflicts.length,
        dependencyCount,
        conflicts,
        resolution: shouldFix
          ? {
              resolved: resolvedCount,
              total: resolutions.length,
              details: resolutions,
            }
          : null,
        analysesCount: analyses.length,
        waves,
        recalculatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[task-agent] Error recalculating parallelism:", err);
      return res.status(500).json({
        error: "Failed to recalculate parallelism",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Get parallelism preview (wave breakdown without starting execution)
 * GET /api/task-agent/task-lists/:id/parallelism/preview
 *
 * Returns detailed wave breakdown and optimization suggestions
 */
router.get(
  "/task-lists/:id/parallelism/preview",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      // Get parallelism analysis
      const analysis = await parallelismCalculator.getTaskListParallelism(id);
      const maxParallel = await parallelismCalculator.getMaxParallelism(id);

      // Calculate optimization suggestions
      const suggestions: string[] = [];
      if (analysis.totalWaves > 1 && analysis.parallelOpportunities > 0) {
        suggestions.push(
          `Consider increasing max parallel agents to ${maxParallel} to reduce execution time`,
        );
      }
      if (analysis.totalWaves === analysis.totalTasks) {
        suggestions.push(
          "All tasks are sequential - check for unnecessary dependencies or file conflicts",
        );
      }

      // Estimate time savings (rough calculation)
      const sequentialTime = analysis.totalTasks; // 1 unit per task
      const parallelTime = analysis.totalWaves; // Waves run in parallel
      const timeSavingsPercent =
        analysis.totalTasks > 0
          ? Math.round((1 - parallelTime / sequentialTime) * 100)
          : 0;

      return res.json({
        taskListId: id,
        totalTasks: analysis.totalTasks,
        totalWaves: analysis.totalWaves,
        maxParallel,
        parallelOpportunities: analysis.parallelOpportunities,
        timeSavingsPercent,
        waves: analysis.waves.map((wave) => ({
          waveNumber: wave.waveNumber,
          taskCount: wave.taskCount,
          tasks: wave.tasks,
          status: wave.status,
        })),
        suggestions,
        canExecute: analysis.totalTasks > 0,
        previewedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[task-agent] Error getting parallelism preview:", err);
      return res.status(500).json({
        error: "Failed to get parallelism preview",
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
 *
 * Body: {
 *   maxConcurrent?: number,
 *   allowIncomplete?: boolean  // Override readiness gate
 * }
 *
 * Hard Gate: Tasks below 70% readiness will block execution unless allowIncomplete=true
 */
router.post("/task-lists/:id/execute", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { maxConcurrent, allowIncomplete = false } = req.body;

    // Import readiness service
    const { taskReadinessService } =
      await import("../services/task-agent/task-readiness-service.js");

    // Check readiness for all tasks in the list
    const readinessResult =
      await taskReadinessService.calculateBulkReadiness(id);

    // Find incomplete tasks
    const incompleteTasks: Array<{
      id: string;
      readiness: number;
      missingItems: string[];
    }> = [];

    for (const [taskId, score] of readinessResult.tasks) {
      if (!score.isReady) {
        incompleteTasks.push({
          id: taskId,
          readiness: score.overall,
          missingItems: score.missingItems,
        });
      }
    }

    // Hard gate enforcement
    if (incompleteTasks.length > 0 && !allowIncomplete) {
      // Log the blocked attempt
      console.warn(
        `[task-agent] Execution blocked: ${incompleteTasks.length} tasks below 70% readiness`,
      );

      return res.status(400).json({
        error: "EXECUTION_BLOCKED",
        reason: "INCOMPLETE_TASKS",
        message: `${incompleteTasks.length} task(s) are below 70% readiness threshold`,
        taskCount: incompleteTasks.length,
        threshold: 70,
        incompleteTasks: incompleteTasks.slice(0, 10), // Return first 10
        summary: readinessResult.summary,
        suggestion:
          "Complete missing fields or set allowIncomplete=true to override",
      });
    }

    // Log override attempt if applicable
    if (incompleteTasks.length > 0 && allowIncomplete) {
      console.warn(
        `[task-agent] Execution override: Proceeding with ${incompleteTasks.length} incomplete tasks`,
      );

      // Log override for audit
      try {
        const { run } = await import("../../database/db.js");
        const { v4: uuidv4 } = await import("uuid");

        await run(
          `INSERT INTO execution_override_log (id, task_list_id, incomplete_count, override_type, created_at)
           VALUES (?, ?, ?, 'allow_incomplete', datetime('now'))`,
          [uuidv4(), id, incompleteTasks.length],
        );
      } catch {
        // Table might not exist, log warning but continue
        console.warn("[task-agent] Could not log execution override");
      }
    }

    await buildAgentOrchestrator.startExecution(id, maxConcurrent);
    return res.json({
      success: true,
      taskListId: id,
      status: "executing",
      readiness: {
        total: readinessResult.summary.total,
        ready: readinessResult.summary.ready,
        notReady: readinessResult.summary.notReady,
        overridden: allowIncomplete && incompleteTasks.length > 0,
      },
    });
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

/**
 * Remove dependency between tasks
 * DELETE /api/task-agent/dependencies
 *
 * Body: { sourceTaskId, targetTaskId, relationshipType? }
 */
router.delete("/dependencies", async (req: Request, res: Response) => {
  try {
    const { sourceTaskId, targetTaskId } = req.body;

    if (!sourceTaskId || !targetTaskId) {
      return res
        .status(400)
        .json({ error: "sourceTaskId and targetTaskId are required" });
    }

    // Use applyResolution which deletes the dependency
    const success = await circularDependencyPrevention.applyResolution(
      sourceTaskId,
      targetTaskId,
    );

    return res.json({ success, removed: success });
  } catch (err) {
    console.error("[task-agent] Error removing dependency:", err);
    return res.status(500).json({
      error: "Failed to remove dependency",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// =============================================================================
// Task Lineage Endpoints (Decomposition Tracking)
// =============================================================================

import { query } from "../../database/db.js";

/**
 * Get parent task of a subtask
 * GET /api/task-agent/tasks/:id/parent
 */
router.get("/tasks/:id/parent", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await getOne<{ parent_task_id: string | null }>(
      "SELECT parent_task_id FROM tasks WHERE id = ?",
      [id],
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!task.parent_task_id) {
      return res.json({ parent: null, message: "Task has no parent" });
    }

    const parent = await getOne<{
      id: string;
      display_id: string;
      title: string;
      status: string;
      is_decomposed: number;
    }>(
      "SELECT id, display_id, title, status, is_decomposed FROM tasks WHERE id = ?",
      [task.parent_task_id],
    );

    return res.json({ parent });
  } catch (err) {
    console.error("[task-agent] Error getting parent task:", err);
    return res.status(500).json({
      error: "Failed to get parent task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get all subtasks (children) of a task
 * GET /api/task-agent/tasks/:id/subtasks
 */
router.get("/tasks/:id/subtasks", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subtasks = await query<{
      id: string;
      display_id: string;
      title: string;
      status: string;
      category: string;
      effort: string;
      position: number;
      decomposition_id: string | null;
    }>(
      `SELECT id, display_id, title, status, category, effort, position, decomposition_id
       FROM tasks
       WHERE parent_task_id = ?
       ORDER BY position ASC`,
      [id],
    );

    return res.json({
      parentTaskId: id,
      subtaskCount: subtasks.length,
      subtasks,
    });
  } catch (err) {
    console.error("[task-agent] Error getting subtasks:", err);
    return res.status(500).json({
      error: "Failed to get subtasks",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get decomposition siblings (tasks from same decomposition)
 * GET /api/task-agent/tasks/:id/siblings
 */
router.get("/tasks/:id/siblings", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const task = await getOne<{ decomposition_id: string | null }>(
      "SELECT decomposition_id FROM tasks WHERE id = ?",
      [id],
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!task.decomposition_id) {
      return res.json({
        siblings: [],
        message: "Task is not from a decomposition",
      });
    }

    const siblings = await query<{
      id: string;
      display_id: string;
      title: string;
      status: string;
      position: number;
    }>(
      `SELECT id, display_id, title, status, position
       FROM tasks
       WHERE decomposition_id = ? AND id != ?
       ORDER BY position ASC`,
      [task.decomposition_id, id],
    );

    return res.json({
      decompositionId: task.decomposition_id,
      currentTaskId: id,
      siblingCount: siblings.length,
      siblings,
    });
  } catch (err) {
    console.error("[task-agent] Error getting siblings:", err);
    return res.status(500).json({
      error: "Failed to get siblings",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get decomposition history for a task
 * GET /api/task-agent/tasks/:id/decomposition-history
 */
router.get(
  "/tasks/:id/decomposition-history",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const task = await getOne<{
        id: string;
        display_id: string;
        title: string;
        is_decomposed: number;
        parent_task_id: string | null;
        decomposition_id: string | null;
      }>(
        "SELECT id, display_id, title, is_decomposed, parent_task_id, decomposition_id FROM tasks WHERE id = ?",
        [id],
      );

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Get ancestors (parent chain)
      const ancestors: Array<{
        id: string;
        display_id: string;
        title: string;
        depth: number;
      }> = [];
      let currentParentId = task.parent_task_id;
      let depth = 1;

      while (currentParentId && depth <= 10) {
        const parent = await getOne<{
          id: string;
          display_id: string;
          title: string;
          parent_task_id: string | null;
        }>(
          "SELECT id, display_id, title, parent_task_id FROM tasks WHERE id = ?",
          [currentParentId],
        );

        if (parent) {
          ancestors.push({
            id: parent.id,
            display_id: parent.display_id,
            title: parent.title,
            depth,
          });
          currentParentId = parent.parent_task_id;
          depth++;
        } else {
          break;
        }
      }

      // Get descendants (all subtasks recursively)
      const getDescendants = async (
        parentId: string,
        currentDepth: number,
      ): Promise<
        Array<{ id: string; display_id: string; title: string; depth: number }>
      > => {
        if (currentDepth > 10) return [];

        const children = await query<{
          id: string;
          display_id: string;
          title: string;
        }>(
          "SELECT id, display_id, title FROM tasks WHERE parent_task_id = ? ORDER BY position",
          [parentId],
        );

        const result: Array<{
          id: string;
          display_id: string;
          title: string;
          depth: number;
        }> = [];

        for (const child of children) {
          result.push({ ...child, depth: currentDepth });
          const grandchildren = await getDescendants(
            child.id,
            currentDepth + 1,
          );
          result.push(...grandchildren);
        }

        return result;
      };

      const descendants = await getDescendants(id, 1);

      return res.json({
        task: {
          id: task.id,
          displayId: task.display_id,
          title: task.title,
          isDecomposed: task.is_decomposed === 1,
          decompositionId: task.decomposition_id,
        },
        ancestors: ancestors.reverse(),
        descendants,
        lineageDepth: ancestors.length + descendants.length + 1,
      });
    } catch (err) {
      console.error("[task-agent] Error getting decomposition history:", err);
      return res.status(500).json({
        error: "Failed to get decomposition history",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Search tasks for dependency dropdown
 * GET /api/task-agent/tasks/search
 *
 * Query params:
 * - q: search term (optional)
 * - projectId: filter by project (optional)
 * - excludeTaskId: exclude a specific task (optional)
 * - limit: max results (default 20)
 */
router.get("/tasks/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || "";
    const projectId = req.query.projectId as string | undefined;
    const excludeTaskId = req.query.excludeTaskId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    let sql = `
      SELECT id, display_id, title, status, category, project_id
      FROM tasks
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    // Search by display_id or title
    if (q) {
      sql += ` AND (display_id LIKE ? OR title LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    // Filter by project
    if (projectId) {
      sql += ` AND project_id = ?`;
      params.push(projectId);
    }

    // Exclude a specific task (the current task when adding dependency)
    if (excludeTaskId) {
      sql += ` AND id != ?`;
      params.push(excludeTaskId);
    }

    // Only show actionable tasks
    sql += ` AND status NOT IN ('cancelled', 'archived')`;

    sql += ` ORDER BY updated_at DESC LIMIT ?`;
    params.push(limit);

    const tasks = await query<{
      id: string;
      display_id: string;
      title: string;
      status: string;
      category: string;
      project_id: string | null;
    }>(sql, params);

    return res.json(
      tasks.map((t) => ({
        id: t.id,
        displayId: t.display_id,
        title: t.title,
        status: t.status,
        category: t.category,
        projectId: t.project_id,
      })),
    );
  } catch (err) {
    console.error("[task-agent] Error searching tasks:", err);
    return res.status(500).json({
      error: "Failed to search tasks",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// =============================================================================
// Acceptance Criteria Generation Endpoints
// =============================================================================

import { acceptanceCriteriaGenerator } from "../services/task-agent/acceptance-criteria-generator.js";

/**
 * Generate acceptance criteria (questions or final criteria)
 * POST /api/task-agent/tasks/:taskId/generate-acceptance-criteria
 *
 * Body:
 * - phase: "questions" | "criteria"
 * - prdId?: string
 * - requirementRef?: string
 * - adjacentTaskIds?: string[]
 * - additionalContext?: string
 * - questionAnswers?: Array<{ question: string; answer: string }> (for criteria phase)
 */
router.post(
  "/tasks/:taskId/generate-acceptance-criteria",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const {
        phase,
        prdId,
        requirementRef,
        adjacentTaskIds,
        additionalContext,
        questionAnswers,
      } = req.body;

      if (!phase || !["questions", "criteria"].includes(phase)) {
        return res.status(400).json({
          error: 'phase is required and must be "questions" or "criteria"',
        });
      }

      const context = {
        taskId,
        prdId,
        requirementRef,
        adjacentTaskIds,
        additionalContext,
      };

      if (phase === "questions") {
        const questions =
          await acceptanceCriteriaGenerator.generateQuestions(context);
        return res.json({ questions });
      } else {
        // criteria phase
        const answers = questionAnswers || [];
        const criteria = await acceptanceCriteriaGenerator.generateCriteria(
          context,
          answers,
        );
        return res.json({ criteria });
      }
    } catch (err) {
      console.error("[task-agent] Error generating acceptance criteria:", err);
      return res.status(500).json({
        error: "Failed to generate acceptance criteria",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

// =============================================================================
// Dependency Suggestion Endpoints
// =============================================================================

import { dependencySuggester } from "../services/task-agent/dependency-suggester.js";

/**
 * Get dependency suggestions for a task
 * GET /api/task-agent/tasks/:taskId/suggest-dependencies
 */
router.get(
  "/tasks/:taskId/suggest-dependencies",
  async (req: Request, res: Response) => {
    try {
      let { taskId } = req.params;

      // If taskId doesn't look like a UUID, try to resolve it from display_id
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          taskId,
        );
      if (!isUuid) {
        const task = await getOne<{ id: string }>(
          "SELECT id FROM tasks WHERE display_id = ?",
          [taskId],
        );
        if (!task) {
          return res.status(404).json({ error: `Task not found: ${taskId}` });
        }
        taskId = task.id;
      }

      const suggestions = await dependencySuggester.suggestDependencies(taskId);
      return res.json({ suggestions });
    } catch (err) {
      console.error("[task-agent] Error getting dependency suggestions:", err);
      return res.status(500).json({
        error: "Failed to get dependency suggestions",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Dismiss a dependency suggestion
 * POST /api/task-agent/tasks/:taskId/dismiss-suggestion
 *
 * Body: { targetTaskId: string }
 */
router.post(
  "/tasks/:taskId/dismiss-suggestion",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { targetTaskId } = req.body;

      if (!targetTaskId) {
        return res.status(400).json({ error: "targetTaskId is required" });
      }

      await dependencySuggester.dismissSuggestion(taskId, targetTaskId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[task-agent] Error dismissing suggestion:", err);
      return res.status(500).json({
        error: "Failed to dismiss suggestion",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
