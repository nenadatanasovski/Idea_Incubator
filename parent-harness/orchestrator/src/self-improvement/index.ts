/**
 * Self-Improvement System
 * 
 * Allows the harness to modify its own configuration and behavior
 * based on learned patterns. All modifications are logged and reversible.
 */

import { query, run, getOne } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

export interface Modification {
  id: string;
  type: 'config' | 'prompt' | 'threshold' | 'workflow';
  target: string; // What was modified
  old_value: string;
  new_value: string;
  reason: string;
  status: 'pending' | 'applied' | 'reverted' | 'rejected';
  applied_at: string | null;
  reverted_at: string | null;
  created_at: string;
}

// Configuration store (in-memory with persistence)
const config: Record<string, unknown> = {
  // Orchestrator settings
  tick_interval_ms: 30000,
  stuck_threshold_ms: 15 * 60 * 1000,
  max_fix_attempts: 5,
  
  // Agent settings
  default_model: 'opus',
  session_timeout_s: 1800,
  
  // QA settings
  auto_qa_enabled: true,
  qa_retry_count: 3,
  
  // Wave settings
  max_parallel_agents: 5,
  wave_timeout_ms: 60 * 60 * 1000, // 1 hour
};

// Ensure modifications table exists
function ensureModificationsTable(): void {
  run(`
    CREATE TABLE IF NOT EXISTS harness_modifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      old_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      applied_at TEXT,
      reverted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `, []);
}

ensureModificationsTable();

/**
 * Get current config value
 */
export function getConfig<T = unknown>(key: string): T | undefined {
  return config[key] as T | undefined;
}

/**
 * Get all config
 */
export function getAllConfig(): Record<string, unknown> {
  return { ...config };
}

/**
 * Propose a configuration change
 */
export function proposeChange(
  type: Modification['type'],
  target: string,
  newValue: unknown,
  reason: string
): Modification {
  const oldValue = config[target];
  const id = uuidv4();

  run(`
    INSERT INTO harness_modifications (id, type, target, old_value, new_value, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [
    id,
    type,
    target,
    JSON.stringify(oldValue ?? null),
    JSON.stringify(newValue),
    reason,
  ]);

  console.log(`📝 Proposed change: ${target} = ${JSON.stringify(newValue)} (${reason})`);

  return getModification(id)!;
}

/**
 * Apply a pending modification
 */
export function applyModification(id: string): boolean {
  const mod = getModification(id);
  if (!mod || mod.status !== 'pending') {
    return false;
  }

  // Apply the change
  const newValue = JSON.parse(mod.new_value);
  config[mod.target] = newValue;

  // Update status
  run(`
    UPDATE harness_modifications 
    SET status = 'applied', applied_at = datetime('now')
    WHERE id = ?
  `, [id]);

  console.log(`✅ Applied modification: ${mod.target} = ${mod.new_value}`);

  return true;
}

/**
 * Revert an applied modification
 */
export function revertModification(id: string): boolean {
  const mod = getModification(id);
  if (!mod || mod.status !== 'applied') {
    return false;
  }

  // Revert the change
  const oldValue = JSON.parse(mod.old_value);
  config[mod.target] = oldValue;

  // Update status
  run(`
    UPDATE harness_modifications 
    SET status = 'reverted', reverted_at = datetime('now')
    WHERE id = ?
  `, [id]);

  console.log(`↩️ Reverted modification: ${mod.target} back to ${mod.old_value}`);

  return true;
}

/**
 * Reject a pending modification
 */
export function rejectModification(id: string, reason?: string): boolean {
  const mod = getModification(id);
  if (!mod || mod.status !== 'pending') {
    return false;
  }

  run(`
    UPDATE harness_modifications 
    SET status = 'rejected'
    WHERE id = ?
  `, [id]);

  console.log(`❌ Rejected modification: ${mod.target} (${reason || 'no reason given'})`);

  return true;
}

/**
 * Get a modification
 */
export function getModification(id: string): Modification | undefined {
  return getOne<Modification>('SELECT * FROM harness_modifications WHERE id = ?', [id]);
}

/**
 * Get pending modifications
 */
export function getPendingModifications(): Modification[] {
  return query<Modification>(
    "SELECT * FROM harness_modifications WHERE status = 'pending' ORDER BY created_at ASC"
  );
}

/**
 * Get modification history
 */
export function getModificationHistory(limit = 50): Modification[] {
  return query<Modification>(
    'SELECT * FROM harness_modifications ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
}

/**
 * Auto-tune based on performance
 */
export function autoTune(): Modification[] {
  const modifications: Modification[] = [];

  // Example: Adjust tick interval based on load
  const workingCount = getOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM agents WHERE status = 'working'"
  );

  if ((workingCount?.count ?? 0) === 0) {
    // No agents working, can slow down ticks
    const current = getConfig<number>('tick_interval_ms') ?? 30000;
    if (current < 60000) {
      const mod = proposeChange(
        'config',
        'tick_interval_ms',
        60000,
        'No active agents - reducing tick frequency to save resources'
      );
      modifications.push(mod);
    }
  }

  // Example: Adjust max parallel based on success rate
  const recentTasks = query<{ status: string }>(
    "SELECT status FROM tasks WHERE updated_at > datetime('now', '-1 hour')"
  );
  
  if (recentTasks.length > 10) {
    const failRate = recentTasks.filter(t => t.status === 'failed').length / recentTasks.length;
    
    if (failRate > 0.3) {
      // High fail rate - reduce parallelism
      const current = getConfig<number>('max_parallel_agents') ?? 5;
      if (current > 2) {
        const mod = proposeChange(
          'config',
          'max_parallel_agents',
          current - 1,
          `High failure rate (${(failRate * 100).toFixed(0)}%) - reducing parallelism`
        );
        modifications.push(mod);
      }
    }
  }

  return modifications;
}

export default {
  getConfig,
  getAllConfig,
  proposeChange,
  applyModification,
  revertModification,
  rejectModification,
  getModification,
  getPendingModifications,
  getModificationHistory,
  autoTune,
};
