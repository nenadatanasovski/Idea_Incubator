/**
 * Build Health API
 * 
 * Exposes build health metrics and allows manual checks.
 */
import { Router } from 'express';
import { getBuildHealth, checkBuildHealth, getRecommendedFixes } from '../build-health/index.js';

export const buildHealthRouter = Router();

/**
 * GET /api/build-health
 * Get current build health status
 */
buildHealthRouter.get('/', (_req, res) => {
  const health = getBuildHealth();
  res.json(health);
});

/**
 * POST /api/build-health/check
 * Trigger a manual build health check
 */
buildHealthRouter.post('/check', async (_req, res) => {
  try {
    const health = await checkBuildHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: 'Build health check failed' });
  }
});

/**
 * GET /api/build-health/fixes
 * Get recommended files to fix
 */
buildHealthRouter.get('/fixes', (_req, res) => {
  const files = getRecommendedFixes();
  res.json({ files, count: files.length });
});

export default buildHealthRouter;
