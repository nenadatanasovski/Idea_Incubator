// agents/knowledge-base/queries.ts - High-level query functions for agents

import {
  queryKnowledge,
  getGotchasForFile,
  getPatternsForFile,
  KnowledgeEntry,
  KnowledgeType,
} from './index.js';

/**
 * Get all gotchas relevant to a specific file being worked on
 * Used by Build Agent before executing a task
 */
export async function getRelevantGotchas(
  filePath: string,
  actionType?: string
): Promise<KnowledgeEntry[]> {
  // Get gotchas matching the file pattern
  const byFile = await getGotchasForFile(filePath);

  // Filter by action type if specified
  if (actionType) {
    return byFile.filter(
      (g) => g.actionTypes.length === 0 || g.actionTypes.includes(actionType)
    );
  }

  return byFile;
}

/**
 * Get all patterns relevant to a specific file type
 * Used by Spec Agent when generating code templates
 */
export async function getRelevantPatterns(
  filePath: string,
  actionType?: string
): Promise<KnowledgeEntry[]> {
  const byFile = await getPatternsForFile(filePath);

  if (actionType) {
    return byFile.filter(
      (p) => p.actionTypes.length === 0 || p.actionTypes.includes(actionType)
    );
  }

  return byFile;
}

/**
 * Get high-confidence entries that could be promoted to CLAUDE.md
 */
export async function getPromotionCandidates(
  minConfidence: number = 0.8,
  minOccurrences: number = 2
): Promise<KnowledgeEntry[]> {
  const entries = await queryKnowledge({
    minConfidence,
  });

  return entries.filter((e) => e.occurrences >= minOccurrences);
}

/**
 * Search knowledge base by content
 */
export async function searchKnowledge(
  searchTerm: string,
  type?: KnowledgeType
): Promise<KnowledgeEntry[]> {
  const entries = await queryKnowledge({ type });

  const lowerSearch = searchTerm.toLowerCase();
  return entries.filter((e) => e.content.toLowerCase().includes(lowerSearch));
}

/**
 * Get knowledge entries grouped by type
 */
export async function getKnowledgeByType(): Promise<
  Record<KnowledgeType, KnowledgeEntry[]>
> {
  const [gotchas, patterns, decisions] = await Promise.all([
    queryKnowledge({ type: 'gotcha' }),
    queryKnowledge({ type: 'pattern' }),
    queryKnowledge({ type: 'decision' }),
  ]);

  return {
    gotcha: gotchas,
    pattern: patterns,
    decision: decisions,
  };
}

/**
 * Get statistics about the knowledge base
 */
export async function getKnowledgeStats(): Promise<{
  totalEntries: number;
  byType: Record<KnowledgeType, number>;
  averageConfidence: number;
  promotionReady: number;
}> {
  const byType = await getKnowledgeByType();

  const allEntries = [
    ...byType.gotcha,
    ...byType.pattern,
    ...byType.decision,
  ];

  const totalEntries = allEntries.length;
  const averageConfidence =
    totalEntries > 0
      ? allEntries.reduce((sum, e) => sum + e.confidence, 0) / totalEntries
      : 0;

  const promotionReady = allEntries.filter(
    (e) => e.confidence >= 0.8 && e.occurrences >= 2
  ).length;

  return {
    totalEntries,
    byType: {
      gotcha: byType.gotcha.length,
      pattern: byType.pattern.length,
      decision: byType.decision.length,
    },
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    promotionReady,
  };
}

/**
 * Get recent knowledge entries
 */
export async function getRecentEntries(
  limit: number = 20
): Promise<KnowledgeEntry[]> {
  const entries = await queryKnowledge({ limit });
  // Sort by createdAt descending
  return entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
