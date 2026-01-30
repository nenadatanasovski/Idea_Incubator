// agents/sia/knowledge-writer.ts - Write knowledge entries to the database
// Memory Graph Migration: Also writes learnings to memory_blocks for unified graph storage

import { v4 as uuid } from "uuid";
import {
  KnowledgeEntry,
  ExtractedGotcha,
  ExtractedPattern,
} from "../../types/sia.js";
import { findDuplicate, mergeEntries } from "./duplicate-detector.js";
import {
  CONFIDENCE_CONFIG,
  calculateInitialConfidence,
} from "./confidence-tracker.js";
import {
  saveKnowledgeEntry,
  updateKnowledgeEntry,
  queryKnowledge,
} from "./db.js";
import { getDb, saveDb } from "../../database/db.js";

/**
 * Write a gotcha to the knowledge base
 * Returns the entry (either new or merged with existing)
 * Memory Graph Migration: Optionally writes to memory graph when sessionId provided
 */
export async function writeGotcha(
  gotcha: ExtractedGotcha,
  executionId: string,
  agentType: string,
  sessionId?: string,
): Promise<KnowledgeEntry> {
  // Get existing entries for duplicate check
  const existingEntries = await queryKnowledge({ type: "gotcha" });

  // Check for duplicates
  const duplicate = await findDuplicate(gotcha.fix, "gotcha", existingEntries);

  if (duplicate) {
    // Merge with existing
    const merged = mergeEntries(
      duplicate,
      gotcha.fix,
      [gotcha.filePattern],
      [gotcha.actionType],
    );
    await updateKnowledgeEntry(merged);

    // Update memory graph confidence if sessionId provided
    if (sessionId) {
      await updateMemoryGraphConfidence(
        merged.id,
        merged.confidence,
        merged.occurrences,
      );
    }

    return merged;
  }

  // Create new entry
  const entry: KnowledgeEntry = {
    id: uuid(),
    type: "gotcha",
    content: gotcha.fix,
    filePatterns: [gotcha.filePattern],
    actionTypes: [gotcha.actionType],
    confidence: calculateInitialConfidence(true, !!gotcha.fix),
    occurrences: 1,
    source: {
      executionId,
      taskId: gotcha.taskId,
      agentType,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveKnowledgeEntry(entry);

  // Also write to memory graph if sessionId provided
  if (sessionId) {
    await writeToMemoryGraph(entry, sessionId);
  }

  return entry;
}

/**
 * Write a pattern to the knowledge base
 * Memory Graph Migration: Optionally writes to memory graph when sessionId provided
 */
export async function writePattern(
  pattern: ExtractedPattern,
  executionId: string,
  agentType: string,
  sessionId?: string,
): Promise<KnowledgeEntry> {
  // Get existing entries for duplicate check
  const existingEntries = await queryKnowledge({ type: "pattern" });

  // Check for duplicates
  const duplicate = await findDuplicate(
    pattern.description,
    "pattern",
    existingEntries,
  );

  if (duplicate) {
    // Merge with existing
    const merged = mergeEntries(
      duplicate,
      pattern.codeTemplate,
      [pattern.filePattern],
      [pattern.actionType],
    );
    await updateKnowledgeEntry(merged);

    // Update memory graph confidence if sessionId provided
    if (sessionId) {
      await updateMemoryGraphConfidence(
        merged.id,
        merged.confidence,
        merged.occurrences,
      );
    }

    return merged;
  }

  // Create new entry
  const entry: KnowledgeEntry = {
    id: uuid(),
    type: "pattern",
    content: `${pattern.description}\n\n\`\`\`typescript\n${pattern.codeTemplate}\n\`\`\``,
    filePatterns: [pattern.filePattern],
    actionTypes: [pattern.actionType],
    confidence: CONFIDENCE_CONFIG.initial,
    occurrences: 1,
    source: {
      executionId,
      taskId: pattern.taskId,
      agentType,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveKnowledgeEntry(entry);

  // Also write to memory graph if sessionId provided
  if (sessionId) {
    await writeToMemoryGraph(entry, sessionId);
  }

  return entry;
}

/**
 * Write a decision to the knowledge base
 */
export async function writeDecision(
  decision: string,
  context: string,
  executionId: string,
  taskId: string,
  agentType: string,
): Promise<KnowledgeEntry> {
  const entry: KnowledgeEntry = {
    id: uuid(),
    type: "decision",
    content: `${decision}\n\nContext: ${context}`,
    filePatterns: [],
    actionTypes: [],
    confidence: CONFIDENCE_CONFIG.initial,
    occurrences: 1,
    source: {
      executionId,
      taskId,
      agentType,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveKnowledgeEntry(entry);
  return entry;
}

/**
 * Increment occurrences for an existing entry
 */
export async function incrementOccurrences(entryId: string): Promise<void> {
  const entries = await queryKnowledge({});
  const entry = entries.find((e) => e.id === entryId);

  if (entry) {
    await updateKnowledgeEntry({
      ...entry,
      occurrences: entry.occurrences + 1,
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Batch write multiple gotchas
 */
export async function writeGotchas(
  gotchas: ExtractedGotcha[],
  executionId: string,
  agentType: string,
): Promise<KnowledgeEntry[]> {
  const entries: KnowledgeEntry[] = [];

  for (const gotcha of gotchas) {
    const entry = await writeGotcha(gotcha, executionId, agentType);
    entries.push(entry);
  }

  return entries;
}

/**
 * Batch write multiple patterns
 */
export async function writePatterns(
  patterns: ExtractedPattern[],
  executionId: string,
  agentType: string,
): Promise<KnowledgeEntry[]> {
  const entries: KnowledgeEntry[] = [];

  for (const pattern of patterns) {
    const entry = await writePattern(pattern, executionId, agentType);
    entries.push(entry);
  }

  return entries;
}

// ============================================================================
// Memory Graph Integration (Memory Graph Migration)
// ============================================================================

/**
 * Write a learning to the memory graph
 * This creates a block in memory_blocks with appropriate types and memberships
 */
export async function writeToMemoryGraph(
  entry: KnowledgeEntry,
  sessionId?: string,
): Promise<string | null> {
  // Skip if no session ID provided (can't associate with a session)
  if (!sessionId) {
    console.log(
      "[KnowledgeWriter] No sessionId provided, skipping memory graph write",
    );
    return null;
  }

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const blockId = `learning_${entry.id}`;

    // Determine block type based on entry type
    const blockType = entry.type === "gotcha" ? "learning" : "pattern";

    // Build properties
    const properties = {
      knowledge_entry_id: entry.id,
      type: entry.type,
      file_patterns: entry.filePatterns,
      action_types: entry.actionTypes,
      occurrences: entry.occurrences,
      source_execution_id: entry.source.executionId,
      source_task_id: entry.source.taskId,
      source_agent_type: entry.source.agentType,
    };

    // Insert into memory_blocks
    db.run(
      `INSERT INTO memory_blocks
       (id, session_id, type, content, properties, status, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        blockId,
        sessionId,
        blockType,
        entry.content,
        JSON.stringify(properties),
        entry.confidence,
        now,
        now,
      ],
    );

    // Insert block type
    db.run(
      `INSERT OR IGNORE INTO memory_block_types (block_id, block_type) VALUES (?, ?)`,
      [blockId, blockType],
    );

    // Insert graph membership (validation dimension for learnings)
    db.run(
      `INSERT INTO memory_graph_memberships (block_id, graph_type, created_at) VALUES (?, ?, ?)`,
      [blockId, "validation", now],
    );

    await saveDb();

    console.log(
      `[KnowledgeWriter] Written learning to memory graph: ${blockId} (${blockType})`,
    );
    return blockId;
  } catch (error) {
    console.error("[KnowledgeWriter] Failed to write to memory graph:", error);
    return null;
  }
}

/**
 * Update confidence of existing learning in memory graph
 */
export async function updateMemoryGraphConfidence(
  knowledgeEntryId: string,
  newConfidence: number,
  newOccurrences: number,
): Promise<void> {
  try {
    const db = await getDb();
    const blockId = `learning_${knowledgeEntryId}`;
    const now = new Date().toISOString();

    // Get existing properties
    const stmt = db.prepare(
      `SELECT properties FROM memory_blocks WHERE id = ?`,
    );
    stmt.bind([blockId]);

    if (stmt.step()) {
      const row = stmt.getAsObject();
      const existingProps = row.properties
        ? JSON.parse(row.properties as string)
        : {};

      // Update with new values
      const updatedProps = {
        ...existingProps,
        occurrences: newOccurrences,
        last_seen: now,
      };

      db.run(
        `UPDATE memory_blocks SET confidence = ?, properties = ?, updated_at = ? WHERE id = ?`,
        [newConfidence, JSON.stringify(updatedProps), now, blockId],
      );

      await saveDb();
      console.log(
        `[KnowledgeWriter] Updated memory graph confidence: ${blockId} -> ${newConfidence}`,
      );
    }
    stmt.free();
  } catch (error) {
    console.error(
      "[KnowledgeWriter] Failed to update memory graph confidence:",
      error,
    );
  }
}

/**
 * Check for duplicate learning in memory graph by content similarity
 */
export async function findDuplicateInGraph(
  content: string,
  sessionId: string,
): Promise<string | null> {
  try {
    const db = await getDb();
    const stmt = db.prepare(
      `SELECT id, content FROM memory_blocks
       WHERE session_id = ? AND type IN ('learning', 'pattern') AND status = 'active'`,
    );
    stmt.bind([sessionId]);

    while (stmt.step()) {
      const row = stmt.getAsObject();
      const similarity = calculateSimilarity(content, row.content as string);
      if (similarity > 0.8) {
        stmt.free();
        return row.id as string;
      }
    }
    stmt.free();
    return null;
  } catch (error) {
    console.error(
      "[KnowledgeWriter] Failed to check for duplicates in graph:",
      error,
    );
    return null;
  }
}

/**
 * Calculate text similarity using Jaccard index
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/));
  const wordsB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.size / union.size;
}
