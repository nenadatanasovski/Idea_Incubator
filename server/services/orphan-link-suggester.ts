/**
 * OrphanLinkSuggester - AI-powered service to suggest requirement links for orphan tasks
 *
 * Analyzes orphan tasks and suggests which PRD requirements they might implement/test.
 */

import { v4 as uuidv4 } from "uuid";
import { query, getOne, run } from "../../database/db.js";
import { traceabilityService } from "./traceability-service.js";
import { createAnthropicClient } from "../../utils/anthropic-client.js";
import type {
  OrphanTask,
  TraceabilityLinkType,
} from "../../types/traceability.js";

// Types
export interface LinkSuggestion {
  taskId: string;
  requirementRef: string;
  sectionType: string;
  itemIndex: number;
  requirementContent: string;
  linkType: TraceabilityLinkType;
  confidence: number; // 0-100
  reasoning: string;
}

interface PrdRow {
  id: string;
  title: string;
  success_criteria: string;
  constraints: string;
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

export class OrphanLinkSuggester {
  private client = createAnthropicClient();

  /**
   * Get AI-powered link suggestions for an orphan task
   */
  async suggestLinks(
    taskId: string,
    projectId: string,
  ): Promise<LinkSuggestion[]> {
    if (!checkRateLimit(`suggest-${taskId}`)) {
      return [];
    }

    // Get task details
    const task = await getOne<{
      id: string;
      display_id: string;
      title: string;
      description: string;
      category: string;
    }>(
      "SELECT id, display_id, title, description, category FROM tasks WHERE id = ?",
      [taskId],
    );

    if (!task) return [];

    // Get PRD for project
    const prd = await getOne<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
      [projectId],
    );

    if (!prd) return [];

    // Parse requirements
    const rawSuccessCriteria = JSON.parse(prd.success_criteria || "[]");
    const successCriteria: string[] = rawSuccessCriteria.map(
      (item: string | { criterion: string }) =>
        typeof item === "string" ? item : item.criterion,
    );
    const constraints: string[] = JSON.parse(prd.constraints || "[]");

    // Build prompt for AI
    const prompt = this.buildSuggestionPrompt(
      task,
      successCriteria,
      constraints,
    );

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: `You are a project management assistant that analyzes tasks and requirements to suggest appropriate links.
Respond ONLY with a valid JSON array of suggestions. Each suggestion should have:
- requirementRef: string (e.g., "success_criteria[0]" or "constraints[1]")
- linkType: "implements" | "tests" | "related"
- confidence: number 0-100
- reasoning: string (brief explanation)

If no good matches exist, return an empty array [].`,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      return this.parseSuggestions(text, taskId, successCriteria, constraints);
    } catch (error) {
      console.error("Error generating link suggestions:", error);
      return [];
    }
  }

  private buildSuggestionPrompt(
    task: { title: string; description: string; category: string },
    successCriteria: string[],
    constraints: string[],
  ): string {
    const scList = successCriteria.map((s, i) => `  [${i}]: ${s}`).join("\n");
    const constraintList = constraints
      .map((c, i) => `  [${i}]: ${c}`)
      .join("\n");

    return `Analyze this task and suggest which requirements it might implement or test.

TASK:
- Title: ${task.title}
- Category: ${task.category}
- Description: ${task.description || "No description"}

REQUIREMENTS:

Success Criteria:
${scList || "  (none)"}

Constraints:
${constraintList || "  (none)"}

Suggest up to 3 best matching requirements with confidence scores.
Format requirement refs as "success_criteria[INDEX]" or "constraints[INDEX]".
Only suggest matches with confidence > 50%.`;
  }

  private parseSuggestions(
    text: string,
    taskId: string,
    successCriteria: string[],
    constraints: string[],
  ): LinkSuggestion[] {
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      const suggestions: LinkSuggestion[] = [];

      for (const item of parsed) {
        if (
          !item.requirementRef ||
          !item.linkType ||
          typeof item.confidence !== "number"
        ) {
          continue;
        }

        // Parse requirement ref
        const match = item.requirementRef.match(/^(\w+)\[(\d+)\]$/);
        if (!match) continue;

        const sectionType = match[1];
        const itemIndex = parseInt(match[2], 10);

        // Validate index
        let requirementContent = "";
        if (sectionType === "success_criteria") {
          if (itemIndex < 0 || itemIndex >= successCriteria.length) continue;
          requirementContent = successCriteria[itemIndex];
        } else if (sectionType === "constraints") {
          if (itemIndex < 0 || itemIndex >= constraints.length) continue;
          requirementContent = constraints[itemIndex];
        } else {
          continue;
        }

        // Validate link type
        const validLinkTypes: TraceabilityLinkType[] = [
          "implements",
          "tests",
          "related",
        ];
        if (!validLinkTypes.includes(item.linkType)) continue;

        suggestions.push({
          taskId,
          requirementRef: item.requirementRef,
          sectionType,
          itemIndex,
          requirementContent,
          linkType: item.linkType,
          confidence: Math.min(100, Math.max(0, item.confidence)),
          reasoning: item.reasoning || "",
        });
      }

      // Sort by confidence descending
      return suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
    } catch (error) {
      console.error("Error parsing suggestions:", error);
      return [];
    }
  }

  /**
   * Apply a link suggestion (create prd_tasks record)
   */
  async applyLink(
    suggestion: LinkSuggestion,
    prdId: string,
  ): Promise<{ success: boolean; linkId?: string; error?: string }> {
    try {
      // Check if link already exists
      const existing = await getOne<{ id: string }>(
        "SELECT id FROM prd_tasks WHERE task_id = ? AND prd_id = ? AND requirement_ref = ?",
        [suggestion.taskId, prdId, suggestion.requirementRef],
      );

      if (existing) {
        return { success: false, error: "Link already exists" };
      }

      const id = uuidv4();
      await run(
        `INSERT INTO prd_tasks (id, prd_id, task_id, requirement_ref, link_type, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [
          id,
          prdId,
          suggestion.taskId,
          suggestion.requirementRef,
          suggestion.linkType,
        ],
      );

      return { success: true, linkId: id };
    } catch (error) {
      console.error("Error applying link:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Dismiss an orphan task (mark as intentionally unlinked)
   */
  async dismissOrphan(
    taskId: string,
    projectId: string,
    reason?: string,
  ): Promise<void> {
    const id = uuidv4();
    await run(
      `INSERT OR REPLACE INTO dismissed_orphans (id, task_id, project_id, reason, dismissed_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [id, taskId, projectId, reason || null],
    );
  }

  /**
   * Get all non-dismissed orphan tasks with suggestion cache
   */
  async getOrphansWithSuggestions(
    projectId: string,
  ): Promise<Array<OrphanTask & { suggestions?: LinkSuggestion[] }>> {
    const orphans = await traceabilityService.getOrphanTasks(projectId);

    // Filter out dismissed
    const dismissed = await query<{ task_id: string }>(
      "SELECT task_id FROM dismissed_orphans WHERE project_id = ?",
      [projectId],
    );
    const dismissedSet = new Set(dismissed.map((d) => d.task_id));

    return orphans.filter((o) => !dismissedSet.has(o.id));
  }
}

// Export singleton
export const orphanLinkSuggester = new OrphanLinkSuggester();
export default orphanLinkSuggester;
