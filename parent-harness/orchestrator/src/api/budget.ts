/**
 * Budget API Routes
 */
import { Router } from 'express';
import * as budget from '../budget/index.js';

const router = Router();

/**
 * GET /api/budget/status
 * Get budget status
 */
router.get('/status', (_req, res) => {
  const config = budget.getBudgetConfig();
  const daily = budget.getDailyUsage();
  const monthly = budget.getMonthlyUsage();
  const withinBudget = budget.isWithinBudget();

  res.json({
    config,
    daily: {
      ...daily,
      percentUsed: (daily.totalCostUsd / config.dailyLimitUsd) * 100,
    },
    monthly: {
      ...monthly,
      percentUsed: (monthly.totalCostUsd / config.monthlyLimitUsd) * 100,
    },
    withinBudget,
    statusString: budget.getBudgetStatusString(),
  });
});

/**
 * GET /api/budget/daily
 * Get daily usage
 */
router.get('/daily', (req, res) => {
  const date = req.query.date as string;
  const usage = budget.getDailyUsage(date);
  res.json(usage);
});

/**
 * GET /api/budget/monthly
 * Get monthly usage
 */
router.get('/monthly', (req, res) => {
  const year = req.query.year ? parseInt(req.query.year as string) : undefined;
  const month = req.query.month ? parseInt(req.query.month as string) : undefined;
  const usage = budget.getMonthlyUsage(year, month);
  res.json(usage);
});

/**
 * GET /api/budget/agent/:agentId
 * Get agent usage
 */
router.get('/agent/:agentId', (req, res) => {
  const days = parseInt(req.query.days as string) || 7;
  const usage = budget.getAgentUsage(req.params.agentId, days);
  res.json(usage);
});

/**
 * GET /api/budget/config
 * Get budget config
 */
router.get('/config', (_req, res) => {
  const config = budget.getBudgetConfig();
  res.json(config);
});

/**
 * PATCH /api/budget/config
 * Update budget config
 */
router.patch('/config', (req, res) => {
  const updates = req.body;
  budget.updateBudgetConfig(updates);
  const config = budget.getBudgetConfig();
  res.json(config);
});

/**
 * POST /api/budget/record
 * Record token usage (normally called internally)
 */
router.post('/record', (req, res) => {
  const { agentId, model, inputTokens, outputTokens, sessionId, taskId } = req.body;

  if (!agentId || !model || inputTokens === undefined || outputTokens === undefined) {
    return res.status(400).json({ 
      error: 'agentId, model, inputTokens, and outputTokens are required' 
    });
  }

  const usage = budget.recordUsage(agentId, model, inputTokens, outputTokens, {
    sessionId,
    taskId,
  });

  res.json(usage);
});

/**
 * GET /api/budget/pricing
 * Get model pricing
 */
router.get('/pricing', (_req, res) => {
  res.json(budget.MODEL_PRICING);
});

export { router as budgetRouter };
