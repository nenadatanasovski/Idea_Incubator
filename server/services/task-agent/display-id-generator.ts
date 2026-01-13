/**
 * Display ID Generator Service
 *
 * Generates human-readable display IDs for tasks.
 * Format: TU-{PROJECT}-{CATEGORY}-{SEQUENCE}
 * Example: TU-PROJ-FEA-042
 *
 * Part of: PTE-025 to PTE-028
 */

import { v4 as uuidv4 } from 'uuid';
import { query, run, getOne, saveDb } from '../../../database/db.js';
import { TaskCategory, CATEGORY_CODES } from '../../../types/task-agent.js';

/**
 * Display ID sequence record from database
 */
interface DisplayIdSequence {
  project_id: string;
  last_sequence: number;
  updated_at: string;
}

/**
 * Default project code when project is unknown
 */
const DEFAULT_PROJECT_CODE = 'GEN';

/**
 * Display ID prefix
 */
const ID_PREFIX = 'TU';

/**
 * Maximum retry attempts for collision handling
 */
const MAX_RETRY_ATTEMPTS = 5;

/**
 * Extract project code from project name or ID
 * Returns a 2-4 character uppercase code
 */
export function extractProjectCode(projectId?: string, projectName?: string): string {
  if (projectName) {
    // Use first 2-4 significant characters
    const cleaned = projectName
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4);

    if (cleaned.length >= 2) {
      return cleaned;
    }
  }

  if (projectId) {
    // Try to extract from project ID
    const cleaned = projectId
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 4);

    if (cleaned.length >= 2) {
      return cleaned;
    }
  }

  return DEFAULT_PROJECT_CODE;
}

/**
 * Get category code from task category
 */
export function getCategoryCode(category: TaskCategory): string {
  return CATEGORY_CODES[category] || 'OTH';
}

/**
 * Format sequence number with leading zeros
 */
export function formatSequence(sequence: number): string {
  return sequence.toString().padStart(3, '0');
}

/**
 * Get the next sequence number for a project
 * Thread-safe with retry on collision
 */
export async function getNextSequence(projectId: string): Promise<number> {
  const normalizedProjectId = projectId || 'default';

  // Try to get existing sequence
  const existing = await getOne<DisplayIdSequence>(
    'SELECT * FROM display_id_sequences WHERE project_id = ?',
    [normalizedProjectId]
  );

  if (existing) {
    const nextSeq = existing.last_sequence + 1;

    // Update the sequence
    await run(
      `UPDATE display_id_sequences
       SET last_sequence = ?, updated_at = datetime('now')
       WHERE project_id = ?`,
      [nextSeq, normalizedProjectId]
    );

    return nextSeq;
  }

  // Create new sequence for project
  const nextSeq = 1;

  try {
    await run(
      `INSERT INTO display_id_sequences (project_id, last_sequence, updated_at)
       VALUES (?, ?, datetime('now'))`,
      [normalizedProjectId, nextSeq]
    );
  } catch (error: unknown) {
    // Handle potential race condition - retry get
    const retryExisting = await getOne<DisplayIdSequence>(
      'SELECT * FROM display_id_sequences WHERE project_id = ?',
      [normalizedProjectId]
    );

    if (retryExisting) {
      const retryNextSeq = retryExisting.last_sequence + 1;
      await run(
        `UPDATE display_id_sequences
         SET last_sequence = ?, updated_at = datetime('now')
         WHERE project_id = ?`,
        [retryNextSeq, normalizedProjectId]
      );
      return retryNextSeq;
    }

    throw error;
  }

  return nextSeq;
}

/**
 * Check if a display ID already exists
 */
export async function displayIdExists(displayId: string): Promise<boolean> {
  const existing = await getOne<{ id: string }>(
    'SELECT id FROM tasks WHERE display_id = ?',
    [displayId]
  );
  return existing !== null;
}

/**
 * Generate a unique display ID for a task
 *
 * @param category Task category
 * @param projectId Project ID
 * @param projectName Project name (optional, for better code extraction)
 * @returns Unique display ID like "TU-PROJ-FEA-042"
 */
export async function generateDisplayId(
  category: TaskCategory,
  projectId?: string,
  projectName?: string
): Promise<string> {
  const projectCode = extractProjectCode(projectId, projectName);
  const categoryCode = getCategoryCode(category);

  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    const sequence = await getNextSequence(projectId || 'default');
    const sequenceStr = formatSequence(sequence);

    const displayId = `${ID_PREFIX}-${projectCode}-${categoryCode}-${sequenceStr}`;

    // Check for collision (shouldn't happen normally)
    const exists = await displayIdExists(displayId);

    if (!exists) {
      await saveDb();
      return displayId;
    }

    attempts++;
    console.warn(`[DisplayIdGenerator] Collision on ${displayId}, retrying (attempt ${attempts})`);
  }

  // Fallback: add random suffix if all retries fail
  const fallbackSequence = await getNextSequence(projectId || 'default');
  const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  const fallbackId = `${ID_PREFIX}-${projectCode}-${categoryCode}-${formatSequence(fallbackSequence)}-${randomSuffix}`;

  console.warn(`[DisplayIdGenerator] Using fallback ID: ${fallbackId}`);
  await saveDb();
  return fallbackId;
}

/**
 * Parse a display ID into its components
 */
export function parseDisplayId(displayId: string): {
  prefix: string;
  projectCode: string;
  categoryCode: string;
  sequence: number;
} | null {
  const match = displayId.match(/^([A-Z]{2})-([A-Z]{2,4})-([A-Z]{3})-(\d{3,})(?:-[A-Z0-9]+)?$/);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    projectCode: match[2],
    categoryCode: match[3],
    sequence: parseInt(match[4], 10),
  };
}

/**
 * Get category from category code
 */
export function getCategoryFromCode(code: string): TaskCategory | null {
  for (const [category, categoryCode] of Object.entries(CATEGORY_CODES)) {
    if (categoryCode === code) {
      return category as TaskCategory;
    }
  }
  return null;
}

/**
 * Validate a display ID format
 */
export function isValidDisplayId(displayId: string): boolean {
  return parseDisplayId(displayId) !== null;
}

/**
 * Get current sequence for a project (without incrementing)
 */
export async function getCurrentSequence(projectId: string): Promise<number> {
  const normalizedProjectId = projectId || 'default';

  const existing = await getOne<DisplayIdSequence>(
    'SELECT * FROM display_id_sequences WHERE project_id = ?',
    [normalizedProjectId]
  );

  return existing?.last_sequence || 0;
}

/**
 * Backfill display IDs for tasks that don't have them
 * Used during migration
 */
export async function backfillDisplayIds(): Promise<{
  updated: number;
  failed: number;
  errors: string[];
}> {
  const tasksWithoutDisplayId = await query<{
    id: string;
    category: TaskCategory;
    project_id: string | null;
  }>(
    'SELECT id, category, project_id FROM tasks WHERE display_id IS NULL ORDER BY created_at ASC'
  );

  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const task of tasksWithoutDisplayId) {
    try {
      const displayId = await generateDisplayId(
        task.category || 'task',
        task.project_id || undefined
      );

      await run(
        'UPDATE tasks SET display_id = ? WHERE id = ?',
        [displayId, task.id]
      );

      updated++;
    } catch (error) {
      failed++;
      errors.push(`Failed to generate display ID for task ${task.id}: ${error}`);
    }
  }

  await saveDb();

  return { updated, failed, errors };
}

export default {
  generateDisplayId,
  parseDisplayId,
  isValidDisplayId,
  extractProjectCode,
  getCategoryCode,
  getCategoryFromCode,
  getCurrentSequence,
  backfillDisplayIds,
};
