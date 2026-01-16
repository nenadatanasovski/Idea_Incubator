// agents/sia/confidence-tracker.ts - Manage confidence scores for knowledge entries

import { v4 as uuid } from "uuid";
import { getDb } from "../../database/db.js";
import { KnowledgeEntry } from "../../types/sia.js";

export const CONFIDENCE_CONFIG = {
  initial: 0.5,
  preventionBoost: 0.15,
  maxConfidence: 0.95,
  minConfidence: 0.1,
  monthlyDecay: 0.05,
  promotionThreshold: 0.8,
  demotionThreshold: 0.3,
};

/**
 * Record that a gotcha prevented an error
 */
export async function recordPrevention(
  entryId: string,
  executionId: string,
  taskId: string,
): Promise<void> {
  const db = await getDb();
  db.run(
    `
    INSERT INTO gotcha_applications (id, knowledge_entry_id, execution_id, task_id, prevented_error)
    VALUES (?, ?, ?, ?, 1)
  `,
    [uuid(), entryId, executionId, taskId],
  );

  await updateConfidence(entryId);
}

/**
 * Update confidence score for an entry based on its applications
 */
export async function updateConfidence(entryId: string): Promise<number> {
  const db = await getDb();

  // Count successful preventions
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count FROM gotcha_applications
    WHERE knowledge_entry_id = ? AND prevented_error = 1
  `);
  countStmt.bind([entryId]);
  countStmt.step();
  const countRow = countStmt.getAsObject();
  countStmt.free();
  const preventions = (countRow.count as number) || 0;

  // Calculate new confidence
  let newConfidence =
    CONFIDENCE_CONFIG.initial + preventions * CONFIDENCE_CONFIG.preventionBoost;

  // Cap at max confidence
  newConfidence = Math.min(newConfidence, CONFIDENCE_CONFIG.maxConfidence);

  // Update the entry
  db.run(
    `
    UPDATE knowledge_entries
    SET confidence = ?, updated_at = datetime('now')
    WHERE id = ?
  `,
    [newConfidence, entryId],
  );

  return newConfidence;
}

/**
 * Apply time-based decay to all entries that haven't been updated recently
 */
export async function applyDecay(): Promise<number> {
  const db = await getDb();

  // Find entries not updated in the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString();

  // Get entries needing decay
  const stmt = db.prepare(`
    SELECT id, confidence FROM knowledge_entries
    WHERE updated_at < ?
  `);
  stmt.bind([cutoffDate]);

  const entriesToDecay: Array<{ id: string; confidence: number }> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    entriesToDecay.push({
      id: row.id as string,
      confidence: row.confidence as number,
    });
  }
  stmt.free();

  // Apply decay
  let updated = 0;
  for (const entry of entriesToDecay) {
    const newConfidence = Math.max(
      entry.confidence - CONFIDENCE_CONFIG.monthlyDecay,
      CONFIDENCE_CONFIG.minConfidence,
    );

    db.run(
      `
      UPDATE knowledge_entries
      SET confidence = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
      [newConfidence, entry.id],
    );
    updated++;
  }

  return updated;
}

/**
 * Get entries eligible for promotion to CLAUDE.md
 */
export async function getPromotionCandidates(): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM knowledge_entries
    WHERE confidence >= ? AND type = 'gotcha'
    ORDER BY confidence DESC
  `);
  stmt.bind([CONFIDENCE_CONFIG.promotionThreshold]);

  const entries: KnowledgeEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    entries.push(rowToEntry(row));
  }
  stmt.free();

  return entries;
}

/**
 * Get entries that may need review due to low confidence
 */
export async function getDemotionCandidates(): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  const stmt = db.prepare(`
    SELECT * FROM knowledge_entries
    WHERE confidence <= ?
    ORDER BY confidence ASC
  `);
  stmt.bind([CONFIDENCE_CONFIG.demotionThreshold]);

  const entries: KnowledgeEntry[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    entries.push(rowToEntry(row));
  }
  stmt.free();

  return entries;
}

/**
 * Calculate confidence score for a new entry based on initial evidence
 */
export function calculateInitialConfidence(
  matchedPredefinedRule: boolean,
  hasAppliedFix: boolean,
): number {
  let confidence = CONFIDENCE_CONFIG.initial;

  // Boost if matched a predefined rule (more reliable)
  if (matchedPredefinedRule) {
    confidence += 0.1;
  }

  // Boost if we have evidence of a fix being applied
  if (hasAppliedFix) {
    confidence += 0.05;
  }

  return Math.min(confidence, CONFIDENCE_CONFIG.maxConfidence);
}

/**
 * Convert database row to KnowledgeEntry
 */
function rowToEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    type: row.type as KnowledgeEntry["type"],
    content: row.content as string,
    filePatterns: JSON.parse((row.file_patterns_json as string) || "[]"),
    actionTypes: JSON.parse((row.action_types_json as string) || "[]"),
    confidence: row.confidence as number,
    occurrences: row.occurrences as number,
    source: {
      executionId: row.source_execution_id as string,
      taskId: row.source_task_id as string,
      agentType: row.source_agent_type as string,
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
