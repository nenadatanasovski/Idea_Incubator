import { Router } from 'express';
import * as selfImprovement from '../self-improvement/index.js';
import * as planning from '../planning/index.js';

export const configRouter = Router();

/**
 * GET /api/config
 * Get current configuration
 */
configRouter.get('/', (_req, res) => {
  const config = selfImprovement.getAllConfig();
  res.json(config);
});

/**
 * GET /api/config/:key
 * Get specific config value
 */
configRouter.get('/:key', (req, res) => {
  const value = selfImprovement.getConfig(req.params.key);
  if (value === undefined) {
    return res.status(404).json({ error: 'Config key not found', status: 404 });
  }
  res.json({ key: req.params.key, value });
});

/**
 * POST /api/config/propose
 * Propose a configuration change
 */
configRouter.post('/propose', (req, res) => {
  const { type, target, value, reason } = req.body;

  if (!target || value === undefined || !reason) {
    return res.status(400).json({
      error: 'Missing required fields: target, value, reason',
      status: 400,
    });
  }

  const mod = selfImprovement.proposeChange(type || 'config', target, value, reason);
  res.status(201).json(mod);
});

/**
 * POST /api/config/modifications/:id/apply
 * Apply a pending modification
 */
configRouter.post('/modifications/:id/apply', (req, res) => {
  const success = selfImprovement.applyModification(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Modification not found or not pending', status: 404 });
  }
  res.json({ success: true });
});

/**
 * POST /api/config/modifications/:id/revert
 * Revert an applied modification
 */
configRouter.post('/modifications/:id/revert', (req, res) => {
  const success = selfImprovement.revertModification(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Modification not found or not applied', status: 404 });
  }
  res.json({ success: true });
});

/**
 * GET /api/config/modifications
 * Get modification history
 */
configRouter.get('/modifications', (req, res) => {
  const pending = req.query.pending === 'true';
  const mods = pending 
    ? selfImprovement.getPendingModifications()
    : selfImprovement.getModificationHistory();
  res.json(mods);
});

/**
 * POST /api/config/auto-tune
 * Run auto-tuning
 */
configRouter.post('/auto-tune', (_req, res) => {
  const modifications = selfImprovement.autoTune();
  res.json({ proposed: modifications.length, modifications });
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
