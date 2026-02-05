/**
 * AI Sync Service
 *
 * Provides AI-powered functionality for syncing between specs and tasks.
 * - Generate spec section updates based on task progress
 * - Regenerate project summaries from task outcomes
 * - Suggest task-to-spec links
 */

import { query, getOne, run } from "../../../database/db.js";
import {
  createAnthropicClient,
  AnthropicClient,
} from "../../../utils/anthropic-client.js";
import type { PrdRow } from "../../../types/prd.js";

const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_TOKENS = 4096;

// Rate limiting: track last call time per operation type
const rateLimits: Record<string, number> = {};
const RATE_LIMIT_MS = 10000; // 10 seconds between AI calls of same type

interface TaskForSync {
  id: string;
  displayId: string;
  title: string;
  description: string | null;
  status: string;
  category: string;
}

interface AcceptanceCriteriaResult {
  criterionIndex: number;
  met: boolean;
  verifiedBy: string;
}

interface SpecSectionUpdate {
  sectionType: string;
  originalContent: string[];
  suggestedContent: string[];
  reasoning: string;
  confidence: number;
}

interface ProjectSummary {
  summary: string;
  keyAccomplishments: string[];
  remainingWork: string[];
  blockers: string[];
}

interface SuggestedLink {
  requirementRef: string;
  requirementContent: string;
  linkType: "implements" | "tests" | "related";
  confidence: number;
  reasoning: string;
}

/**
 * Check rate limit for an operation
 */
function checkRateLimit(operation: string): boolean {
  const now = Date.now();
  const lastCall = rateLimits[operation] || 0;
  if (now - lastCall < RATE_LIMIT_MS) {
    return false;
  }
  rateLimits[operation] = now;
  return true;
}

/**
 * AI Sync Service class
 */
export class AISyncService {
  private client: AnthropicClient;

  constructor() {
    this.client = createAnthropicClient();
  }

  /**
   * Generate suggested updates for a spec section based on linked tasks
   */
  async generateSpecSectionUpdate(
    prdId: string,
    sectionType: "success_criteria" | "constraints",
  ): Promise<SpecSectionUpdate | null> {
    // Check rate limit
    if (!checkRateLimit(`spec-sync-${prdId}-${sectionType}`)) {
      throw new Error(
        "Rate limited. Please wait before making another AI sync request.",
      );
    }

    // Get the PRD
    const prd = await getOne<PrdRow>("SELECT * FROM prds WHERE id = ?", [
      prdId,
    ]);
    if (!prd) {
      throw new Error("PRD not found");
    }

    // Get original content
    const originalContent: string[] = JSON.parse(
      sectionType === "success_criteria"
        ? prd.success_criteria || "[]"
        : prd.constraints || "[]",
    );

    // Get linked tasks for this section
    const linkedTasks = await query<TaskForSync & { requirement_ref: string }>(
      `SELECT t.id, t.display_id as displayId, t.title, t.description, t.status, t.category, pt.requirement_ref
       FROM tasks t
       INNER JOIN prd_tasks pt ON t.id = pt.task_id
       WHERE pt.prd_id = ? AND pt.requirement_ref LIKE ?
       ORDER BY pt.requirement_ref`,
      [prdId, `${sectionType}[%`],
    );

    // Get acceptance criteria results for these tasks
    const taskIds = linkedTasks.map((t) => t.id);
    let acResults: AcceptanceCriteriaResult[] = [];
    if (taskIds.length > 0) {
      acResults = await query<AcceptanceCriteriaResult>(
        `SELECT criterion_index as criterionIndex, met, verified_by as verifiedBy
         FROM acceptance_criteria_results
         WHERE task_id IN (${taskIds.map(() => "?").join(",")})`,
        taskIds,
      );
    }

    // Build task summary for AI
    const taskSummary = linkedTasks.map((t) => ({
      displayId: t.displayId,
      title: t.title,
      status: t.status,
      linkedTo: t.requirement_ref,
    }));

    // Build prompt
    const prompt = `You are analyzing a PRD section and the tasks that implement it to suggest updates.

## PRD Section: ${sectionType === "success_criteria" ? "Success Criteria" : "Constraints"}

Current items:
${originalContent.map((item, i) => `${i + 1}. ${item}`).join("\n")}

## Linked Tasks (${linkedTasks.length} total)

${taskSummary.length > 0 ? JSON.stringify(taskSummary, null, 2) : "No tasks linked yet."}

## Task Status Summary
- Completed: ${linkedTasks.filter((t) => t.status === "completed").length}
- In Progress: ${linkedTasks.filter((t) => t.status === "in_progress").length}
- Pending: ${linkedTasks.filter((t) => t.status === "pending").length}
- Failed: ${linkedTasks.filter((t) => t.status === "failed").length}

## Acceptance Criteria Results
${acResults.length > 0 ? JSON.stringify(acResults, null, 2) : "No acceptance criteria verified yet."}

## Your Task

Based on the implementation progress, suggest any updates to the ${sectionType === "success_criteria" ? "success criteria" : "constraints"}.

Consider:
1. Are there items that need to be updated based on what was learned during implementation?
2. Are there items that are no longer relevant?
3. Are there new items that should be added based on discoveries?
4. Should any items be split or merged?

Respond in JSON format:
{
  "suggestedContent": ["Updated item 1", "Updated item 2", ...],
  "reasoning": "Explanation of changes",
  "confidence": 0.0-1.0
}

If no changes are needed, return the original content with confidence 1.0 and reasoning "No changes needed - implementation matches spec."`;

    try {
      const response = await this.client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        sectionType,
        originalContent,
        suggestedContent: parsed.suggestedContent || originalContent,
        reasoning: parsed.reasoning || "No reasoning provided",
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      console.error("[AISyncService] Error generating spec update:", error);
      throw error;
    }
  }

  /**
   * Regenerate a project summary based on task progress
   */
  async regenerateProjectSummary(projectId: string): Promise<ProjectSummary> {
    // Check rate limit
    if (!checkRateLimit(`summary-${projectId}`)) {
      throw new Error(
        "Rate limited. Please wait before making another AI sync request.",
      );
    }

    // Get project info
    const project = await getOne<{ name: string; description: string | null }>(
      "SELECT name, description FROM projects WHERE id = ?",
      [projectId],
    );
    if (!project) {
      throw new Error("Project not found");
    }

    // Get all tasks for this project
    const tasks = await query<TaskForSync>(
      `SELECT id, display_id as displayId, title, description, status, category
       FROM tasks
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      [projectId],
    );

    // Group tasks by status
    const tasksByStatus = {
      completed: tasks.filter((t) => t.status === "completed"),
      in_progress: tasks.filter((t) => t.status === "in_progress"),
      pending: tasks.filter((t) => t.status === "pending"),
      blocked: tasks.filter((t) => t.status === "blocked"),
      failed: tasks.filter((t) => t.status === "failed"),
    };

    // Build prompt
    const prompt = `You are generating a project summary based on task execution progress.

## Project: ${project.name}
${project.description ? `Description: ${project.description}` : ""}

## Task Summary (${tasks.length} total)

### Completed (${tasksByStatus.completed.length})
${
  tasksByStatus.completed
    .slice(0, 10)
    .map((t) => `- ${t.displayId}: ${t.title}`)
    .join("\n") || "None"
}
${tasksByStatus.completed.length > 10 ? `... and ${tasksByStatus.completed.length - 10} more` : ""}

### In Progress (${tasksByStatus.in_progress.length})
${tasksByStatus.in_progress.map((t) => `- ${t.displayId}: ${t.title}`).join("\n") || "None"}

### Pending (${tasksByStatus.pending.length})
${
  tasksByStatus.pending
    .slice(0, 5)
    .map((t) => `- ${t.displayId}: ${t.title}`)
    .join("\n") || "None"
}
${tasksByStatus.pending.length > 5 ? `... and ${tasksByStatus.pending.length - 5} more` : ""}

### Blocked (${tasksByStatus.blocked.length})
${tasksByStatus.blocked.map((t) => `- ${t.displayId}: ${t.title}`).join("\n") || "None"}

### Failed (${tasksByStatus.failed.length})
${tasksByStatus.failed.map((t) => `- ${t.displayId}: ${t.title}`).join("\n") || "None"}

## Your Task

Generate a concise project status summary that includes:
1. A 2-3 sentence overview of progress
2. Key accomplishments (what's been completed)
3. Remaining work (what's still pending)
4. Current blockers (if any)

Respond in JSON format:
{
  "summary": "Overview paragraph",
  "keyAccomplishments": ["accomplishment 1", "accomplishment 2", ...],
  "remainingWork": ["work item 1", "work item 2", ...],
  "blockers": ["blocker 1", ...] // empty array if none
}`;

    try {
      const response = await this.client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Failed to parse AI response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        summary: parsed.summary || "Unable to generate summary",
        keyAccomplishments: parsed.keyAccomplishments || [],
        remainingWork: parsed.remainingWork || [],
        blockers: parsed.blockers || [],
      };
    } catch (error) {
      console.error("[AISyncService] Error generating summary:", error);
      throw error;
    }
  }

  /**
   * Suggest spec links for a task based on its title and description
   */
  async suggestTaskSpecLinks(taskId: string): Promise<SuggestedLink[]> {
    // Check rate limit
    if (!checkRateLimit(`suggest-links-${taskId}`)) {
      throw new Error(
        "Rate limited. Please wait before making another AI sync request.",
      );
    }

    // Get the task
    const task = await getOne<TaskForSync & { project_id: string }>(
      `SELECT id, display_id as displayId, title, description, status, category, project_id
       FROM tasks WHERE id = ?`,
      [taskId],
    );
    if (!task) {
      throw new Error("Task not found");
    }

    // Get the PRD for this project
    const prd = await getOne<PrdRow>(
      "SELECT * FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
      [task.project_id],
    );
    if (!prd) {
      return []; // No PRD to link to
    }

    // Parse PRD sections
    const successCriteria: string[] = JSON.parse(prd.success_criteria || "[]");
    const constraints: string[] = JSON.parse(prd.constraints || "[]");

    // Get existing links for this task
    const existingLinks = await query<{ requirement_ref: string }>(
      "SELECT requirement_ref FROM prd_tasks WHERE task_id = ?",
      [taskId],
    );
    const existingRefs = new Set(existingLinks.map((l) => l.requirement_ref));

    // Build requirements list for AI
    const requirements = [
      ...successCriteria.map((content, idx) => ({
        ref: `success_criteria[${idx}]`,
        content,
        section: "Success Criteria",
      })),
      ...constraints.map((content, idx) => ({
        ref: `constraints[${idx}]`,
        content,
        section: "Constraints",
      })),
    ].filter((r) => !existingRefs.has(r.ref)); // Exclude already linked

    if (requirements.length === 0) {
      return []; // All requirements already linked
    }

    // Build prompt
    const prompt = `You are analyzing a task to suggest which PRD requirements it might implement or test.

## Task
ID: ${task.displayId}
Title: ${task.title}
Description: ${task.description || "No description"}
Category: ${task.category}
Status: ${task.status}

## Available Requirements (not yet linked)

${requirements.map((r, i) => `${i + 1}. [${r.ref}] ${r.section}: ${r.content}`).join("\n")}

## Your Task

Analyze the task and suggest which requirements it might be related to.

For each suggestion, determine:
1. The requirement reference (e.g., "success_criteria[0]")
2. The link type:
   - "implements" - the task directly implements this requirement
   - "tests" - the task tests/validates this requirement
   - "related" - the task is related but doesn't directly implement or test
3. Confidence score (0.0-1.0)
4. Brief reasoning

Only suggest links where confidence is >= 0.5

Respond in JSON format:
{
  "suggestions": [
    {
      "requirementRef": "success_criteria[0]",
      "linkType": "implements",
      "confidence": 0.8,
      "reasoning": "Task creates the feature described in this criterion"
    }
  ]
}

Return an empty suggestions array if no strong matches are found.`;

    try {
      const response = await this.client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: DEFAULT_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const suggestions = parsed.suggestions || [];

      // Enrich with requirement content
      return suggestions
        .filter((s: { confidence: number }) => s.confidence >= 0.5)
        .map(
          (s: {
            requirementRef: string;
            linkType: string;
            confidence: number;
            reasoning: string;
          }) => {
            const req = requirements.find((r) => r.ref === s.requirementRef);
            return {
              requirementRef: s.requirementRef,
              requirementContent: req?.content || "",
              linkType: s.linkType as "implements" | "tests" | "related",
              confidence: s.confidence,
              reasoning: s.reasoning,
            };
          },
        );
    } catch (error) {
      console.error("[AISyncService] Error suggesting links:", error);
      throw error;
    }
  }

  /**
   * Apply a spec section update
   */
  async applySpecUpdate(
    prdId: string,
    sectionType: "success_criteria" | "constraints",
    newContent: string[],
  ): Promise<void> {
    const column =
      sectionType === "success_criteria" ? "success_criteria" : "constraints";

    // Update the PRD
    await run(
      `UPDATE prds SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`,
      [JSON.stringify(newContent), prdId],
    );

    // Record in history if spec_history table exists
    try {
      await run(
        `INSERT INTO spec_history (id, prd_id, section_type, previous_content, new_content, changed_by, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          crypto.randomUUID(),
          prdId,
          sectionType,
          "[]", // Would need to fetch previous, simplified here
          JSON.stringify(newContent),
          "ai-sync",
        ],
      );
    } catch {
      // History table may not exist, that's ok
    }
  }
}

// Export singleton instance
export const aiSyncService = new AISyncService();
export default aiSyncService;
