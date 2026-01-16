/**
 * Task History Routes
 *
 * REST API endpoints for task state history and analytics.
 * Part of: Task System V2 Implementation Plan (IMPL-5.10)
 */

import { Router, Request, Response } from "express";
import { taskStateHistoryService } from "../../services/task-agent/task-state-history-service.js";

const router = Router();

/**
 * Get full history
 * GET /api/task-agent/tasks/:taskId/history
 */
router.get("/:taskId/history", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const history = await taskStateHistoryService.getHistory(taskId);
    return res.json(history);
  } catch (err) {
    console.error("[task-history] Error getting history:", err);
    return res.status(500).json({
      error: "Failed to get history",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get state transitions
 * GET /api/task-agent/tasks/:taskId/history/states
 */
router.get("/:taskId/history/states", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { from, to } = req.query;

    let history;
    if (from && to) {
      history = await taskStateHistoryService.getHistoryInRange(
        taskId,
        new Date(from as string),
        new Date(to as string),
      );
    } else {
      history = await taskStateHistoryService.getHistory(taskId);
    }

    return res.json(history);
  } catch (err) {
    console.error("[task-history] Error getting state transitions:", err);
    return res.status(500).json({
      error: "Failed to get state transitions",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get time analytics
 * GET /api/task-agent/tasks/:taskId/history/analytics
 */
router.get(
  "/:taskId/history/analytics",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;

      // Get various analytics
      const transitionCount =
        await taskStateHistoryService.getTransitionCount(taskId);
      const lastTransition =
        await taskStateHistoryService.getLastTransition(taskId);

      // Get time in each status
      const statuses = [
        "draft",
        "pending",
        "in_progress",
        "completed",
        "failed",
        "blocked",
      ];
      const timeInStatus: Record<string, number> = {};

      for (const status of statuses) {
        timeInStatus[status] = await taskStateHistoryService.getTimeInStatus(
          taskId,
          status as any,
        );
      }

      return res.json({
        taskId,
        transitionCount,
        lastTransition,
        timeInStatus,
        currentStatus: lastTransition?.toStatus,
      });
    } catch (err) {
      console.error("[task-history] Error getting analytics:", err);
      return res.status(500).json({
        error: "Failed to get analytics",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Get recent transitions across all tasks
 * GET /api/task-agent/history/recent
 */
router.get("/history/recent", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const transitions =
      await taskStateHistoryService.getRecentTransitions(limit);
    return res.json(transitions);
  } catch (err) {
    console.error("[task-history] Error getting recent transitions:", err);
    return res.status(500).json({
      error: "Failed to get recent transitions",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
