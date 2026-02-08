/**
 * Task Cascade Routes
 *
 * REST API endpoints for cascade analysis and execution.
 * Part of: Task System V2 Implementation Plan (IMPL-5.8)
 */

import { Router, Request, Response } from "express";
import { cascadeAnalyzerService } from "../../services/task-agent/cascade-analyzer-service.js";
import { cascadeExecutorService } from "../../services/task-agent/cascade-executor-service.js";
import { run, getOne, saveDb } from "../../../database/db.js";

const router = Router();

/**
 * Analyze cascade effects
 * POST /api/task-agent/tasks/:taskId/cascade/analyze
 */
router.post(
  "/tasks/:taskId/cascade/analyze",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { changeType, changes } = req.body;

      if (!changeType) {
        return res.status(400).json({ error: "changeType is required" });
      }

      const analysis = await cascadeAnalyzerService.analyze(
        taskId,
        changeType,
        changes || {},
      );
      return res.json(analysis);
    } catch (err) {
      console.error("[task-cascade] Error analyzing cascade:", err);
      return res.status(500).json({
        error: "Failed to analyze cascade",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Execute cascade
 * POST /api/task-agent/tasks/:taskId/cascade/execute
 */
router.post(
  "/tasks/:taskId/cascade/execute",
  async (req: Request, res: Response) => {
    try {
      const { analysis, approveAll, selectedTaskIds } = req.body;

      if (!analysis) {
        return res.status(400).json({ error: "analysis is required" });
      }

      let result;
      if (selectedTaskIds && Array.isArray(selectedTaskIds)) {
        result = await cascadeExecutorService.executeSelected(
          analysis,
          selectedTaskIds,
        );
      } else {
        result = await cascadeExecutorService.execute(analysis, approveAll);
      }

      return res.json(result);
    } catch (err) {
      console.error("[task-cascade] Error executing cascade:", err);
      return res.status(500).json({
        error: "Failed to execute cascade",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Get auto-approve setting for task list
 * GET /api/task-agent/task-lists/:listId/auto-approve
 */
router.get(
  "/task-lists/:listId/auto-approve",
  async (req: Request, res: Response) => {
    try {
      const { listId } = req.params;
      const result = await getOne<{ auto_approve_reviews: number }>(
        "SELECT auto_approve_reviews FROM task_lists_v2 WHERE id = ?",
        [listId],
      );

      if (!result) {
        return res.status(404).json({ error: "Task list not found" });
      }

      return res.json({ autoApprove: result.auto_approve_reviews === 1 });
    } catch (err) {
      console.error("[task-cascade] Error getting auto-approve:", err);
      return res.status(500).json({
        error: "Failed to get auto-approve setting",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Set auto-approve setting for task list
 * PUT /api/task-agent/task-lists/:listId/auto-approve
 */
router.put(
  "/task-lists/:listId/auto-approve",
  async (req: Request, res: Response) => {
    try {
      const { listId } = req.params;
      const { autoApprove } = req.body;

      if (autoApprove === undefined) {
        return res.status(400).json({ error: "autoApprove is required" });
      }

      await run(
        "UPDATE task_lists_v2 SET auto_approve_reviews = ?, updated_at = ? WHERE id = ?",
        [autoApprove ? 1 : 0, new Date().toISOString(), listId],
      );
      await saveDb();

      return res.json({ success: true, autoApprove });
    } catch (err) {
      console.error("[task-cascade] Error setting auto-approve:", err);
      return res.status(500).json({
        error: "Failed to set auto-approve",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
