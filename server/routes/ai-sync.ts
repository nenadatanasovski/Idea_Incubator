/**
 * AI Sync Routes
 *
 * API endpoints for AI-powered sync between specs and tasks.
 */

import { Router, Request, Response } from "express";
import { aiSyncService } from "../services/project/ai-sync-service.js";

const router = Router();

/**
 * POST /api/ai/sync-spec-section
 * Generate AI suggestions for updating a spec section based on task progress
 */
router.post("/sync-spec-section", async (req: Request, res: Response) => {
  try {
    const { prdId, sectionType } = req.body;

    if (!prdId) {
      return res.status(400).json({ error: "prdId is required" });
    }

    if (
      !sectionType ||
      !["success_criteria", "constraints"].includes(sectionType)
    ) {
      return res.status(400).json({
        error: "sectionType must be 'success_criteria' or 'constraints'",
      });
    }

    const result = await aiSyncService.generateSpecSectionUpdate(
      prdId,
      sectionType,
    );

    return res.json(result);
  } catch (error) {
    console.error("[AI Sync] Error syncing spec section:", error);
    const message =
      error instanceof Error ? error.message : "Failed to sync spec section";

    if (message.includes("Rate limited")) {
      return res.status(429).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ai/regenerate-summary
 * Generate a new project summary based on task progress
 */
router.post("/regenerate-summary", async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: "projectId is required" });
    }

    const result = await aiSyncService.regenerateProjectSummary(projectId);

    return res.json(result);
  } catch (error) {
    console.error("[AI Sync] Error regenerating summary:", error);
    const message =
      error instanceof Error ? error.message : "Failed to regenerate summary";

    if (message.includes("Rate limited")) {
      return res.status(429).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ai/suggest-task-links
 * Get AI suggestions for linking a task to PRD requirements
 */
router.post("/suggest-task-links", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const suggestions = await aiSyncService.suggestTaskSpecLinks(taskId);

    return res.json({ suggestions });
  } catch (error) {
    console.error("[AI Sync] Error suggesting task links:", error);
    const message =
      error instanceof Error ? error.message : "Failed to suggest task links";

    if (message.includes("Rate limited")) {
      return res.status(429).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/ai/apply-spec-update
 * Apply a spec section update (after user confirmation)
 */
router.post("/apply-spec-update", async (req: Request, res: Response) => {
  try {
    const { prdId, sectionType, content } = req.body;

    if (!prdId) {
      return res.status(400).json({ error: "prdId is required" });
    }

    if (
      !sectionType ||
      !["success_criteria", "constraints"].includes(sectionType)
    ) {
      return res.status(400).json({
        error: "sectionType must be 'success_criteria' or 'constraints'",
      });
    }

    if (!Array.isArray(content)) {
      return res
        .status(400)
        .json({ error: "content must be an array of strings" });
    }

    await aiSyncService.applySpecUpdate(prdId, sectionType, content);

    return res.json({ success: true, message: "Spec section updated" });
  } catch (error) {
    console.error("[AI Sync] Error applying spec update:", error);
    const message =
      error instanceof Error ? error.message : "Failed to apply spec update";

    return res.status(500).json({ error: message });
  }
});

export default router;
