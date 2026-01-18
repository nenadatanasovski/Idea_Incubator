/**
 * PRD Routes
 *
 * REST API endpoints for Product Requirements Documents.
 * Part of: Task System V2 Implementation Plan (IMPL-5.3)
 */

import { Router, Request, Response } from "express";
import { prdService } from "../services/prd-service.js";

const router = Router();

/**
 * List PRDs with optional filters
 * GET /api/prds
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, projectId, userId } = req.query;
    const prds = await prdService.list({
      status: status as any,
      projectId: projectId as string,
      userId: userId as string,
    });
    return res.json(prds);
  } catch (err) {
    console.error("[prds] Error listing PRDs:", err);
    return res.status(500).json({
      error: "Failed to list PRDs",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get PRD by ID
 * GET /api/prds/:id
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prd = await prdService.getById(id);

    if (!prd) {
      return res.status(404).json({ error: "PRD not found" });
    }

    return res.json(prd);
  } catch (err) {
    console.error("[prds] Error getting PRD:", err);
    return res.status(500).json({
      error: "Failed to get PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get PRD by slug
 * GET /api/prds/slug/:slug
 */
router.get("/slug/:slug", async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const prd = await prdService.getBySlug(slug);

    if (!prd) {
      return res.status(404).json({ error: "PRD not found" });
    }

    return res.json(prd);
  } catch (err) {
    console.error("[prds] Error getting PRD by slug:", err);
    return res.status(500).json({
      error: "Failed to get PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Create PRD
 * POST /api/prds
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const { title, userId, ...rest } = req.body;

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    // Use provided userId or default
    const effectiveUserId = userId || "system";

    const prd = await prdService.create({ title, ...rest }, effectiveUserId);

    return res.status(201).json(prd);
  } catch (err) {
    console.error("[prds] Error creating PRD:", err);
    return res.status(500).json({
      error: "Failed to create PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Update PRD
 * PUT /api/prds/:id
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const prd = await prdService.update(id, req.body);
    return res.json(prd);
  } catch (err) {
    console.error("[prds] Error updating PRD:", err);
    return res.status(500).json({
      error: "Failed to update PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Delete PRD
 * DELETE /api/prds/:id
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prdService.delete(id);
    return res.json({ success: true });
  } catch (err) {
    console.error("[prds] Error deleting PRD:", err);
    return res.status(500).json({
      error: "Failed to delete PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Approve PRD
 * POST /api/prds/:id/approve
 */
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const prd = await prdService.approve(id, userId);
    return res.json(prd);
  } catch (err) {
    console.error("[prds] Error approving PRD:", err);
    return res.status(500).json({
      error: "Failed to approve PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get PRD hierarchy
 * GET /api/prds/:id/hierarchy
 */
router.get("/:id/hierarchy", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hierarchy = await prdService.getHierarchy(id);
    return res.json(hierarchy);
  } catch (err) {
    console.error("[prds] Error getting PRD hierarchy:", err);
    return res.status(500).json({
      error: "Failed to get PRD hierarchy",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Move an item from success_criteria or constraints to business_context
 * POST /api/prds/:id/move-to-business-context
 *
 * Body: { sourceType: "success_criteria" | "constraints", itemIndex: number }
 *
 * This is used to move non-functional items (like budget constraints, resource limitations)
 * out of functional requirement sections so they are not analyzed for task coverage.
 */
router.post(
  "/:id/move-to-business-context",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { sourceType, itemIndex } = req.body;

      if (
        !sourceType ||
        !["success_criteria", "constraints"].includes(sourceType)
      ) {
        return res.status(400).json({
          error: "sourceType must be 'success_criteria' or 'constraints'",
        });
      }

      if (typeof itemIndex !== "number" || itemIndex < 0) {
        return res
          .status(400)
          .json({ error: "itemIndex must be a non-negative number" });
      }

      // Get current PRD
      const prd = await prdService.getById(id);
      if (!prd) {
        return res.status(404).json({ error: "PRD not found" });
      }

      // Get arrays (already parsed by mapPrdRow)
      const sourceKey =
        sourceType === "success_criteria" ? "successCriteria" : "constraints";
      const sourceArray: string[] = [
        ...(sourceType === "success_criteria"
          ? prd.successCriteria
          : prd.constraints),
      ];
      const businessContext: string[] = [...prd.businessContext];

      // Validate index
      if (itemIndex >= sourceArray.length) {
        return res
          .status(400)
          .json({ error: `Item index ${itemIndex} out of bounds` });
      }

      // Move item
      const [movedItem] = sourceArray.splice(itemIndex, 1);
      businessContext.push(movedItem);

      // Update PRD
      const updatedPrd = await prdService.update(id, {
        [sourceKey]: sourceArray,
        businessContext,
      });

      return res.json({
        success: true,
        movedItem,
        prd: updatedPrd,
      });
    } catch (err) {
      console.error("[prds] Error moving item to business context:", err);
      return res.status(500).json({
        error: "Failed to move item to business context",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
