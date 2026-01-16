/**
 * PRD Link Routes
 *
 * REST API endpoints for PRD-TaskList and PRD-Task links.
 * Part of: Task System V2 Implementation Plan (IMPL-5.4)
 */

import { Router, Request, Response } from "express";
import { prdLinkService } from "../services/prd-link-service.js";

const router = Router();

/**
 * Get all links for a PRD
 * GET /api/prds/:prdId/links
 */
router.get("/:prdId/links", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const taskLists = await prdLinkService.getLinkedTaskLists(prdId);
    const tasks = await prdLinkService.getLinkedTasks(prdId);
    return res.json({ taskLists, tasks });
  } catch (err) {
    console.error("[prd-links] Error getting links:", err);
    return res.status(500).json({
      error: "Failed to get PRD links",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Link task list to PRD
 * POST /api/prds/:prdId/link-list
 */
router.post("/:prdId/link-list", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const { taskListId, position } = req.body;

    if (!taskListId) {
      return res.status(400).json({ error: "taskListId is required" });
    }

    const link = await prdLinkService.linkTaskList(prdId, taskListId, position);
    return res.status(201).json(link);
  } catch (err) {
    console.error("[prd-links] Error linking task list:", err);
    return res.status(500).json({
      error: "Failed to link task list",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Unlink task list from PRD
 * DELETE /api/prds/:prdId/link-list/:taskListId
 */
router.delete(
  "/:prdId/link-list/:taskListId",
  async (req: Request, res: Response) => {
    try {
      const { prdId, taskListId } = req.params;
      await prdLinkService.unlinkTaskList(prdId, taskListId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[prd-links] Error unlinking task list:", err);
      return res.status(500).json({
        error: "Failed to unlink task list",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Link task to PRD
 * POST /api/prds/:prdId/link-task
 */
router.post("/:prdId/link-task", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const { taskId, requirementRef, linkType } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const link = await prdLinkService.linkTask(
      prdId,
      taskId,
      requirementRef,
      linkType,
    );
    return res.status(201).json(link);
  } catch (err) {
    console.error("[prd-links] Error linking task:", err);
    return res.status(500).json({
      error: "Failed to link task",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Unlink task from PRD
 * DELETE /api/prds/:prdId/link-task/:taskId
 */
router.delete(
  "/:prdId/link-task/:taskId",
  async (req: Request, res: Response) => {
    try {
      const { prdId, taskId } = req.params;
      await prdLinkService.unlinkTask(prdId, taskId);
      return res.json({ success: true });
    } catch (err) {
      console.error("[prd-links] Error unlinking task:", err);
      return res.status(500).json({
        error: "Failed to unlink task",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Reorder task list links
 * POST /api/prds/:prdId/links/reorder
 */
router.post("/:prdId/links/reorder", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const { taskListIds } = req.body;

    if (!Array.isArray(taskListIds)) {
      return res.status(400).json({ error: "taskListIds array is required" });
    }

    await prdLinkService.reorderTaskLists(prdId, taskListIds);
    return res.json({ success: true });
  } catch (err) {
    console.error("[prd-links] Error reordering links:", err);
    return res.status(500).json({
      error: "Failed to reorder links",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Auto-link based on content
 * POST /api/prds/:prdId/auto-link
 */
router.post("/:prdId/auto-link", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const { minConfidence } = req.body;

    const result = await prdLinkService.autoLink(prdId, minConfidence);
    return res.json(result);
  } catch (err) {
    console.error("[prd-links] Error auto-linking:", err);
    return res.status(500).json({
      error: "Failed to auto-link",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
