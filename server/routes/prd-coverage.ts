/**
 * PRD Coverage Routes
 *
 * REST API endpoints for PRD coverage tracking.
 * Part of: Task System V2 Implementation Plan (IMPL-5.5)
 */

import { Router, Request, Response } from "express";
import { prdCoverageService } from "../services/prd-coverage-service.js";

const router = Router();

/**
 * Get coverage statistics
 * GET /api/prds/:prdId/coverage
 */
router.get("/:prdId/coverage", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const coverage = await prdCoverageService.calculateCoverage(prdId);
    return res.json(coverage);
  } catch (err) {
    console.error("[prd-coverage] Error calculating coverage:", err);
    return res.status(500).json({
      error: "Failed to calculate coverage",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get uncovered requirements
 * GET /api/prds/:prdId/coverage/gaps
 */
router.get("/:prdId/coverage/gaps", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const gaps = await prdCoverageService.getUncoveredRequirements(prdId);
    return res.json({ uncovered: gaps });
  } catch (err) {
    console.error("[prd-coverage] Error getting gaps:", err);
    return res.status(500).json({
      error: "Failed to get coverage gaps",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get completion progress
 * GET /api/prds/:prdId/progress
 */
router.get("/:prdId/progress", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;
    const progress = await prdCoverageService.getCompletionProgress(prdId);
    return res.json(progress);
  } catch (err) {
    console.error("[prd-coverage] Error getting progress:", err);
    return res.status(500).json({
      error: "Failed to get progress",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
