// agents/sia/knowledge-writer.ts - Write knowledge entries to the database

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

/**
 * Write a gotcha to the knowledge base
 * Returns the entry (either new or merged with existing)
 */
export async function writeGotcha(
  gotcha: ExtractedGotcha,
  executionId: string,
  agentType: string,
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
  return entry;
}

/**
 * Write a pattern to the knowledge base
 */
export async function writePattern(
  pattern: ExtractedPattern,
  executionId: string,
  agentType: string,
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
