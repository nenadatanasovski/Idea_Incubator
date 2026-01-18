/**
 * Task Auto-Initialization Service
 *
 * Provides synchronous auto-population of task fields during creation:
 * - Effort estimation based on complexity signals
 * - Priority calculation based on category and context
 * - Initial acceptance criteria generation
 * - File impact estimation
 *
 * This service runs BEFORE the task is returned to the client,
 * ensuring all fields are populated for immediate display.
 */

import { v4 as uuidv4 } from "uuid";
import { run, getOne, saveDb } from "../../../database/db.js";
import type { TaskCategory } from "../../../types/task-agent.js";
import * as fileImpactAnalyzer from "./file-impact-analyzer.js";

/**
 * Effort level type
 */
export type EffortLevel = "trivial" | "small" | "medium" | "large" | "epic";

/**
 * Priority type
 */
export type PriorityLevel = "P0" | "P1" | "P2" | "P3" | "P4";

/**
 * Input for auto-initialization
 */
export interface AutoInitInput {
  taskId: string;
  title: string;
  description?: string | null;
  category: string;
  projectId?: string | null;
  prdId?: string | null;
  requirementRef?: string | null;
}

/**
 * Result of auto-initialization
 */
export interface AutoInitResult {
  effort: EffortLevel;
  priority: PriorityLevel;
  fileImpacts: Array<{
    filePath: string;
    operation: string;
    confidence: number;
  }>;
  acceptanceCriteria: string[];
  phase: number;
}

/**
 * Complexity signals extracted from task
 */
interface ComplexitySignals {
  wordCount: number;
  hasMultipleParts: boolean;
  mentionsDatabase: boolean;
  mentionsApi: boolean;
  mentionsUi: boolean;
  mentionsTest: boolean;
  mentionsIntegration: boolean;
  mentionsSecurity: boolean;
  mentionsPerformance: boolean;
  actionVerbs: string[];
  fileCount: number;
}

/**
 * Keywords that indicate complexity in different dimensions
 */
const COMPLEXITY_KEYWORDS = {
  database: [
    "database",
    "db",
    "table",
    "schema",
    "migration",
    "query",
    "sql",
    "index",
  ],
  api: [
    "api",
    "endpoint",
    "route",
    "rest",
    "request",
    "response",
    "http",
    "server",
  ],
  ui: [
    "component",
    "ui",
    "frontend",
    "button",
    "form",
    "modal",
    "page",
    "view",
    "display",
    "render",
  ],
  test: ["test", "spec", "coverage", "unit", "e2e", "integration", "verify"],
  integration: [
    "integrate",
    "connect",
    "sync",
    "webhook",
    "external",
    "third-party",
  ],
  security: [
    "auth",
    "security",
    "permission",
    "encrypt",
    "token",
    "credential",
  ],
  performance: ["performance", "optimize", "cache", "speed", "latency", "load"],
};

/**
 * Action verbs that indicate scope
 */
const ACTION_VERBS = {
  simple: ["fix", "update", "rename", "move", "adjust", "tweak"],
  moderate: ["add", "create", "implement", "modify", "refactor", "extend"],
  complex: [
    "design",
    "architect",
    "integrate",
    "migrate",
    "overhaul",
    "rewrite",
  ],
};

/**
 * Category to phase mapping
 */
const CATEGORY_PHASE_MAP: Record<string, number> = {
  infrastructure: 1,
  database: 1,
  types: 2,
  api: 3,
  feature: 4,
  ui: 5,
  test: 6,
  documentation: 7,
  bug: 3,
  security: 2,
  performance: 5,
};

/**
 * Category to base priority mapping
 */
const CATEGORY_PRIORITY_MAP: Record<string, PriorityLevel> = {
  bug: "P1",
  security: "P0",
  infrastructure: "P1",
  database: "P1",
  feature: "P2",
  api: "P2",
  ui: "P2",
  test: "P3",
  documentation: "P4",
  performance: "P2",
};

/**
 * Extract complexity signals from task title and description
 */
function extractComplexitySignals(
  title: string,
  description?: string | null,
): ComplexitySignals {
  const text = `${title} ${description || ""}`.toLowerCase();
  const words = text.split(/\s+/).filter((w) => w.length > 2);

  const checkKeywords = (keywords: string[]) =>
    keywords.some((kw) => text.includes(kw));

  // Find action verbs in title
  const titleLower = title.toLowerCase();
  const actionVerbs: string[] = [];
  for (const [, verbs] of Object.entries(ACTION_VERBS)) {
    for (const verb of verbs) {
      if (titleLower.includes(verb)) {
        actionVerbs.push(verb);
      }
    }
  }

  // Check for multiple parts (and, plus, also, etc.)
  const hasMultipleParts =
    /\band\b|\bplus\b|\balso\b|\bwith\b|,/.test(text) ||
    (description?.split(/\n/).filter((l) => l.trim()).length || 0) > 3;

  return {
    wordCount: words.length,
    hasMultipleParts,
    mentionsDatabase: checkKeywords(COMPLEXITY_KEYWORDS.database),
    mentionsApi: checkKeywords(COMPLEXITY_KEYWORDS.api),
    mentionsUi: checkKeywords(COMPLEXITY_KEYWORDS.ui),
    mentionsTest: checkKeywords(COMPLEXITY_KEYWORDS.test),
    mentionsIntegration: checkKeywords(COMPLEXITY_KEYWORDS.integration),
    mentionsSecurity: checkKeywords(COMPLEXITY_KEYWORDS.security),
    mentionsPerformance: checkKeywords(COMPLEXITY_KEYWORDS.performance),
    actionVerbs,
    fileCount: 0, // Will be set after file impact estimation
  };
}

/**
 * Estimate effort level based on complexity signals
 */
function estimateEffort(
  signals: ComplexitySignals,
  fileCount: number,
): EffortLevel {
  let complexityScore = 0;

  // File count is a strong indicator
  if (fileCount <= 1) complexityScore += 1;
  else if (fileCount <= 3) complexityScore += 2;
  else if (fileCount <= 5) complexityScore += 3;
  else if (fileCount <= 8) complexityScore += 4;
  else complexityScore += 5;

  // Multiple parts indicates more work
  if (signals.hasMultipleParts) complexityScore += 1;

  // Multiple domains (db + api + ui) is complex
  const domainCount = [
    signals.mentionsDatabase,
    signals.mentionsApi,
    signals.mentionsUi,
    signals.mentionsTest,
  ].filter(Boolean).length;

  complexityScore += domainCount;

  // Security and integration add complexity
  if (signals.mentionsSecurity) complexityScore += 1;
  if (signals.mentionsIntegration) complexityScore += 2;

  // Action verbs
  const hasComplexVerb = signals.actionVerbs.some((v) =>
    ACTION_VERBS.complex.includes(v),
  );
  const hasSimpleVerb = signals.actionVerbs.some((v) =>
    ACTION_VERBS.simple.includes(v),
  );

  if (hasComplexVerb) complexityScore += 2;
  if (hasSimpleVerb && !hasComplexVerb) complexityScore -= 1;

  // Word count (longer descriptions usually mean more complexity)
  if (signals.wordCount > 50) complexityScore += 1;
  if (signals.wordCount > 100) complexityScore += 1;

  // Map score to effort level
  if (complexityScore <= 2) return "trivial";
  if (complexityScore <= 4) return "small";
  if (complexityScore <= 6) return "medium";
  if (complexityScore <= 9) return "large";
  return "epic";
}

/**
 * Calculate priority based on category and context
 */
function calculatePriority(
  category: string,
  signals: ComplexitySignals,
): PriorityLevel {
  // Start with category-based priority
  let priority: PriorityLevel =
    CATEGORY_PRIORITY_MAP[category.toLowerCase()] || "P2";

  // Security always bumps priority
  if (signals.mentionsSecurity) {
    priority = "P0";
  }

  // Bugs are typically higher priority
  if (category.toLowerCase() === "bug") {
    priority = "P1";
  }

  // Infrastructure that blocks others is high priority
  if (category.toLowerCase() === "infrastructure" && signals.mentionsDatabase) {
    priority = "P1";
  }

  return priority;
}

/**
 * Determine phase based on category
 */
function determinePhase(category: string): number {
  return CATEGORY_PHASE_MAP[category.toLowerCase()] || 4;
}

/**
 * Generate initial acceptance criteria based on task context
 */
function generateAcceptanceCriteria(
  title: string,
  _description: string | null,
  category: string,
  signals: ComplexitySignals,
): string[] {
  const criteria: string[] = [];

  // Always include a basic completion criterion
  criteria.push(`${title} is implemented as specified`);

  // Add domain-specific criteria
  if (signals.mentionsDatabase) {
    criteria.push("Database migration runs without errors");
    criteria.push("Schema changes are properly applied");
  }

  if (signals.mentionsApi) {
    criteria.push("API endpoint returns correct status codes");
    criteria.push("Request validation handles edge cases");
  }

  if (signals.mentionsUi) {
    criteria.push("Component renders without errors");
    criteria.push("UI is responsive and accessible");
  }

  if (signals.mentionsTest) {
    criteria.push("All tests pass");
    criteria.push("Test coverage is maintained or improved");
  }

  if (signals.mentionsSecurity) {
    criteria.push("No security vulnerabilities introduced");
    criteria.push("Authentication/authorization is properly enforced");
  }

  if (signals.mentionsPerformance) {
    criteria.push("Performance benchmarks are met");
    criteria.push("No performance regressions");
  }

  // Generic criteria based on category
  const categoryLower = category.toLowerCase();
  if (categoryLower === "bug") {
    criteria.push("Bug is verified fixed in reproduction scenario");
    criteria.push("Regression test added");
  } else if (categoryLower === "feature") {
    criteria.push("Feature works as documented");
    criteria.push("Error handling is comprehensive");
  }

  // Always include these baseline criteria
  criteria.push("TypeScript compiles without errors");
  criteria.push("No console errors or warnings");

  // Remove duplicates and limit to 10
  return [...new Set(criteria)].slice(0, 10);
}

/**
 * Initialize a task with auto-populated fields
 *
 * @param input Task creation input
 * @returns Auto-populated field values
 */
export async function initializeTask(
  input: AutoInitInput,
): Promise<AutoInitResult> {
  const { taskId, title, description, category } = input;

  // Extract complexity signals
  const signals = extractComplexitySignals(title, description);

  // Estimate file impacts synchronously
  // Cast category to TaskCategory (defaults to "task" if not a known category)
  const taskCategory = (
    [
      "feature",
      "bug",
      "task",
      "enhancement",
      "research",
      "infrastructure",
      "ui",
      "api",
      "database",
      "test",
      "documentation",
      "security",
      "performance",
    ].includes(category.toLowerCase())
      ? category.toLowerCase()
      : "task"
  ) as TaskCategory;

  const fileImpacts = await fileImpactAnalyzer.estimateFileImpacts(
    taskId,
    title,
    description || null,
    taskCategory,
  );

  // Update signals with file count
  signals.fileCount = fileImpacts.length;

  // Calculate effort
  const effort = estimateEffort(signals, fileImpacts.length);

  // Calculate priority
  const priority = calculatePriority(category, signals);

  // Determine phase
  const phase = determinePhase(category);

  // Generate acceptance criteria
  const acceptanceCriteria = generateAcceptanceCriteria(
    title,
    description || null,
    category,
    signals,
  );

  return {
    effort,
    priority,
    fileImpacts: fileImpacts.map((fi) => ({
      filePath: fi.filePath,
      operation: fi.operation,
      confidence: fi.confidence,
    })),
    acceptanceCriteria,
    phase,
  };
}

/**
 * Apply auto-initialization results to a task
 *
 * @param taskId Task ID
 * @param result Auto-initialization result
 */
export async function applyInitialization(
  taskId: string,
  result: AutoInitResult,
): Promise<void> {
  const now = new Date().toISOString();

  // Update task with effort, priority, and phase
  await run(
    `UPDATE tasks
     SET effort = ?, priority = ?, phase = ?, updated_at = ?
     WHERE id = ?`,
    [result.effort, result.priority, result.phase, now, taskId],
  );

  // Save file impacts
  for (const impact of result.fileImpacts) {
    await run(
      `INSERT OR REPLACE INTO task_file_impacts (id, task_id, file_path, operation, confidence, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'auto_init', ?, ?)`,
      [
        uuidv4(),
        taskId,
        impact.filePath,
        impact.operation,
        impact.confidence,
        now,
        now,
      ],
    );
  }

  // Create acceptance criteria appendix if criteria were generated
  if (result.acceptanceCriteria.length > 0) {
    // Check if appendix already exists
    const existing = await getOne<{ id: string }>(
      `SELECT id FROM task_appendices WHERE task_id = ? AND appendix_type = 'acceptance_criteria'`,
      [taskId],
    );

    if (!existing) {
      await run(
        `INSERT INTO task_appendices (id, task_id, appendix_type, content_type, content, position, created_at)
         VALUES (?, ?, 'acceptance_criteria', 'inline', ?, 0, ?)`,
        [uuidv4(), taskId, JSON.stringify(result.acceptanceCriteria), now],
      );
    }
  }

  await saveDb();
}

/**
 * Full auto-initialization: initialize and apply in one call
 *
 * @param input Task creation input
 * @returns Auto-initialization result (for response)
 */
export async function initializeAndApply(
  input: AutoInitInput,
): Promise<AutoInitResult> {
  const result = await initializeTask(input);
  await applyInitialization(input.taskId, result);
  return result;
}

export default {
  initializeTask,
  applyInitialization,
  initializeAndApply,
  estimateEffort,
  calculatePriority,
  determinePhase,
  generateAcceptanceCriteria,
};
