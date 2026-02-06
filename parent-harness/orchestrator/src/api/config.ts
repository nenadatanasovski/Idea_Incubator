import { Router } from 'express';
import * as selfImprovement from '../self-improvement/index.js';
import * as planning from '../planning/index.js';

export const configRouter = Router();

/**
 * GET /api/config
 * Get current configuration
 */
configRouter.get('/', (_req, res) => {
  res.json({
    maxRetries: 5,
    qaEveryNTicks: 10,
    tickIntervalMs: 30000,
    stuckThresholdMs: 900000,
    planningIntervalMs: 7200000,
    features: {
      spawnAgents: process.env.HARNESS_SPAWN_AGENTS === 'true',
      runPlanning: process.env.HARNESS_RUN_PLANNING === 'true',
      runQA: process.env.HARNESS_RUN_QA !== 'false',
    },
  });
});

/**
 * GET /api/config/retry-stats
 * Get retry statistics
 */
configRouter.get('/retry-stats', (_req, res) => {
  const stats = selfImprovement.getRetryStats();
  res.json(stats);
});

/**
 * GET /api/config/retry-history/:taskId
 * Get retry history for a task
 */
configRouter.get('/retry-history/:taskId', (req, res) => {
  const history = selfImprovement.getRetryHistory(req.params.taskId);
  res.json(history);
});

/**
 * POST /api/config/retry/:taskId
 * Manually retry a failed task
 */
configRouter.post('/retry/:taskId', (req, res) => {
  const { taskId } = req.params;
  const { error } = req.body;

  const result = selfImprovement.prepareForRetry(taskId, error || 'Manual retry requested');
  res.json(result);
});

/**
 * GET /api/planning/analyze
 * Run performance analysis
 */
configRouter.get('/planning/analyze', (_req, res) => {
  const analysis = planning.analyzePerformance();
  res.json(analysis);
});

/**
 * POST /api/planning/daily
 * Run daily planning
 */
configRouter.post('/planning/daily', async (req, res) => {
  const { taskListId } = req.body;
  if (!taskListId) {
    return res.status(400).json({ error: 'Missing taskListId', status: 400 });
  }

  const session = await planning.runDailyPlanning(taskListId);
  res.json(session);
});
