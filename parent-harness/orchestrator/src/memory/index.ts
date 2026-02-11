/**
 * Agent Memory System
 *
 * Provides persistent memory for agents across sessions.
 * Each agent has its own memory store with:
 * - Short-term context (current task)
 * - Long-term learnings (patterns, preferences)
 * - Task history (what worked, what didn't)
 */

import { query, run, getOne } from "../db/index.js";
import { v4 as uuidv4 } from "uuid";

export interface MemoryEntry {
  id: string;
  agent_id: string;
  type:
    | "context"
    | "learning"
    | "preference"
    | "error_pattern"
    | "success_pattern";
  key: string;
  value: string;
  metadata: string | null;
  importance: number; // 1-10, higher = more important
  access_count: number;
  last_accessed: string;
  created_at: string;
  expires_at: string | null;
}

// Ensure memory table exists
function ensureMemoryTable(): void {
  run(
    `
    CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      metadata TEXT,
      importance INTEGER DEFAULT 5,
      access_count INTEGER DEFAULT 0,
      last_accessed TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      UNIQUE(agent_id, type, key)
    )
  `,
    [],
  );

  run(
    `CREATE INDEX IF NOT EXISTS idx_agent_memory_agent ON agent_memory(agent_id)`,
    [],
  );
  run(
    `CREATE INDEX IF NOT EXISTS idx_agent_memory_type ON agent_memory(type)`,
    [],
  );
}

// Initialize on module load
ensureMemoryTable();

/**
 * Store a memory entry
 */
export function remember(
  agentId: string,
  type: MemoryEntry["type"],
  key: string,
  value: string,
  options?: {
    metadata?: object;
    importance?: number;
    expiresIn?: number; // seconds
  },
): MemoryEntry {
  const id = uuidv4();
  const expiresAt = options?.expiresIn
    ? new Date(Date.now() + options.expiresIn * 1000).toISOString()
    : null;

  run(
    `
    INSERT OR REPLACE INTO agent_memory 
    (id, agent_id, type, key, value, metadata, importance, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      id,
      agentId,
      type,
      key,
      value,
      options?.metadata ? JSON.stringify(options.metadata) : null,
      options?.importance ?? 5,
      expiresAt,
    ],
  );

  return getOne<MemoryEntry>(
    "SELECT * FROM agent_memory WHERE agent_id = ? AND type = ? AND key = ?",
    [agentId, type, key],
  )!;
}

/**
 * Recall a specific memory
 */
export function recall(
  agentId: string,
  type: MemoryEntry["type"],
  key: string,
): MemoryEntry | undefined {
  const entry = getOne<MemoryEntry>(
    "SELECT * FROM agent_memory WHERE agent_id = ? AND type = ? AND key = ?",
    [agentId, type, key],
  );

  if (entry) {
    // Update access stats
    run(
      `
      UPDATE agent_memory 
      SET access_count = access_count + 1, last_accessed = datetime('now')
      WHERE id = ?
    `,
      [entry.id],
    );
  }

  return entry;
}

/**
 * Recall all memories of a type for an agent
 */
export function recallAll(
  agentId: string,
  type?: MemoryEntry["type"],
): MemoryEntry[] {
  if (type) {
    return query<MemoryEntry>(
      "SELECT * FROM agent_memory WHERE agent_id = ? AND type = ? ORDER BY importance DESC, access_count DESC",
      [agentId, type],
    );
  }

  return query<MemoryEntry>(
    "SELECT * FROM agent_memory WHERE agent_id = ? ORDER BY importance DESC, access_count DESC",
    [agentId],
  );
}

/**
 * Forget a specific memory
 */
export function forget(
  agentId: string,
  type: MemoryEntry["type"],
  key: string,
): boolean {
  const result = run(
    "DELETE FROM agent_memory WHERE agent_id = ? AND type = ? AND key = ?",
    [agentId, type, key],
  );
  return result.changes > 0;
}

/**
 * Forget all memories of a type
 */
export function forgetAll(agentId: string, type?: MemoryEntry["type"]): number {
  if (type) {
    const result = run(
      "DELETE FROM agent_memory WHERE agent_id = ? AND type = ?",
      [agentId, type],
    );
    return result.changes;
  }

  const result = run("DELETE FROM agent_memory WHERE agent_id = ?", [agentId]);
  return result.changes;
}

/**
 * Clean up expired memories
 */
export function cleanupExpired(): number {
  const result = run(
    "DELETE FROM agent_memory WHERE expires_at IS NOT NULL AND expires_at < datetime('now')",
  );
  return result.changes;
}

/**
 * Get memory summary for an agent
 */
export function getMemorySummary(agentId: string): {
  total: number;
  byType: Record<string, number>;
  topMemories: MemoryEntry[];
} {
  const all = recallAll(agentId);

  const byType: Record<string, number> = {};
  for (const entry of all) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
  }

  return {
    total: all.length,
    byType,
    topMemories: all.slice(0, 10),
  };
}

/**
 * Store task context (short-term, expires after task)
 */
export function setTaskContext(
  agentId: string,
  taskId: string,
  context: object,
): MemoryEntry {
  return remember(
    agentId,
    "context",
    `task:${taskId}`,
    JSON.stringify(context),
    {
      expiresIn: 24 * 60 * 60, // 24 hours
      importance: 3,
    },
  );
}

/**
 * Get task context
 */
export function getTaskContext(agentId: string, taskId: string): object | null {
  const entry = recall(agentId, "context", `task:${taskId}`);
  if (!entry) return null;

  try {
    return JSON.parse(entry.value);
  } catch {
    return null;
  }
}

/**
 * Learn from a success
 */
export function learnSuccess(
  agentId: string,
  pattern: string,
  details: object,
): MemoryEntry {
  return remember(
    agentId,
    "success_pattern",
    pattern,
    JSON.stringify(details),
    {
      importance: 7,
    },
  );
}

/**
 * Learn from an error
 */
export function learnError(
  agentId: string,
  pattern: string,
  details: object,
): MemoryEntry {
  return remember(agentId, "error_pattern", pattern, JSON.stringify(details), {
    importance: 8, // Errors are important to remember
  });
}

/**
 * Check if agent has seen this error pattern before
 */
export function hasSeenError(
  agentId: string,
  pattern: string,
): MemoryEntry | undefined {
  return recall(agentId, "error_pattern", pattern);
}

export default {
  remember,
  recall,
  recallAll,
  forget,
  forgetAll,
  cleanupExpired,
  getMemorySummary,
  setTaskContext,
  getTaskContext,
  learnSuccess,
  learnError,
  hasSeenError,
};
