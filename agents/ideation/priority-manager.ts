/**
 * Priority Manager
 *
 * Manages document priority rankings for ideation context loading.
 * Determines which documents should be loaded first based on priority rules.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getIdeaFolderPath } from '../../utils/folder-structure.js';
import type { LifecycleStage } from '../../utils/schemas.js';

// ============================================================================
// PRIORITY RULES TYPES
// ============================================================================

/**
 * Structure of priority rules stored in priority.json.
 */
export interface PriorityRules {
  /** Documents that should always be shown regardless of phase */
  always_show: string[];
  /** Phase-specific document mappings */
  by_phase: Record<string, string[]>;
  /** Recently updated documents (max 10) */
  recently_updated: string[];
  /** AI-recommended documents */
  ai_recommended: string[];
}

// ============================================================================
// DEFAULT PRIORITY RULES
// ============================================================================

/**
 * Default priority rules used when priority.json is missing.
 * Provides sensible defaults for each lifecycle phase.
 */
export const DEFAULT_PRIORITY_RULES: PriorityRules = {
  always_show: ['README.md', 'development.md'],
  by_phase: {
    SPARK: ['README.md', 'development.md'],
    CLARIFY: ['README.md', 'development.md', 'target-users.md', 'problem-solution.md'],
    RESEARCH: ['research/market.md', 'research/competitive.md', 'research/user-personas.md'],
    IDEATE: ['development.md', 'problem-solution.md'],
    EVALUATE: ['analysis/redteam.md', 'analysis/risk-mitigation.md'],
    VALIDATE: ['validation/assumptions.md', 'validation/results.md'],
    DESIGN: ['planning/brief.md', 'planning/architecture.md'],
    PROTOTYPE: ['planning/mvp-scope.md', 'build/spec.md'],
    TEST: ['validation/results.md', 'build/tasks.md'],
    REFINE: ['development.md', 'build/decisions.md'],
    BUILD: ['build/spec.md', 'build/tasks.md', 'build/decisions.md'],
    LAUNCH: ['marketing/launch-plan.md', 'marketing/gtm.md'],
    GROW: ['marketing/channels.md', 'networking/opportunities.md'],
    MAINTAIN: ['build/tasks.md', 'team.md'],
    PIVOT: ['analysis/redteam.md', 'development.md'],
    PAUSE: ['README.md'],
    SUNSET: ['README.md'],
    ARCHIVE: ['README.md'],
    ABANDONED: ['README.md']
  },
  recently_updated: [],
  ai_recommended: []
};

// ============================================================================
// PRIORITY FILE OPERATIONS
// ============================================================================

/**
 * Get the path to the priority.json file for an idea.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns Absolute path to the priority.json file
 */
function getPriorityFilePath(userSlug: string, ideaSlug: string): string {
  const ideaPath = getIdeaFolderPath(userSlug, ideaSlug);
  return path.join(ideaPath, '.metadata', 'priority.json');
}

/**
 * Load priority rules from an idea's priority.json file.
 * Falls back to default rules if file is missing or invalid.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns Priority rules object
 */
export function loadPriorityRules(userSlug: string, ideaSlug: string): PriorityRules {
  const priorityPath = getPriorityFilePath(userSlug, ideaSlug);

  if (fs.existsSync(priorityPath)) {
    try {
      const content = fs.readFileSync(priorityPath, 'utf-8');
      const parsed = JSON.parse(content);

      // Merge with defaults to ensure all fields exist
      return {
        always_show: Array.isArray(parsed.always_show)
          ? parsed.always_show
          : DEFAULT_PRIORITY_RULES.always_show,
        by_phase: parsed.by_phase && typeof parsed.by_phase === 'object'
          ? { ...DEFAULT_PRIORITY_RULES.by_phase, ...parsed.by_phase }
          : DEFAULT_PRIORITY_RULES.by_phase,
        recently_updated: Array.isArray(parsed.recently_updated)
          ? parsed.recently_updated
          : [],
        ai_recommended: Array.isArray(parsed.ai_recommended)
          ? parsed.ai_recommended
          : []
      };
    } catch {
      // Return defaults if file cannot be read or parsed
      return { ...DEFAULT_PRIORITY_RULES };
    }
  }

  // Return defaults if file doesn't exist
  return { ...DEFAULT_PRIORITY_RULES };
}

/**
 * Save priority rules to an idea's priority.json file.
 * Creates the .metadata directory if it doesn't exist.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param rules - Priority rules to save
 */
function savePriorityRules(userSlug: string, ideaSlug: string, rules: PriorityRules): void {
  const priorityPath = getPriorityFilePath(userSlug, ideaSlug);
  const metadataDir = path.dirname(priorityPath);

  // Create .metadata directory if it doesn't exist
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }

  // Write the priority rules
  fs.writeFileSync(priorityPath, JSON.stringify(rules, null, 2), 'utf-8');
}

// ============================================================================
// PRIORITY DOCUMENT FUNCTIONS
// ============================================================================

/**
 * Get prioritized list of document paths for a given phase.
 *
 * Documents are returned in priority order:
 * 1. always_show - Documents that should always be loaded (highest priority)
 * 2. by_phase - Phase-specific documents for the current phase
 * 3. recently_updated - Recently modified documents
 * 4. ai_recommended - AI-suggested documents (lowest priority)
 *
 * Duplicate paths are removed while maintaining priority order.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param phase - Current lifecycle phase
 * @returns Ordered array of document paths by priority
 */
export async function getPriorityDocs(
  userSlug: string,
  ideaSlug: string,
  phase: LifecycleStage
): Promise<string[]> {
  // Load priority rules (falls back to defaults if file missing)
  const rules = loadPriorityRules(userSlug, ideaSlug);

  const docs: string[] = [];
  const seen = new Set<string>();

  // 1. Always show docs (highest priority)
  for (const doc of rules.always_show) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 2. Phase-specific docs
  const phaseDocs = rules.by_phase[phase] || [];
  for (const doc of phaseDocs) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 3. Recently updated docs
  for (const doc of rules.recently_updated) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  // 4. AI recommended docs (lowest priority)
  for (const doc of rules.ai_recommended) {
    if (!seen.has(doc)) {
      docs.push(doc);
      seen.add(doc);
    }
  }

  return docs;
}

// ============================================================================
// RECENTLY UPDATED MANAGEMENT
// ============================================================================

/**
 * Maximum number of items to keep in the recently_updated list.
 */
const MAX_RECENTLY_UPDATED = 10;

/**
 * Update the recently_updated list with a new file path.
 *
 * - Adds the file to the front of the list
 * - If the file is already in the list, moves it to the front
 * - Limits the list to MAX_RECENTLY_UPDATED items
 * - Saves changes to priority.json
 * - Creates priority.json if it doesn't exist
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param filePath - The file path to add (relative to idea folder)
 */
export async function updateRecentlyUpdated(
  userSlug: string,
  ideaSlug: string,
  filePath: string
): Promise<void> {
  // Load current rules
  const rules = loadPriorityRules(userSlug, ideaSlug);

  // Remove file from current position if it exists
  const index = rules.recently_updated.indexOf(filePath);
  if (index !== -1) {
    rules.recently_updated.splice(index, 1);
  }

  // Add to front of list
  rules.recently_updated.unshift(filePath);

  // Limit to max items
  if (rules.recently_updated.length > MAX_RECENTLY_UPDATED) {
    rules.recently_updated = rules.recently_updated.slice(0, MAX_RECENTLY_UPDATED);
  }

  // Save changes
  savePriorityRules(userSlug, ideaSlug, rules);
}

// ============================================================================
// AI RECOMMENDED MANAGEMENT
// ============================================================================

/**
 * Set the AI-recommended documents list.
 *
 * Replaces the entire ai_recommended list with the provided documents.
 * Pass an empty array to clear the recommendations.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @param docs - Array of document paths to set as AI-recommended
 */
export async function setAiRecommended(
  userSlug: string,
  ideaSlug: string,
  docs: string[]
): Promise<void> {
  // Load current rules
  const rules = loadPriorityRules(userSlug, ideaSlug);

  // Replace the ai_recommended list
  rules.ai_recommended = [...docs];

  // Save changes
  savePriorityRules(userSlug, ideaSlug, rules);
}

/**
 * Get the current AI-recommended documents list.
 *
 * @param userSlug - The user slug
 * @param ideaSlug - The idea slug
 * @returns Array of AI-recommended document paths
 */
export async function getAiRecommended(
  userSlug: string,
  ideaSlug: string
): Promise<string[]> {
  const rules = loadPriorityRules(userSlug, ideaSlug);
  return rules.ai_recommended;
}
