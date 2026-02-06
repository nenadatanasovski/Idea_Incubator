/**
 * Budget & Rate Limiting System
 * 
 * Tracks token usage and enforces daily/monthly caps:
 * - Per-agent token tracking
 * - Daily/monthly limits
 * - Cost estimation
 * - Usage alerts
 */

import { run, query, getOne } from '../db/index.js';
import { notify } from '../telegram/index.js';
import { v4 as uuidv4 } from 'uuid';

// Model pricing (per 1M tokens)
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4-5': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-sonnet': { input: 3, output: 15 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'sonnet': { input: 3, output: 15 },
  'opus': { input: 15, output: 75 },
  'haiku': { input: 0.25, output: 1.25 },
};

// Default limits
const DEFAULT_DAILY_LIMIT_USD = 50;
const DEFAULT_MONTHLY_LIMIT_USD = 500;
const WARNING_THRESHOLD_PERCENT = 80;

export interface TokenUsage {
  id: string;
  agent_id: string;
  session_id: string | null;
  task_id: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  byAgent: Record<string, { tokens: number; costUsd: number }>;
  byModel: Record<string, { tokens: number; costUsd: number }>;
}

export interface BudgetConfig {
  dailyLimitUsd: number;
  monthlyLimitUsd: number;
  warningThresholdPercent: number;
}

// Ensure budget tables exist
function ensureBudgetTables(): void {
  run(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      task_id TEXT,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, []);

  run(`
    CREATE TABLE IF NOT EXISTS budget_config (
      id TEXT PRIMARY KEY DEFAULT 'global',
      daily_limit_usd REAL DEFAULT ${DEFAULT_DAILY_LIMIT_USD},
      monthly_limit_usd REAL DEFAULT ${DEFAULT_MONTHLY_LIMIT_USD},
      warning_threshold_percent INTEGER DEFAULT ${WARNING_THRESHOLD_PERCENT},
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `, []);

  run(`CREATE INDEX IF NOT EXISTS idx_token_usage_agent ON token_usage(agent_id)`, []);
  run(`CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(created_at)`, []);

  // Ensure default config exists
  run(`
    INSERT OR IGNORE INTO budget_config (id) VALUES ('global')
  `);
}

ensureBudgetTables();

/**
 * Calculate cost for token usage
 */
export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['sonnet'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Record token usage
 */
export function recordUsage(
  agentId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  options?: { sessionId?: string; taskId?: string }
): TokenUsage {
  const id = uuidv4();
  const costUsd = calculateCost(model, inputTokens, outputTokens);

  run(`
    INSERT INTO token_usage (id, agent_id, session_id, task_id, model, input_tokens, output_tokens, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    agentId,
    options?.sessionId || null,
    options?.taskId || null,
    model,
    inputTokens,
    outputTokens,
    costUsd,
  ]);

  // Check budget after recording
  checkBudgetWarnings();

  return {
    id,
    agent_id: agentId,
    session_id: options?.sessionId || null,
    task_id: options?.taskId || null,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    created_at: new Date().toISOString(),
  };
}

/**
 * Get daily usage
 */
export function getDailyUsage(date?: string): UsageSummary {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const usage = query<TokenUsage>(`
    SELECT * FROM token_usage 
    WHERE date(created_at) = date(?)
  `, [targetDate]);

  return summarizeUsage(usage);
}

/**
 * Get monthly usage
 */
export function getMonthlyUsage(year?: number, month?: number): UsageSummary {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetMonth = month || now.getMonth() + 1;
  
  const usage = query<TokenUsage>(`
    SELECT * FROM token_usage 
    WHERE strftime('%Y', created_at) = ? 
      AND strftime('%m', created_at) = ?
  `, [String(targetYear), String(targetMonth).padStart(2, '0')]);

  return summarizeUsage(usage);
}

/**
 * Get agent usage
 */
export function getAgentUsage(agentId: string, days: number = 7): UsageSummary {
  const usage = query<TokenUsage>(`
    SELECT * FROM token_usage 
    WHERE agent_id = ? 
      AND created_at > datetime('now', '-${days} days')
  `, [agentId]);

  return summarizeUsage(usage);
}

/**
 * Summarize usage records
 */
function summarizeUsage(usage: TokenUsage[]): UsageSummary {
  const summary: UsageSummary = {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    byAgent: {},
    byModel: {},
  };

  for (const record of usage) {
    summary.totalInputTokens += record.input_tokens;
    summary.totalOutputTokens += record.output_tokens;
    summary.totalCostUsd += record.cost_usd;

    // By agent
    if (!summary.byAgent[record.agent_id]) {
      summary.byAgent[record.agent_id] = { tokens: 0, costUsd: 0 };
    }
    summary.byAgent[record.agent_id].tokens += record.input_tokens + record.output_tokens;
    summary.byAgent[record.agent_id].costUsd += record.cost_usd;

    // By model
    if (!summary.byModel[record.model]) {
      summary.byModel[record.model] = { tokens: 0, costUsd: 0 };
    }
    summary.byModel[record.model].tokens += record.input_tokens + record.output_tokens;
    summary.byModel[record.model].costUsd += record.cost_usd;
  }

  return summary;
}

/**
 * Get budget config
 */
export function getBudgetConfig(): BudgetConfig {
  const config = getOne<{
    daily_limit_usd: number;
    monthly_limit_usd: number;
    warning_threshold_percent: number;
  }>('SELECT * FROM budget_config WHERE id = ?', ['global']);

  return {
    dailyLimitUsd: config?.daily_limit_usd || DEFAULT_DAILY_LIMIT_USD,
    monthlyLimitUsd: config?.monthly_limit_usd || DEFAULT_MONTHLY_LIMIT_USD,
    warningThresholdPercent: config?.warning_threshold_percent || WARNING_THRESHOLD_PERCENT,
  };
}

/**
 * Update budget config
 */
export function updateBudgetConfig(updates: Partial<BudgetConfig>): void {
  const sets: string[] = ['updated_at = datetime(\'now\')'];
  const params: unknown[] = [];

  if (updates.dailyLimitUsd !== undefined) {
    sets.push('daily_limit_usd = ?');
    params.push(updates.dailyLimitUsd);
  }
  if (updates.monthlyLimitUsd !== undefined) {
    sets.push('monthly_limit_usd = ?');
    params.push(updates.monthlyLimitUsd);
  }
  if (updates.warningThresholdPercent !== undefined) {
    sets.push('warning_threshold_percent = ?');
    params.push(updates.warningThresholdPercent);
  }

  params.push('global');
  run(`UPDATE budget_config SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * Check if within budget
 */
export function isWithinBudget(): { daily: boolean; monthly: boolean; dailyRemaining: number; monthlyRemaining: number } {
  const config = getBudgetConfig();
  const daily = getDailyUsage();
  const monthly = getMonthlyUsage();

  return {
    daily: daily.totalCostUsd < config.dailyLimitUsd,
    monthly: monthly.totalCostUsd < config.monthlyLimitUsd,
    dailyRemaining: Math.max(0, config.dailyLimitUsd - daily.totalCostUsd),
    monthlyRemaining: Math.max(0, config.monthlyLimitUsd - monthly.totalCostUsd),
  };
}

/**
 * Check budget and send warnings
 */
export async function checkBudgetWarnings(): Promise<void> {
  const config = getBudgetConfig();
  const daily = getDailyUsage();
  const monthly = getMonthlyUsage();

  const dailyPercent = (daily.totalCostUsd / config.dailyLimitUsd) * 100;
  const monthlyPercent = (monthly.totalCostUsd / config.monthlyLimitUsd) * 100;

  // Daily warning
  if (dailyPercent >= config.warningThresholdPercent && dailyPercent < 100) {
    await notify.systemStatus(0, 0, 0); // Would use custom notification
    console.warn(`⚠️ Daily budget at ${dailyPercent.toFixed(1)}% ($${daily.totalCostUsd.toFixed(2)}/$${config.dailyLimitUsd})`);
  }

  // Monthly warning
  if (monthlyPercent >= config.warningThresholdPercent && monthlyPercent < 100) {
    console.warn(`⚠️ Monthly budget at ${monthlyPercent.toFixed(1)}% ($${monthly.totalCostUsd.toFixed(2)}/$${config.monthlyLimitUsd})`);
  }

  // Budget exceeded
  if (dailyPercent >= 100) {
    console.error(`🛑 Daily budget exceeded! $${daily.totalCostUsd.toFixed(2)}/$${config.dailyLimitUsd}`);
  }
  if (monthlyPercent >= 100) {
    console.error(`🛑 Monthly budget exceeded! $${monthly.totalCostUsd.toFixed(2)}/$${config.monthlyLimitUsd}`);
  }
}

/**
 * Get budget status string for display
 */
export function getBudgetStatusString(): string {
  const config = getBudgetConfig();
  const daily = getDailyUsage();
  const monthly = getMonthlyUsage();

  const dailyPercent = (daily.totalCostUsd / config.dailyLimitUsd) * 100;
  const monthlyPercent = (monthly.totalCostUsd / config.monthlyLimitUsd) * 100;

  const dailyIcon = dailyPercent >= 100 ? '🛑' : dailyPercent >= 80 ? '⚠️' : '✅';
  const monthlyIcon = monthlyPercent >= 100 ? '🛑' : monthlyPercent >= 80 ? '⚠️' : '✅';

  return `${dailyIcon} Daily: $${daily.totalCostUsd.toFixed(2)}/$${config.dailyLimitUsd} (${dailyPercent.toFixed(0)}%)\n` +
         `${monthlyIcon} Monthly: $${monthly.totalCostUsd.toFixed(2)}/$${config.monthlyLimitUsd} (${monthlyPercent.toFixed(0)}%)`;
}

export default {
  MODEL_PRICING,
  calculateCost,
  recordUsage,
  getDailyUsage,
  getMonthlyUsage,
  getAgentUsage,
  getBudgetConfig,
  updateBudgetConfig,
  isWithinBudget,
  checkBudgetWarnings,
  getBudgetStatusString,
};
