/**
 * File Impact Analyzer
 *
 * Estimates which files a task will impact based on:
 * - AI analysis of task description
 * - Historical pattern matching
 * - User declarations
 *
 * Part of: PTE-044 to PTE-048
 */

import { v4 as uuidv4 } from "uuid";
import { query, run, getOne, saveDb } from "../../../database/db.js";
import {
  FileImpact,
  FileImpactInput,
  FileOperation,
  FileImpactSource,
  TaskCategory,
} from "../../../types/task-agent.js";

/**
 * Database row for file impact
 */
interface FileImpactRow {
  id: string;
  task_id: string;
  file_path: string;
  operation: string;
  confidence: number;
  source: string;
  was_accurate: number | null;
  created_at: string;
  updated_at: string;
  validated_at: string | null;
}

/**
 * Map database row to FileImpact object
 */
function mapFileImpactRow(row: FileImpactRow): FileImpact {
  return {
    id: row.id,
    taskId: row.task_id,
    filePath: row.file_path,
    operation: row.operation as FileOperation,
    confidence: row.confidence,
    source: row.source as FileImpactSource,
    wasAccurate: row.was_accurate === null ? undefined : row.was_accurate === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    validatedAt: row.validated_at || undefined,
  };
}

/**
 * Historical pattern for file impact
 */
interface FilePattern {
  filePattern: string;
  operation: FileOperation;
  accuracyRate: number;
  matchCount: number;
}

/**
 * Default patterns for common task categories
 */
const DEFAULT_CATEGORY_PATTERNS: Partial<
  Record<TaskCategory, Array<{ pattern: string; operation: FileOperation }>>
> = {
  feature: [
    { pattern: "database/migrations/*.sql", operation: "CREATE" },
    { pattern: "database/db.ts", operation: "UPDATE" },
    { pattern: "types/*.ts", operation: "CREATE" },
    { pattern: "types/*.ts", operation: "UPDATE" },
    { pattern: "server/routes/*.ts", operation: "CREATE" },
    { pattern: "server/routes/*.ts", operation: "UPDATE" },
    { pattern: "components/*.tsx", operation: "CREATE" },
    { pattern: "server/routes/*.ts", operation: "UPDATE" },
  ],
  bug: [
    { pattern: "**/*.ts", operation: "UPDATE" },
    { pattern: "**/*.tsx", operation: "UPDATE" },
  ],
  task: [],
  story: [],
  epic: [],
  spike: [{ pattern: "docs/**/*.md", operation: "CREATE" }],
  improvement: [{ pattern: "**/*.ts", operation: "UPDATE" }],
  documentation: [
    { pattern: "docs/**/*.md", operation: "CREATE" },
    { pattern: "README.md", operation: "UPDATE" },
  ],
  test: [
    { pattern: "tests/**/*.test.ts", operation: "CREATE" },
    { pattern: "tests/**/*.spec.ts", operation: "CREATE" },
  ],
  devops: [
    { pattern: ".github/**/*", operation: "UPDATE" },
    { pattern: "Dockerfile", operation: "UPDATE" },
  ],
  design: [
    { pattern: "components/**/*.tsx", operation: "UPDATE" },
    { pattern: "styles/**/*.css", operation: "UPDATE" },
  ],
  research: [{ pattern: "docs/research/**/*.md", operation: "CREATE" }],
  infrastructure: [
    { pattern: "server/**/*.ts", operation: "UPDATE" },
    { pattern: "config/**/*", operation: "UPDATE" },
  ],
  security: [{ pattern: "server/middleware/**/*.ts", operation: "UPDATE" }],
  performance: [{ pattern: "**/*.ts", operation: "UPDATE" }],
};

/**
 * Estimate file impacts for a task based on its description and category
 *
 * Uses a combination of:
 * - Category-based default patterns
 * - Historical patterns from similar tasks
 * - Keyword extraction from title/description
 *
 * @param taskId Task ID
 * @param title Task title
 * @param description Task description
 * @param category Task category
 */
export async function estimateFileImpacts(
  taskId: string,
  title: string,
  description: string | null,
  category: TaskCategory,
): Promise<FileImpact[]> {
  const impacts: FileImpact[] = [];
  const existingPaths = new Set<string>();

  // Get category-based default patterns
  const categoryPatterns = DEFAULT_CATEGORY_PATTERNS[category] || [];
  for (const pattern of categoryPatterns) {
    if (!existingPaths.has(pattern.pattern)) {
      existingPaths.add(pattern.pattern);
      impacts.push({
        id: uuidv4(),
        taskId,
        filePath: pattern.pattern,
        operation: pattern.operation,
        confidence: 0.5, // Default confidence for pattern-based
        source: "pattern_match",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Match historical patterns
  const historicalPatterns = await matchHistoricalPatterns(
    title,
    description || "",
    category,
  );
  for (const pattern of historicalPatterns) {
    if (!existingPaths.has(pattern.filePattern)) {
      existingPaths.add(pattern.filePattern);
      impacts.push({
        id: uuidv4(),
        taskId,
        filePath: pattern.filePattern,
        operation: pattern.operation,
        confidence: pattern.accuracyRate * 0.8, // Scale by historical accuracy
        source: "pattern_match",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Extract file hints from title and description
  const text = `${title} ${description || ""}`.toLowerCase();

  // Look for common file path indicators
  const fileIndicators = [
    {
      keywords: ["database", "migration", "schema", "sql"],
      pattern: "database/**/*",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["api", "route", "endpoint"],
      pattern: "server/routes/**/*.ts",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["component", "ui", "frontend", "react"],
      pattern: "components/**/*.tsx",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["test", "spec"],
      pattern: "tests/**/*",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["type", "interface", "typescript"],
      pattern: "types/**/*.ts",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["config", "configuration", "settings"],
      pattern: "config/**/*",
      operation: "UPDATE" as FileOperation,
    },
    {
      keywords: ["service", "business logic"],
      pattern: "server/services/**/*.ts",
      operation: "UPDATE" as FileOperation,
    },
  ];

  for (const indicator of fileIndicators) {
    if (indicator.keywords.some((kw) => text.includes(kw))) {
      if (!existingPaths.has(indicator.pattern)) {
        existingPaths.add(indicator.pattern);
        impacts.push({
          id: uuidv4(),
          taskId,
          filePath: indicator.pattern,
          operation: indicator.operation,
          confidence: 0.4, // Lower confidence for keyword-based
          source: "ai_estimate",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // Save impacts to database
  for (const impact of impacts) {
    await run(
      `INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        impact.id,
        impact.taskId,
        impact.filePath,
        impact.operation,
        impact.confidence,
        impact.source,
      ],
    );
  }

  await saveDb();

  return impacts;
}

/**
 * Match historical patterns for similar tasks
 */
export async function matchHistoricalPatterns(
  title: string,
  _description: string,
  category: TaskCategory,
): Promise<FilePattern[]> {
  // Get patterns that have been accurate for this category
  const patterns = await query<{
    file_pattern: string;
    operation: string;
    accuracy_rate: number;
    match_count: number;
  }>(
    `SELECT file_pattern, operation, accuracy_rate, match_count
     FROM file_impact_patterns
     WHERE task_category = ?
       AND match_count >= 3
       AND accuracy_rate >= 0.6
     ORDER BY accuracy_rate DESC, match_count DESC
     LIMIT 10`,
    [category],
  );

  // Also check keyword-based patterns
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (titleWords.length > 0) {
    const keywordPatterns = await query<{
      file_pattern: string;
      operation: string;
      accuracy_rate: number;
      match_count: number;
    }>(
      `SELECT file_pattern, operation, accuracy_rate, match_count
       FROM file_impact_patterns
       WHERE title_keywords IS NOT NULL
         AND match_count >= 2
       ORDER BY accuracy_rate DESC
       LIMIT 10`,
    );

    // Check if any keyword patterns match
    for (const pattern of keywordPatterns) {
      if (
        !patterns.some(
          (p) =>
            p.file_pattern === pattern.file_pattern &&
            p.operation === pattern.operation,
        )
      ) {
        patterns.push(pattern);
      }
    }
  }

  return patterns.map((p) => ({
    filePattern: p.file_pattern,
    operation: p.operation as FileOperation,
    accuracyRate: p.accuracy_rate,
    matchCount: p.match_count,
  }));
}

/**
 * Merge estimates from multiple sources with confidence weighting
 */
export async function mergeEstimates(
  taskId: string,
  estimates: Array<{
    filePath: string;
    operation: FileOperation;
    confidence: number;
    source: FileImpactSource;
  }>,
): Promise<FileImpact[]> {
  // Group by file path and operation
  const grouped: Map<string, typeof estimates> = new Map();

  for (const estimate of estimates) {
    const key = `${estimate.filePath}:${estimate.operation}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(estimate);
  }

  const merged: FileImpact[] = [];

  for (const [, group] of grouped) {
    // Use highest confidence estimate, but boost if multiple sources agree
    const maxConfidence = Math.max(...group.map((e) => e.confidence));
    const sourceBoost = group.length > 1 ? 0.1 : 0;
    const finalConfidence = Math.min(1.0, maxConfidence + sourceBoost);

    // Prefer user_declared > validated > ai_estimate > pattern_match
    const sourcePriority: FileImpactSource[] = [
      "user_declared",
      "validated",
      "ai_estimate",
      "pattern_match",
    ];
    const bestSource = group.reduce((best, curr) =>
      sourcePriority.indexOf(curr.source) < sourcePriority.indexOf(best.source)
        ? curr
        : best,
    );

    merged.push({
      id: uuidv4(),
      taskId,
      filePath: bestSource.filePath,
      operation: bestSource.operation,
      confidence: finalConfidence,
      source: bestSource.source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  return merged;
}

/**
 * Validate file impacts after task execution
 *
 * Compares predicted impacts with actual file changes
 */
export async function validateFileImpacts(
  taskId: string,
  actualChanges: Array<{ filePath: string; operation: FileOperation }>,
): Promise<{
  predicted: number;
  correct: number;
  missed: number;
  falsePositives: number;
}> {
  // Get predicted impacts
  const predicted = await query<FileImpactRow>(
    "SELECT * FROM task_file_impacts WHERE task_id = ?",
    [taskId],
  );

  const actualSet = new Set(
    actualChanges.map((c) => `${c.filePath}:${c.operation}`),
  );
  const predictedSet = new Set(
    predicted.map((p) => `${p.file_path}:${p.operation}`),
  );

  let correct = 0;
  let falsePositives = 0;

  for (const prediction of predicted) {
    const key = `${prediction.file_path}:${prediction.operation}`;
    const isCorrect = actualSet.has(key);

    // Update accuracy
    await run(
      `UPDATE task_file_impacts
       SET was_accurate = ?,
           validated_at = datetime('now'),
           updated_at = datetime('now')
       WHERE id = ?`,
      [isCorrect ? 1 : 0, prediction.id],
    );

    if (isCorrect) {
      correct++;
    } else {
      falsePositives++;
    }
  }

  // Count missed predictions
  const missed = actualChanges.filter(
    (a) => !predictedSet.has(`${a.filePath}:${a.operation}`),
  ).length;

  await saveDb();

  return {
    predicted: predicted.length,
    correct,
    missed,
    falsePositives,
  };
}

/**
 * Record actual file impact after task execution
 */
export async function recordActualImpact(
  taskId: string,
  filePath: string,
  operation: FileOperation,
  linesAdded?: number,
  linesRemoved?: number,
): Promise<void> {
  await run(
    `INSERT INTO task_file_changes (id, task_id, file_path, operation, lines_added, lines_removed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      taskId,
      filePath,
      operation,
      linesAdded || null,
      linesRemoved || null,
    ],
  );
  await saveDb();
}

/**
 * Get file impacts for a task
 */
export async function getFileImpacts(taskId: string): Promise<FileImpact[]> {
  const rows = await query<FileImpactRow>(
    "SELECT * FROM task_file_impacts WHERE task_id = ? ORDER BY confidence DESC",
    [taskId],
  );
  return rows.map(mapFileImpactRow);
}

/**
 * Add or update a file impact (user-declared)
 */
export async function setFileImpact(
  taskId: string,
  input: FileImpactInput,
): Promise<FileImpact> {
  // Check if exists
  const existing = await getOne<FileImpactRow>(
    "SELECT * FROM task_file_impacts WHERE task_id = ? AND file_path = ? AND operation = ?",
    [taskId, input.filePath, input.operation],
  );

  if (existing) {
    // Update existing
    await run(
      `UPDATE task_file_impacts
       SET confidence = ?,
           source = ?,
           updated_at = datetime('now')
       WHERE id = ?`,
      [
        input.confidence ?? existing.confidence,
        input.source ?? "user_declared",
        existing.id,
      ],
    );
    await saveDb();

    const updated = await getOne<FileImpactRow>(
      "SELECT * FROM task_file_impacts WHERE id = ?",
      [existing.id],
    );
    return mapFileImpactRow(updated!);
  }

  // Create new
  const id = uuidv4();
  await run(
    `INSERT INTO task_file_impacts (id, task_id, file_path, operation, confidence, source)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      taskId,
      input.filePath,
      input.operation,
      input.confidence ?? 1.0, // User declared = high confidence
      input.source ?? "user_declared",
    ],
  );
  await saveDb();

  const created = await getOne<FileImpactRow>(
    "SELECT * FROM task_file_impacts WHERE id = ?",
    [id],
  );
  return mapFileImpactRow(created!);
}

/**
 * Remove a file impact
 */
export async function removeFileImpact(
  taskId: string,
  filePath: string,
  operation: FileOperation,
): Promise<boolean> {
  await run(
    "DELETE FROM task_file_impacts WHERE task_id = ? AND file_path = ? AND operation = ?",
    [taskId, filePath, operation],
  );
  await saveDb();
  return true; // Successful even if nothing deleted
}

/**
 * Update historical patterns based on validation results
 */
export async function updatePatternAccuracy(taskId: string): Promise<void> {
  // Get task details
  const task = await getOne<{ category: string; title: string }>(
    "SELECT category, title FROM tasks WHERE id = ?",
    [taskId],
  );
  if (!task) return;

  // Get validated impacts
  const validatedImpacts = await query<FileImpactRow>(
    "SELECT * FROM task_file_impacts WHERE task_id = ? AND was_accurate IS NOT NULL",
    [taskId],
  );

  for (const impact of validatedImpacts) {
    // Update or create pattern
    const existing = await getOne<{
      id: string;
      match_count: number;
      accuracy_rate: number;
    }>(
      `SELECT id, match_count, accuracy_rate FROM file_impact_patterns
       WHERE task_category = ? AND file_pattern = ? AND operation = ?`,
      [task.category, impact.file_path, impact.operation],
    );

    if (existing) {
      // Update running average
      const newCount = existing.match_count + 1;
      const newAccuracy =
        (existing.accuracy_rate * existing.match_count +
          (impact.was_accurate === 1 ? 1 : 0)) /
        newCount;

      await run(
        `UPDATE file_impact_patterns
         SET match_count = ?, accuracy_rate = ?, last_matched_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
        [newCount, newAccuracy, existing.id],
      );
    } else {
      // Create new pattern
      await run(
        `INSERT INTO file_impact_patterns (id, task_category, file_pattern, operation, match_count, accuracy_rate, last_matched_at)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
        [
          uuidv4(),
          task.category,
          impact.file_path,
          impact.operation,
          impact.was_accurate === 1 ? 1.0 : 0.0,
        ],
      );
    }
  }

  await saveDb();
}

export default {
  estimateFileImpacts,
  matchHistoricalPatterns,
  mergeEstimates,
  validateFileImpacts,
  recordActualImpact,
  getFileImpacts,
  setFileImpact,
  removeFileImpact,
  updatePatternAccuracy,
};
