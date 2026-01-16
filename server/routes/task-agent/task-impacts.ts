/**
 * Task Impact Routes
 *
 * REST API endpoints for task impact management.
 * Part of: Task System V2 Implementation Plan (IMPL-5.1)
 */

import { Router, Request, Response } from "express";
import { taskImpactService } from "../../services/task-agent/task-impact-service.js";
import {
  estimateFileImpacts,
  getFileImpacts,
  validateFileImpacts,
} from "../../services/task-agent/file-impact-analyzer.js";
import { getOne } from "../../../database/db.js";

const router = Router();

/**
 * Get all impacts for a task
 * GET /api/task-agent/tasks/:taskId/impacts
 */
router.get("/:taskId/impacts", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const impacts = await taskImpactService.getByTaskId(taskId);
    return res.json(impacts);
  } catch (err) {
    console.error("[task-impacts] Error getting impacts:", err);
    return res.status(500).json({
      error: "Failed to get task impacts",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Add impact(s) to task
 * POST /api/task-agent/tasks/:taskId/impacts
 */
router.post("/:taskId/impacts", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { impacts } = req.body;

    if (Array.isArray(impacts)) {
      // Bulk create
      const created = await taskImpactService.createBulk(taskId, impacts);
      return res.status(201).json(created);
    } else {
      // Single create
      const created = await taskImpactService.create({ ...req.body, taskId });
      return res.status(201).json(created);
    }
  } catch (err) {
    console.error("[task-impacts] Error creating impact:", err);
    return res.status(500).json({
      error: "Failed to create task impact",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Update an impact
 * PUT /api/task-agent/tasks/:taskId/impacts/:impactId
 */
router.put(
  "/:taskId/impacts/:impactId",
  async (req: Request, res: Response) => {
    try {
      const { impactId } = req.params;
      const updated = await taskImpactService.update(impactId, req.body);
      return res.json(updated);
    } catch (err) {
      console.error("[task-impacts] Error updating impact:", err);
      return res.status(500).json({
        error: "Failed to update task impact",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Delete an impact
 * DELETE /api/task-agent/tasks/:taskId/impacts/:impactId
 */
router.delete(
  "/:taskId/impacts/:impactId",
  async (req: Request, res: Response) => {
    try {
      const { impactId } = req.params;
      await taskImpactService.delete(impactId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[task-impacts] Error deleting impact:", err);
      return res.status(500).json({
        error: "Failed to delete task impact",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * AI estimate impacts for a task
 * POST /api/task-agent/tasks/:taskId/impacts/estimate
 */
router.post(
  "/:taskId/impacts/estimate",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;

      // Get task details
      const task = await getOne<{
        title: string;
        description: string;
        category: string;
      }>("SELECT title, description, category FROM tasks WHERE id = ?", [
        taskId,
      ]);

      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Estimate impacts using file impact analyzer
      const impacts = await estimateFileImpacts(
        taskId,
        task.title,
        task.description,
        task.category as any,
      );

      return res.json(impacts);
    } catch (err) {
      console.error("[task-impacts] Error estimating impacts:", err);
      return res.status(500).json({
        error: "Failed to estimate impacts",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Validate impacts against actual changes
 * POST /api/task-agent/tasks/:taskId/impacts/validate
 */
router.post(
  "/:taskId/impacts/validate",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { actualFiles } = req.body;

      if (!Array.isArray(actualFiles)) {
        return res.status(400).json({ error: "actualFiles array is required" });
      }

      const result = await validateFileImpacts(
        taskId,
        actualFiles.map((f) => ({
          filePath: f.filePath || f,
          operation: f.operation || "UPDATE",
        })),
      );

      return res.json(result);
    } catch (err) {
      console.error("[task-impacts] Error validating impacts:", err);
      return res.status(500).json({
        error: "Failed to validate impacts",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
