// server/routes/ux.ts - UX Agent API routes

import { Router, Request, Response } from "express";
import {
  getUXRun,
  getStepResults,
  getAccessibilityIssues,
  getRecentRuns,
  getAllJourneys,
} from "../../agents/ux/index.js";
import {
  UXRunRequest,
  UXRun,
  UXStepResult,
  UXAccessibilityIssue,
} from "../../types/ux.js";

const router = Router();

/**
 * Count issues by impact level
 */
function countByImpact(issues: UXAccessibilityIssue[]): Record<string, number> {
  return {
    total: issues.length,
    critical: issues.filter((i) => i.impact === "critical").length,
    serious: issues.filter((i) => i.impact === "serious").length,
    moderate: issues.filter((i) => i.impact === "moderate").length,
    minor: issues.filter((i) => i.impact === "minor").length,
  };
}

/**
 * Map UXRun to API response format
 */
function mapRunToResponse(run: UXRun): Record<string, unknown> {
  return {
    id: run.id,
    journeyId: run.journeyId,
    buildId: run.buildId,
    status: run.status,
    passed: run.passed === 1,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    summary: run.summaryJson ? JSON.parse(run.summaryJson) : {},
  };
}

/**
 * Map step result to API response format
 */
function mapStepToResponse(step: UXStepResult): Record<string, unknown> {
  return {
    stepIndex: step.stepIndex,
    action: step.action,
    target: step.target,
    status: step.status,
    passed: step.passed === 1,
    error: step.error,
    screenshotPath: step.screenshotPath,
    durationMs: step.durationMs,
  };
}

/**
 * GET /api/ux/journeys
 * List available journeys
 */
router.get("/journeys", async (_req: Request, res: Response): Promise<void> => {
  try {
    const journeys = getAllJourneys();

    res.json({
      journeys: journeys.map((j) => ({
        id: j.id,
        name: j.name,
        description: j.description,
        startUrl: j.startUrl,
        stepsCount: j.steps.length,
        timeout: j.timeout,
        tags: j.tags,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/ux/history
 * Get recent run history
 */
router.get("/history", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await getRecentRuns(limit);

    res.json({
      runs: runs.map(mapRunToResponse),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/ux/run
 * Start a UX journey run
 * Note: Actual execution requires MCP tools, this just queues the request
 */
router.post("/run", async (req: Request, res: Response): Promise<void> => {
  try {
    const request = req.body as UXRunRequest;

    if (!request.journeyId) {
      res.status(400).json({ error: "journeyId is required" });
      return;
    }

    const journeys = getAllJourneys();
    const journey = journeys.find((j) => j.id === request.journeyId);

    if (!journey) {
      res
        .status(404)
        .json({ error: `Journey not found: ${request.journeyId}` });
      return;
    }

    res.json({
      message: "Journey run queued",
      journeyId: request.journeyId,
      journeyName: journey.name,
      stepsCount: journey.steps.length,
      options: request.options,
      note: "Actual execution requires MCP bridge setup",
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/ux/:id
 * Get run status and summary
 */
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const run = await getUXRun(id);

    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json(mapRunToResponse(run));
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/ux/:id/steps
 * Get detailed step results
 */
router.get("/:id/steps", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const run = await getUXRun(id);

    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    const steps = await getStepResults(id);

    res.json({
      runId: id,
      steps: steps.map(mapStepToResponse),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/ux/:id/accessibility
 * Get accessibility issues
 */
router.get(
  "/:id/accessibility",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const run = await getUXRun(id);

      if (!run) {
        res.status(404).json({ error: "Run not found" });
        return;
      }

      const issues = await getAccessibilityIssues(id);

      res.json({
        runId: id,
        issues: issues.map((i) => ({
          ruleId: i.ruleId,
          impact: i.impact,
          description: i.description,
          selector: i.selector,
          helpUrl: i.helpUrl,
        })),
        summary: countByImpact(issues),
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
);

export default router;
