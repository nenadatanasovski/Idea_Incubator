import { Router } from "express";
import * as qa from "../qa/index.js";
import * as tasks from "../db/tasks.js";
import { query } from "../db/index.js";

export const qaRouter = Router();

/**
 * POST /api/qa/verify/:taskId
 * Verify a task (run QA checks)
 */
qaRouter.post("/verify/:taskId", async (req, res) => {
  const { taskId } = req.params;

  const task = tasks.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found", status: 404 });
  }

  try {
    const result = await qa.verifyTask(taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Verification failed",
      status: 500,
    });
  }
});

/**
 * POST /api/qa/run
 * Run full QA cycle (verify all pending_verification tasks)
 */
qaRouter.post("/run", async (_req, res) => {
  try {
    const results = await qa.runQACycle();
    res.json({
      tasksVerified: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "QA cycle failed",
      status: 500,
    });
  }
});

/**
 * POST /api/qa/check
 * Run a specific command check
 */
qaRouter.post("/check", async (req, res) => {
  const { command, cwd } = req.body;

  if (!command) {
    return res.status(400).json({ error: "Missing command", status: 400 });
  }

  try {
    const result = await qa.verifyCommand(command, cwd);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Check failed",
      status: 500,
    });
  }
});

/**
 * GET /api/qa/stats
 * Get overall QA statistics
 */
qaRouter.get("/stats", (_req, res) => {
  // Get stats from database
  const stats = query<{ status: string; count: number }>(
    `SELECT 
      status,
      COUNT(*) as count
    FROM tasks 
    WHERE status IN ('completed', 'failed', 'pending_verification')
    GROUP BY status`,
  );

  const statsMap: Record<string, number> = {};
  for (const s of stats) {
    statsMap[s.status] = s.count;
  }

  res.json({
    completed: statsMap["completed"] || 0,
    failed: statsMap["failed"] || 0,
    pendingVerification: statsMap["pending_verification"] || 0,
  });
});
