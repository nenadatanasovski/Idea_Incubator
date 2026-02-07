/**
 * Alerts API
 * 
 * Exposes alert status and allows manual alert checks.
 */
import { Router } from 'express';
import { getAlertStatus, checkAlerts } from '../alerts/index.js';

export const alertsRouter = Router();

/**
 * GET /api/alerts
 * Get current alert status
 */
alertsRouter.get('/', (_req, res) => {
  const status = getAlertStatus();
  res.json(status);
});

/**
 * POST /api/alerts/check
 * Trigger a manual alert check
 */
alertsRouter.post('/check', async (_req, res) => {
  try {
    await checkAlerts();
    const status = getAlertStatus();
    res.json({ checked: true, ...status });
  } catch (err) {
    res.status(500).json({ error: 'Alert check failed' });
  }
});

export default alertsRouter;
