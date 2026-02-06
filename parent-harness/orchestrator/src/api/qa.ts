import { Router } from 'express';
import * as qa from '../qa/index.js';
import * as tasks from '../db/tasks.js';

export const qaRouter = Router();

/**
 * POST /api/qa/validate/:taskId
 * Validate a task
 */
qaRouter.post('/validate/:taskId', async (req, res) => {
  const { taskId } = req.params;
  const { agentId, sessionId } = req.body;

  const task = tasks.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found', status: 404 });
  }

  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId', status: 400 });
  }

  try {
    const result = await qa.validateTask(taskId, agentId, sessionId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Validation failed',
      status: 500,
    });
  }
});

/**
 * GET /api/qa/history/:taskId
 * Get QA history for a task
 */
qaRouter.get('/history/:taskId', (req, res) => {
  const history = qa.getTaskQAHistory(req.params.taskId);
  res.json(history);
});

/**
 * GET /api/qa/stats
 * Get overall QA statistics
 */
qaRouter.get('/stats', (_req, res) => {
  const stats = qa.getQAStats();
  res.json(stats);
});
