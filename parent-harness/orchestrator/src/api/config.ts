import { Router } from 'express';
import * as selfImprovement from '../self-improvement/index.js';
import * as planning from '../planning/index.js';
import * as config from '../config/index.js';
import * as budget from '../budget/index.js';
import * as agents from '../db/agents.js';
import * as tasks from '../db/tasks.js';
import * as sessions from '../db/sessions.js';

export const configRouter = Router();

// ============ HARNESS CONFIGURATION ============

/**
 * GET /api/config
 * Get current harness configuration
 */
configRouter.get('/', (_req, res) => {
  const cfg = config.getConfig();
  res.json({
    ...cfg,
    // Include runtime info
    _runtime: {
      configPath: config.getConfigPath(),
      envOverrides: {
        HARNESS_SPAWN_AGENTS: process.env.HARNESS_SPAWN_AGENTS,
        HARNESS_RUN_PLANNING: process.env.HARNESS_RUN_PLANNING,
        HARNESS_RUN_QA: process.env.HARNESS_RUN_QA,
      },
    },
  });
});

/**
 * PATCH /api/config
 * Update harness configuration (partial update)
 */
configRouter.patch('/', (req, res) => {
  const updates = req.body;

  // Validate
  const validation = config.validateConfig(updates);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Invalid configuration',
      details: validation.errors
    });
  }

  const newConfig = config.updateConfig(updates);
  return res.json({
    success: true,
    config: newConfig,
    message: 'Configuration updated. Some changes may require restart.',
  });
});

/**
 * POST /api/config/reset
 * Reset configuration to defaults
 */
configRouter.post('/reset', (_req, res) => {
  const defaultConfig = config.resetConfig();
  res.json({ 
    success: true, 
    config: defaultConfig,
    message: 'Configuration reset to defaults',
  });
});

// ============ DASHBOARD STATS ============

/**
 * GET /api/config/stats
 * Get current system stats for dashboard
 */
configRouter.get('/stats', (_req, res) => {
  const allAgents = agents.getAgents();
  const workingAgents = agents.getWorkingAgents();
  const idleAgents = agents.getIdleAgents();
  const pendingTasks = tasks.getPendingTasks();
  const inProgressTasks = tasks.getTasks({ status: 'in_progress' });
  const completedTasks = tasks.getTasks({ status: 'completed' });
  const failedTasks = tasks.getTasks({ status: 'failed' });
  
  // Get recent sessions
  const recentSessions = sessions.getSessions({ limit: 20 });
  const activeSessions = recentSessions.filter(s => s.status === 'running');
  
  res.json({
    agents: {
      total: allAgents.length,
      working: workingAgents.length,
      idle: idleAgents.length,
      stuck: allAgents.filter(a => a.status === 'stuck').length,
    },
    tasks: {
      pending: pendingTasks.length,
      in_progress: inProgressTasks.length,
      completed: completedTasks.length,
      failed: failedTasks.length,
      pending_verification: tasks.getTasks({ status: 'pending_verification' as any }).length,
    },
    sessions: {
      active: activeSessions.length,
      recent: recentSessions.length,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/config/budget
 * Get budget/token usage status
 */
configRouter.get('/budget', (_req, res) => {
  const dailyUsage = budget.getDailyUsage();
  const monthlyUsage = budget.getMonthlyUsage();
  const _budgetConfig = budget.getBudgetConfig();
  const cfg = config.getConfig();
  
  const dailyLimit = cfg.budget.daily_token_limit;
  const dailyPercent = dailyLimit > 0 ? (dailyUsage.totalInputTokens + dailyUsage.totalOutputTokens) / dailyLimit * 100 : 0;
  
  res.json({
    daily: {
      tokens: {
        input: dailyUsage.totalInputTokens,
        output: dailyUsage.totalOutputTokens,
        total: dailyUsage.totalInputTokens + dailyUsage.totalOutputTokens,
      },
      cost_usd: dailyUsage.totalCostUsd,
      limit_tokens: dailyLimit,
      percent_used: Math.round(dailyPercent * 100) / 100,
      by_model: dailyUsage.byModel,
      by_agent: dailyUsage.byAgent,
    },
    monthly: {
      tokens: {
        input: monthlyUsage.totalInputTokens,
        output: monthlyUsage.totalOutputTokens,
        total: monthlyUsage.totalInputTokens + monthlyUsage.totalOutputTokens,
      },
      cost_usd: monthlyUsage.totalCostUsd,
      by_model: monthlyUsage.byModel,
    },
    config: {
      daily_token_limit: cfg.budget.daily_token_limit,
      warn_thresholds: cfg.budget.warn_thresholds,
      pause_at_limit: cfg.budget.pause_at_limit,
    },
    budget_status: getBudgetStatus(dailyPercent, cfg.budget),
    timestamp: new Date().toISOString(),
  });
});

function getBudgetStatus(percent: number, budgetCfg: config.HarnessConfig['budget']): string {
  if (percent >= 100) return 'EXCEEDED';
  for (const threshold of [...budgetCfg.warn_thresholds].sort((a, b) => b - a)) {
    if (percent >= threshold) return `WARNING_${threshold}`;
  }
  return 'OK';
}

// ============ RETRY & PLANNING ============

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
 * GET /api/config/planning/analyze
 * Run performance analysis
 */
configRouter.get('/planning/analyze', (_req, res) => {
  const analysis = planning.analyzePerformance();
  res.json(analysis);
});

/**
 * POST /api/config/planning/daily
 * Run daily planning
 */
configRouter.post('/planning/daily', async (req, res) => {
  const { taskListId } = req.body;
  if (!taskListId) {
    return res.status(400).json({ error: 'Missing taskListId', status: 400 });
  }

  const session = await planning.runDailyPlanning(taskListId);
  return res.json(session);
});

/**
 * POST /api/config/planning/clear-cache
 * Clear the cached strategic plan
 */
configRouter.post('/planning/clear-cache', (_req, res) => {
  planning.clearPlanCache();
  res.json({ success: true, message: 'Plan cache cleared' });
});
