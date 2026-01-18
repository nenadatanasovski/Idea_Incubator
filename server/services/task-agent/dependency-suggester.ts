/**
 * DependencySuggester - AI-powered dependency suggestion service
 *
 * Suggests task dependencies based on:
 * 1. PRD-Derived: Parse PRD structure for implicit ordering
 * 2. AI-Analyzed: Semantic similarity, file impact overlap
 * 3. Pattern-Based: Category heuristics (infrastructure before features)
 *
 * Part of: Task Agent Workflow Enhancement
 */

import { v4 as uuidv4 } from "uuid";
import { query, getOne, run } from "../../../database/db.js";
import { createAnthropicClient } from "../../../utils/anthropic-client.js";

// Types
export type SuggestionSource = "prd_derived" | "ai_analyzed" | "pattern_based";
export type RelationshipType = "depends_on" | "blocks";

export interface DependencySuggestion {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  targetDisplayId: string;
  targetTitle: string;
  relationshipType: RelationshipType;
  confidence: number; // 0-1
  reason: string;
  source: SuggestionSource;
}

interface TaskRow {
  id: string;
  display_id: string;
  title: string;
  description: string | null;
  category: string;
  project_id: string | null;
  task_list_id: string | null;
}

interface FileImpactRow {
  id: string;
  task_id: string;
  target_path: string;
  operation: string;
}

interface PrdTaskRow {
  task_id: string;
  prd_id: string;
  requirement_ref: string;
}

// Rate limiting
const rateLimits: Record<string, number> = {};
const RATE_LIMIT_MS = 5000;

function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const lastCall = rateLimits[operation] || 0;
  if (now - lastCall < RATE_LIMIT_MS) return false;
  rateLimits[operation] = now;
  return true;
}

// Category priority for pattern-based suggestions
const CATEGORY_PRIORITY: Record<string, number> = {
  infrastructure: 1,
  database: 2,
  security: 3,
  api: 4,
  feature: 5,
  ui: 6,
  test: 7,
  documentation: 8,
};

/**
 * DependencySuggester class
 */
export class DependencySuggester {
  private client = createAnthropicClient();

  /**
   * Generate dependency suggestions for a task
   */
  async suggestDependencies(taskId: string): Promise<DependencySuggestion[]> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("Task not found");
    }

    const suggestions: DependencySuggestion[] = [];

    // 1. PRD-Derived suggestions (high confidence)
    const prdSuggestions = await this.getPrdDerivedSuggestions(task);
    suggestions.push(...prdSuggestions);

    // 2. File Impact overlap suggestions (medium-high confidence)
    const fileOverlapSuggestions = await this.getFileOverlapSuggestions(task);
    suggestions.push(...fileOverlapSuggestions);

    // 3. Pattern-based suggestions (medium confidence)
    const patternSuggestions = await this.getPatternBasedSuggestions(task);
    suggestions.push(...patternSuggestions);

    // 4. AI-analyzed suggestions (if enabled and not rate limited)
    if (checkRateLimit(`ai-suggest-${taskId}`)) {
      try {
        const aiSuggestions = await this.getAiAnalyzedSuggestions(task);
        suggestions.push(...aiSuggestions);
      } catch (err) {
        console.warn("[DependencySuggester] AI analysis failed:", err);
      }
    }

    // Deduplicate and sort by confidence
    const uniqueSuggestions = this.deduplicateSuggestions(suggestions);
    return uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Dismiss a suggestion (store in dismissed_suggestions table)
   */
  async dismissSuggestion(
    sourceTaskId: string,
    targetTaskId: string,
  ): Promise<void> {
    try {
      await run(
        `INSERT OR REPLACE INTO dismissed_suggestions (id, source_task_id, target_task_id, dismissed_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [uuidv4(), sourceTaskId, targetTaskId],
      );
    } catch {
      // Table might not exist, create it
      await run(`
        CREATE TABLE IF NOT EXISTS dismissed_suggestions (
          id TEXT PRIMARY KEY,
          source_task_id TEXT NOT NULL,
          target_task_id TEXT NOT NULL,
          dismissed_at TEXT NOT NULL,
          UNIQUE(source_task_id, target_task_id)
        )
      `);
      await run(
        `INSERT OR REPLACE INTO dismissed_suggestions (id, source_task_id, target_task_id, dismissed_at)
         VALUES (?, ?, ?, datetime('now'))`,
        [uuidv4(), sourceTaskId, targetTaskId],
      );
    }
  }

  /**
   * Get task by ID
   */
  private async getTask(taskId: string): Promise<TaskRow | null> {
    // Try UUID first, then display_id
    const task = await getOne<TaskRow>(
      "SELECT id, display_id, title, description, category, project_id, task_list_id FROM tasks WHERE id = ?",
      [taskId],
    );
    if (task) return task;

    // Try display_id if UUID lookup failed
    return getOne<TaskRow>(
      "SELECT id, display_id, title, description, category, project_id, task_list_id FROM tasks WHERE display_id = ?",
      [taskId],
    );
  }

  /**
   * Get dismissed suggestions for a task
   */
  private async getDismissedPairs(taskId: string): Promise<Set<string>> {
    try {
      const rows = await query<{ target_task_id: string }>(
        "SELECT target_task_id FROM dismissed_suggestions WHERE source_task_id = ?",
        [taskId],
      );
      return new Set(rows.map((r) => r.target_task_id));
    } catch {
      return new Set();
    }
  }

  /**
   * PRD-Derived suggestions
   * Parse PRD structure for implicit ordering relationships
   */
  private async getPrdDerivedSuggestions(
    task: TaskRow,
  ): Promise<DependencySuggestion[]> {
    const suggestions: DependencySuggestion[] = [];
    const dismissed = await this.getDismissedPairs(task.id);

    if (!task.project_id) return suggestions;

    // Get the PRD link for this task
    const taskPrdLink = await getOne<PrdTaskRow>(
      "SELECT task_id, prd_id, requirement_ref FROM prd_tasks WHERE task_id = ?",
      [task.id],
    );

    if (!taskPrdLink) return suggestions;

    // Get other tasks linked to the same PRD
    const relatedTasks = await query<{
      task_id: string;
      requirement_ref: string;
      display_id: string;
      title: string;
      category: string;
    }>(
      `SELECT pt.task_id, pt.requirement_ref, t.display_id, t.title, t.category
       FROM prd_tasks pt
       JOIN tasks t ON pt.task_id = t.id
       WHERE pt.prd_id = ? AND pt.task_id != ?`,
      [taskPrdLink.prd_id, task.id],
    );

    for (const related of relatedTasks) {
      if (dismissed.has(related.task_id)) continue;

      // Check if this task's requirement appears before/after ours
      const thisIndex = this.extractRequirementIndex(
        taskPrdLink.requirement_ref,
      );
      const relatedIndex = this.extractRequirementIndex(
        related.requirement_ref,
      );

      if (thisIndex !== null && relatedIndex !== null) {
        if (relatedIndex < thisIndex) {
          // Related task's requirement comes before ours
          suggestions.push({
            id: uuidv4(),
            sourceTaskId: task.id,
            targetTaskId: related.task_id,
            targetDisplayId: related.display_id,
            targetTitle: related.title,
            relationshipType: "depends_on",
            confidence: 0.8,
            reason: `PRD requirement ${related.requirement_ref} is defined before ${taskPrdLink.requirement_ref}`,
            source: "prd_derived",
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * File Impact overlap suggestions
   * Tasks touching same files should have dependencies
   */
  private async getFileOverlapSuggestions(
    task: TaskRow,
  ): Promise<DependencySuggestion[]> {
    const suggestions: DependencySuggestion[] = [];
    const dismissed = await this.getDismissedPairs(task.id);

    // Get file impacts for this task
    const thisImpacts = await query<FileImpactRow>(
      "SELECT id, task_id, target_path, operation FROM task_file_impacts WHERE task_id = ?",
      [task.id],
    );

    if (thisImpacts.length === 0) return suggestions;

    const thisPaths = new Set(thisImpacts.map((i) => i.target_path));

    // Get other tasks with overlapping file impacts in the same project/list
    let otherTasksQuery = `
      SELECT DISTINCT t.id, t.display_id, t.title, t.category, tfi.target_path, tfi.operation
      FROM tasks t
      JOIN task_file_impacts tfi ON t.id = tfi.task_id
      WHERE t.id != ?
    `;
    const params: (string | null)[] = [task.id];

    if (task.task_list_id) {
      otherTasksQuery += " AND t.task_list_id = ?";
      params.push(task.task_list_id);
    } else if (task.project_id) {
      otherTasksQuery += " AND t.project_id = ?";
      params.push(task.project_id);
    }

    const otherImpacts = await query<{
      id: string;
      display_id: string;
      title: string;
      category: string;
      target_path: string;
      operation: string;
    }>(otherTasksQuery, params);

    // Group by task
    const taskOverlaps = new Map<
      string,
      {
        displayId: string;
        title: string;
        category: string;
        overlaps: Array<{ path: string; operation: string }>;
      }
    >();

    for (const impact of otherImpacts) {
      if (thisPaths.has(impact.target_path)) {
        const existing = taskOverlaps.get(impact.id);
        if (existing) {
          existing.overlaps.push({
            path: impact.target_path,
            operation: impact.operation,
          });
        } else {
          taskOverlaps.set(impact.id, {
            displayId: impact.display_id,
            title: impact.title,
            category: impact.category,
            overlaps: [
              { path: impact.target_path, operation: impact.operation },
            ],
          });
        }
      }
    }

    // Create suggestions
    for (const [targetTaskId, info] of taskOverlaps) {
      if (dismissed.has(targetTaskId)) continue;

      // Determine dependency direction based on category priority
      const thisPriority = CATEGORY_PRIORITY[task.category.toLowerCase()] || 5;
      const targetPriority =
        CATEGORY_PRIORITY[info.category.toLowerCase()] || 5;

      const relationshipType: RelationshipType =
        targetPriority < thisPriority ? "depends_on" : "blocks";

      const overlappingFiles = info.overlaps.map((o) => o.path).slice(0, 3);
      const moreFiles =
        info.overlaps.length > 3 ? ` (+${info.overlaps.length - 3} more)` : "";

      suggestions.push({
        id: uuidv4(),
        sourceTaskId: task.id,
        targetTaskId,
        targetDisplayId: info.displayId,
        targetTitle: info.title,
        relationshipType,
        confidence: Math.min(0.7 + info.overlaps.length * 0.05, 0.9),
        reason: `Both tasks modify: ${overlappingFiles.join(", ")}${moreFiles}`,
        source: "ai_analyzed",
      });
    }

    return suggestions;
  }

  /**
   * Pattern-based suggestions
   * Use category heuristics (infrastructure before features)
   */
  private async getPatternBasedSuggestions(
    task: TaskRow,
  ): Promise<DependencySuggestion[]> {
    const suggestions: DependencySuggestion[] = [];
    const dismissed = await this.getDismissedPairs(task.id);

    const thisPriority = CATEGORY_PRIORITY[task.category.toLowerCase()] || 5;

    // Get tasks in same list/project with lower priority (should run first)
    let query_str = `
      SELECT id, display_id, title, category
      FROM tasks
      WHERE id != ?
    `;
    const params: (string | null)[] = [task.id];

    if (task.task_list_id) {
      query_str += " AND task_list_id = ?";
      params.push(task.task_list_id);
    } else if (task.project_id) {
      query_str += " AND project_id = ?";
      params.push(task.project_id);
    } else {
      return suggestions; // No context to compare
    }

    query_str += " AND status NOT IN ('completed', 'cancelled', 'archived')";

    const candidates = await query<{
      id: string;
      display_id: string;
      title: string;
      category: string;
    }>(query_str, params);

    for (const candidate of candidates) {
      if (dismissed.has(candidate.id)) continue;

      const candidatePriority =
        CATEGORY_PRIORITY[candidate.category.toLowerCase()] || 5;

      // Only suggest if there's a significant priority difference
      if (candidatePriority < thisPriority - 1) {
        suggestions.push({
          id: uuidv4(),
          sourceTaskId: task.id,
          targetTaskId: candidate.id,
          targetDisplayId: candidate.display_id,
          targetTitle: candidate.title,
          relationshipType: "depends_on",
          confidence: 0.5 + (thisPriority - candidatePriority) * 0.1,
          reason: `${candidate.category} tasks typically complete before ${task.category} tasks`,
          source: "pattern_based",
        });
      }
    }

    return suggestions;
  }

  /**
   * AI-analyzed suggestions
   * Use semantic similarity and reasoning
   */
  private async getAiAnalyzedSuggestions(
    task: TaskRow,
  ): Promise<DependencySuggestion[]> {
    const dismissed = await this.getDismissedPairs(task.id);

    // Get candidate tasks
    let query_str = `
      SELECT id, display_id, title, description, category
      FROM tasks
      WHERE id != ?
    `;
    const params: (string | null)[] = [task.id];

    if (task.task_list_id) {
      query_str += " AND task_list_id = ?";
      params.push(task.task_list_id);
    } else if (task.project_id) {
      query_str += " AND project_id = ?";
      params.push(task.project_id);
    } else {
      return [];
    }

    query_str +=
      " AND status NOT IN ('completed', 'cancelled', 'archived') LIMIT 10";

    const candidates = await query<{
      id: string;
      display_id: string;
      title: string;
      description: string | null;
      category: string;
    }>(query_str, params);

    if (candidates.length === 0) return [];

    // Build prompt
    const prompt = `Analyze these tasks and suggest dependencies for task "${task.title}":

## Current Task
- **ID**: ${task.display_id}
- **Title**: ${task.title}
- **Category**: ${task.category}
${task.description ? `- **Description**: ${task.description}` : ""}

## Candidate Tasks
${candidates
  .map(
    (c) =>
      `- **${c.display_id}**: ${c.title} (${c.category})${c.description ? ` - ${c.description}` : ""}`,
  )
  .join("\n")}

Suggest which candidates the current task should depend on (wait for) or block (run before).
Only suggest high-confidence dependencies based on logical ordering.

Return JSON:
{
  "suggestions": [
    {
      "targetId": "candidate-display-id",
      "relationship": "depends_on" | "blocks",
      "confidence": 0.0-1.0,
      "reason": "explanation"
    }
  ]
}

Return empty suggestions array if no strong dependencies exist.`;

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system:
          "You are a software project manager analyzing task dependencies. Only suggest dependencies that have a clear logical reason. Err on the side of fewer, high-confidence suggestions.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions: DependencySuggestion[] = [];

      for (const s of parsed.suggestions || []) {
        const candidate = candidates.find((c) => c.display_id === s.targetId);
        if (!candidate || dismissed.has(candidate.id)) continue;

        if (s.confidence >= 0.6) {
          suggestions.push({
            id: uuidv4(),
            sourceTaskId: task.id,
            targetTaskId: candidate.id,
            targetDisplayId: candidate.display_id,
            targetTitle: candidate.title,
            relationshipType:
              s.relationship === "blocks" ? "blocks" : "depends_on",
            confidence: s.confidence,
            reason: s.reason,
            source: "ai_analyzed",
          });
        }
      }

      return suggestions;
    } catch (err) {
      console.error("[DependencySuggester] AI analysis error:", err);
      return [];
    }
  }

  /**
   * Extract index from requirement ref like "success_criteria[0]"
   */
  private extractRequirementIndex(ref: string): number | null {
    const match = ref.match(/\[(\d+)\]$/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Deduplicate suggestions keeping highest confidence
   */
  private deduplicateSuggestions(
    suggestions: DependencySuggestion[],
  ): DependencySuggestion[] {
    const byPair = new Map<string, DependencySuggestion>();

    for (const s of suggestions) {
      const key = `${s.sourceTaskId}-${s.targetTaskId}`;
      const existing = byPair.get(key);

      if (!existing || s.confidence > existing.confidence) {
        byPair.set(key, s);
      }
    }

    return Array.from(byPair.values());
  }
}

// Export singleton instance
export const dependencySuggester = new DependencySuggester();
export default dependencySuggester;
