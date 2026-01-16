/**
 * Task Test Routes
 *
 * REST API endpoints for task testing and validation.
 * Part of: Task System V2 Implementation Plan (IMPL-5.9)
 */

import { Router, Request, Response } from "express";
import { taskTestService } from "../../services/task-agent/task-test-service.js";

const router = Router();

/**
 * Get test configuration
 * GET /api/task-agent/tasks/:taskId/tests/config
 */
router.get("/:taskId/tests/config", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const config = await taskTestService.getTestConfig(taskId);
    return res.json(config);
  } catch (err) {
    console.error("[task-tests] Error getting test config:", err);
    return res.status(500).json({
      error: "Failed to get test config",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Set test configuration
 * POST /api/task-agent/tasks/:taskId/tests/config
 */
router.post("/:taskId/tests/config", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ error: "configs array is required" });
    }

    await taskTestService.setTestConfig(taskId, configs);
    return res.json({ success: true });
  } catch (err) {
    console.error("[task-tests] Error setting test config:", err);
    return res.status(500).json({
      error: "Failed to set test config",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Run validation
 * POST /api/task-agent/tasks/:taskId/tests/validate
 */
router.post("/:taskId/tests/validate", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { levels, executionId, agentId } = req.body;

    const result = await taskTestService.runValidation({
      taskId,
      levels,
      executionId,
      agentId,
    });

    return res.json(result);
  } catch (err) {
    console.error("[task-tests] Error running validation:", err);
    return res.status(500).json({
      error: "Failed to run validation",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get test results
 * GET /api/task-agent/tasks/:taskId/tests/results
 */
router.get("/:taskId/tests/results", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const results = await taskTestService.getResults(taskId);
    return res.json(results);
  } catch (err) {
    console.error("[task-tests] Error getting test results:", err);
    return res.status(500).json({
      error: "Failed to get test results",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Get latest test results
 * GET /api/task-agent/tasks/:taskId/tests/results/latest
 */
router.get(
  "/:taskId/tests/results/latest",
  async (req: Request, res: Response) => {
    try {
      const { taskId } = req.params;
      const results = await taskTestService.getLatestResults(taskId);
      return res.json(
        results || {
          taskId,
          overallPassed: false,
          totalDuration: 0,
          levels: [],
        },
      );
    } catch (err) {
      console.error("[task-tests] Error getting latest results:", err);
      return res.status(500).json({
        error: "Failed to get latest results",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Check acceptance criteria
 * GET /api/task-agent/tasks/:taskId/tests/acceptance
 */
router.get("/:taskId/tests/acceptance", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const result = await taskTestService.checkAcceptanceCriteria(taskId);
    return res.json(result);
  } catch (err) {
    console.error("[task-tests] Error checking acceptance:", err);
    return res.status(500).json({
      error: "Failed to check acceptance criteria",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

export default router;
