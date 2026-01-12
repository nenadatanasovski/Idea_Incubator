// agents/sia/duplicate-detector.ts - Detect and merge duplicate knowledge entries

import { KnowledgeEntry, KnowledgeType } from '../../types/sia.js';

const SIMILARITY_THRESHOLD = 0.7;

/**
 * Find a duplicate entry in the knowledge base
 */
export async function findDuplicate(
  content: string,
  type: KnowledgeType,
  existingEntries: KnowledgeEntry[]
): Promise<KnowledgeEntry | null> {
  const filtered = existingEntries.filter((e) => e.type === type);

  for (const entry of filtered) {
    const similarity = calculateSimilarity(content, entry.content);
    if (similarity >= SIMILARITY_THRESHOLD) {
      return entry;
    }
  }

  return null;
}

/**
 * Calculate similarity between two strings using Jaccard index on words
 */
export function calculateSimilarity(a: string, b: string): number {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);

  if (wordsA.size === 0 && wordsB.size === 0) {
    return 1;
  }

  if (wordsA.size === 0 || wordsB.size === 0) {
    return 0;
  }

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}

/**
 * Tokenize text into a set of normalized words
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Determine if two entries should be merged based on similarity
 */
export function shouldMerge(similarity: number): boolean {
  return similarity >= SIMILARITY_THRESHOLD;
}

/**
 * Merge a new content into an existing entry
 * Returns updated entry with increased occurrences and potentially updated content
 */
export function mergeEntries(
  existing: KnowledgeEntry,
  newContent: string,
  newFilePatterns: string[],
  newActionTypes: string[]
): KnowledgeEntry {
  // Merge file patterns (union)
  const mergedFilePatterns = [
    ...new Set([...existing.filePatterns, ...newFilePatterns]),
  ];

  // Merge action types (union)
  const mergedActionTypes = [
    ...new Set([...existing.actionTypes, ...newActionTypes]),
  ];

  // Keep the longer/more detailed content
  const mergedContent =
    newContent.length > existing.content.length ? newContent : existing.content;

  return {
    ...existing,
    content: mergedContent,
    filePatterns: mergedFilePatterns,
    actionTypes: mergedActionTypes,
    occurrences: existing.occurrences + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate normalized Levenshtein distance (alternative similarity measure)
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
