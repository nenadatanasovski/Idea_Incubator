/**
 * Task Appendix Routes
 *
 * REST API endpoints for task appendix management.
 * Part of: Task System V2 Implementation Plan (IMPL-5.2)
 */

import { Router, Request, Response } from "express";
import { taskAppendixService } from "../../services/task-agent/task-appendix-service.js";

const router = Router();

/**
 * Get all appendices for a task
 * GET /api/task-agent/tasks/:taskId/appendices
 */
router.get("/:taskId/appendices", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const appendices = await taskAppendixService.getByTaskId(taskId);
    return res.json(appendices);
  } catch (err) {
    console.error("[task-appendices] Error getting appendices:", err);
    return res.status(500).json({
      error: "Failed to get task appendices",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get appendices with content resolved
 * GET /api/task-agent/tasks/:taskId/appendices/resolved
 */
router.get(
  "/:taskId/appendices/resolved",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const resolved = await taskAppendixService.resolveAll(taskId);
      return res.json(resolved);
    } catch (err) {
      console.error("[task-appendices] Error resolving appendices:", err);
      return res.status(500).json({
        error: "Failed to resolve appendices",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Attach appendix to task
 * POST /api/task-agent/tasks/:taskId/appendices
 */
router.post("/:taskId/appendices", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { appendixType, content, referenceId, referenceTable, position } =
      req.body;

    if (!appendixType) {
      return res.status(400).json({ error: "appendixType is required" });
    }

    const created = await taskAppendixService.create({
      taskId,
      appendixType,
      content,
      referenceId,
      referenceTable,
      position,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error("[task-appendices] Error creating appendix:", err);
    return res.status(500).json({
      error: "Failed to create appendix",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Update appendix
 * PUT /api/task-agent/tasks/:taskId/appendices/:appendixId
 */
router.put(
  "/:taskId/appendices/:appendixId",
  async (req: Request, res: Response) => {
    try {
      const { appendixId } = req.params;
      const updated = await taskAppendixService.update(appendixId, req.body);
      return res.json(updated);
    } catch (err) {
      console.error("[task-appendices] Error updating appendix:", err);
      return res.status(500).json({
        error: "Failed to update appendix",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Remove appendix
 * DELETE /api/task-agent/tasks/:taskId/appendices/:appendixId
 */
router.delete(
  "/:taskId/appendices/:appendixId",
  async (req: Request, res: Response) => {
    try {
      const { appendixId } = req.params;
      await taskAppendixService.delete(appendixId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[task-appendices] Error deleting appendix:", err);
      return res.status(500).json({
        error: "Failed to delete appendix",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Reorder appendices
 * POST /api/task-agent/tasks/:taskId/appendices/reorder
 */
router.post(
  "/:taskId/appendices/reorder",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const { appendixIds } = req.body;

      if (!Array.isArray(appendixIds)) {
        return res.status(400).json({ error: "appendixIds array is required" });
      }

      await taskAppendixService.reorder(taskId, appendixIds);
      return res.json({ success: true });
    } catch (err) {
      console.error("[task-appendices] Error reordering appendices:", err);
      return res.status(500).json({
        error: "Failed to reorder appendices",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
