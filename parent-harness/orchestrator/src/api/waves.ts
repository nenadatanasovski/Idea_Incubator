import { Router } from "express";
import * as waves from "../waves/index.js";

export const wavesRouter = Router();

/**
 * GET /api/waves
 * Get all wave runs
 */
wavesRouter.get("/", (_req, res) => {
  const runs = waves.getWaveRuns();
  res.json(runs);
});

/**
 * POST /api/waves/plan/:taskListId
 * Plan waves for a task list
 */
wavesRouter.post("/plan/:taskListId", (req, res) => {
  const run = waves.planWaves(req.params.taskListId);
  res.status(201).json(run);
});

/**
 * POST /api/waves/:runId/start
 * Start executing a wave run
 */
wavesRouter.post("/:runId/start", (req, res) => {
  const run = waves.startWaveRun(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: "Wave run not found", status: 404 });
  }
  res.json(run);
});

/**
 * GET /api/waves/:runId
 * Get wave run details with waves
 */
wavesRouter.get("/:runId", (req, res) => {
  const run = waves.getWaveRun(req.params.runId);
  if (!run) {
    return res.status(404).json({ error: "Wave run not found", status: 404 });
  }

  const waveList = waves.getWaves(req.params.runId);
  res.json({ ...run, waves: waveList });
});

/**
 * POST /api/waves/:runId/check
 * Check if current wave is complete and advance
 */
wavesRouter.post("/:runId/check", (req, res) => {
  const completed = waves.checkWaveCompletion(req.params.runId);
  const run = waves.getWaveRun(req.params.runId);
  res.json({ completed, run });
});
