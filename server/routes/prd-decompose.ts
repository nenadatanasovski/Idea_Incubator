/**
 * PRD Decompose Routes
 *
 * REST API endpoints for extracting tasks from PRDs.
 * Part of: Task System V2 Implementation Plan (IMPL-5.6)
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prdService } from "../services/prd-service.js";
import { prdLinkService } from "../services/prd-link-service.js";
import { run, saveDb, getOne } from "../../database/db.js";

const router = Router();

/**
 * Task suggestion from PRD analysis
 */
interface TaskSuggestion {
  title: string;
  description: string;
  category: string;
  effort: string;
  requirementRef: string;
  confidence: number;
}

/**
 * Preview task extraction from PRD
 * POST /api/prds/:prdId/decompose
 *
 * Returns suggested tasks without creating them.
 */
router.post("/:prdId/decompose", async (req: Request, res: Response) => {
  try {
    const { prdId } = req.params;

    const prd = await prdService.getById(prdId);
    if (!prd) {
      return res.status(404).json({ error: "PRD not found" });
    }

    const suggestions: TaskSuggestion[] = [];

    // Extract tasks from success criteria
    if (prd.successCriteria && prd.successCriteria.length > 0) {
      for (let i = 0; i < prd.successCriteria.length; i++) {
        const criterion = prd.successCriteria[i];
        if (criterion.trim()) {
          suggestions.push({
            title: extractTaskTitle(criterion),
            description: `Implements: ${criterion}`,
            category: inferCategory(criterion),
            effort: inferEffort(criterion),
            requirementRef: `success_criteria[${i}]`,
            confidence: 0.8,
          });
        }
      }
    }

    // Extract tasks from functional description
    if (prd.functionalDescription) {
      const features = extractFeatures(prd.functionalDescription);
      for (const feature of features) {
        suggestions.push({
          title: feature.title,
          description: feature.description,
          category: inferCategory(feature.title),
          effort: "medium",
          requirementRef: "functional_description",
          confidence: 0.6,
        });
      }
    }

    // Extract tasks from constraints (usually validation/security tasks)
    if (prd.constraints && prd.constraints.length > 0) {
      for (let i = 0; i < prd.constraints.length; i++) {
        const constraint = prd.constraints[i];
        if (constraint.trim()) {
          suggestions.push({
            title: `Enforce: ${extractTaskTitle(constraint)}`,
            description: `Constraint: ${constraint}`,
            category: inferConstraintCategory(constraint),
            effort: "small",
            requirementRef: `constraints[${i}]`,
            confidence: 0.7,
          });
        }
      }
    }

    return res.json({
      prdId: prd.id,
      prdTitle: prd.title,
      suggestions,
      totalSuggested: suggestions.length,
    });
  } catch (err) {
    console.error("[prd-decompose] Error analyzing PRD:", err);
    return res.status(500).json({
      error: "Failed to analyze PRD",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

/**
 * Execute task extraction - create tasks from PRD
 * POST /api/prds/:prdId/decompose/execute
 *
 * Body: { suggestions?: TaskSuggestion[], taskListId?: string }
 */
router.post(
  "/:prdId/decompose/execute",
  async (req: Request, res: Response) => {
    try {
      const { prdId } = req.params;
      const { suggestions, taskListId } = req.body;

      const prd = await prdService.getById(prdId);
      if (!prd) {
        return res.status(404).json({ error: "PRD not found" });
      }

      // Get suggestions if not provided
      let tasksToCreate: TaskSuggestion[] = suggestions;
      if (!tasksToCreate || tasksToCreate.length === 0) {
        // Generate suggestions
        const analysisRes = await analyzeForTasks(prd);
        tasksToCreate = analysisRes;
      }

      const createdTasks: { id: string; displayId: string; title: string }[] =
        [];
      const now = new Date().toISOString();

      for (const suggestion of tasksToCreate) {
        const taskId = uuidv4();
        const displayId =
          `TU-PRD-${prd.slug.toUpperCase().slice(0, 4)}-${createdTasks.length + 1}`
            .padEnd(20)
            .slice(0, 20);

        await run(
          `INSERT INTO tasks (id, display_id, title, description, category, status, queue, task_list_id, priority, effort, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            taskId,
            displayId.trim(),
            suggestion.title,
            suggestion.description,
            suggestion.category || "feature",
            "pending",
            taskListId ? null : "evaluation",
            taskListId || null,
            "P2",
            suggestion.effort || "medium",
            now,
            now,
          ],
        );

        // Link task to PRD
        await prdLinkService.linkTask(
          prdId,
          taskId,
          suggestion.requirementRef,
          "implements",
        );

        const task = await getOne<{
          id: string;
          display_id: string;
          title: string;
        }>("SELECT id, display_id, title FROM tasks WHERE id = ?", [taskId]);

        if (task) {
          createdTasks.push({
            id: task.id,
            displayId: task.display_id,
            title: task.title,
          });
        }
      }

      await saveDb();

      return res.json({
        prdId: prd.id,
        tasksCreated: createdTasks.length,
        tasks: createdTasks,
      });
    } catch (err) {
      console.error("[prd-decompose] Error creating tasks from PRD:", err);
      return res.status(500).json({
        error: "Failed to create tasks from PRD",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

/**
 * Helper: Extract a task title from criterion text
 */
function extractTaskTitle(text: string): string {
  // Remove common prefixes
  let title = text
    .replace(/^(the system should|users can|must|should|shall)\s+/i, "")
    .replace(/^(implement|create|add|build|develop)\s+/i, "")
    .trim();

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate if too long
  if (title.length > 60) {
    title = title.slice(0, 57) + "...";
  }

  return title;
}

/**
 * Helper: Infer category from text
 */
function inferCategory(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("api") ||
    lowerText.includes("endpoint") ||
    lowerText.includes("route")
  ) {
    return "feature";
  }
  if (
    lowerText.includes("database") ||
    lowerText.includes("migration") ||
    lowerText.includes("schema")
  ) {
    return "infrastructure";
  }
  if (
    lowerText.includes("test") ||
    lowerText.includes("validation") ||
    lowerText.includes("verify")
  ) {
    return "test";
  }
  if (
    lowerText.includes("ui") ||
    lowerText.includes("component") ||
    lowerText.includes("page") ||
    lowerText.includes("display")
  ) {
    return "design";
  }
  if (
    lowerText.includes("document") ||
    lowerText.includes("readme") ||
    lowerText.includes("spec")
  ) {
    return "documentation";
  }
  if (
    lowerText.includes("security") ||
    lowerText.includes("auth") ||
    lowerText.includes("permission")
  ) {
    return "security";
  }
  if (
    lowerText.includes("performance") ||
    lowerText.includes("optimize") ||
    lowerText.includes("cache")
  ) {
    return "performance";
  }
  if (
    lowerText.includes("fix") ||
    lowerText.includes("bug") ||
    lowerText.includes("error")
  ) {
    return "bug";
  }
  if (
    lowerText.includes("refactor") ||
    lowerText.includes("cleanup") ||
    lowerText.includes("improve")
  ) {
    return "refactor";
  }

  return "feature";
}

/**
 * Helper: Infer effort from text
 */
function inferEffort(text: string): string {
  const lowerText = text.toLowerCase();

  // Large tasks
  if (
    lowerText.includes("complete") ||
    lowerText.includes("full") ||
    lowerText.includes("entire") ||
    lowerText.includes("system")
  ) {
    return "large";
  }

  // Small tasks
  if (
    lowerText.includes("simple") ||
    lowerText.includes("basic") ||
    lowerText.includes("single") ||
    lowerText.includes("minor")
  ) {
    return "small";
  }

  return "medium";
}

/**
 * Helper: Infer category for constraints
 */
function inferConstraintCategory(text: string): string {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("security") ||
    lowerText.includes("auth") ||
    lowerText.includes("encrypt")
  ) {
    return "security";
  }
  if (
    lowerText.includes("performance") ||
    lowerText.includes("latency") ||
    lowerText.includes("response time")
  ) {
    return "performance";
  }
  if (lowerText.includes("test") || lowerText.includes("coverage")) {
    return "test";
  }

  return "validation";
}

/**
 * Helper: Extract features from functional description
 */
function extractFeatures(
  description: string,
): { title: string; description: string }[] {
  const features: { title: string; description: string }[] = [];

  // Split by bullet points, numbers, or newlines
  const lines = description.split(/[\n\r]+|(?:^|\s)[-•*]\s+|(?:^|\s)\d+\.\s+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 10 && trimmed.length < 200) {
      features.push({
        title: extractTaskTitle(trimmed),
        description: trimmed,
      });
    }
  }

  return features;
}

/**
 * Helper: Analyze PRD and generate task suggestions
 */
async function analyzeForTasks(prd: any): Promise<TaskSuggestion[]> {
  const suggestions: TaskSuggestion[] = [];

  // From success criteria
  if (prd.successCriteria) {
    for (let i = 0; i < prd.successCriteria.length; i++) {
      const criterion = prd.successCriteria[i];
      if (criterion?.trim()) {
        suggestions.push({
          title: extractTaskTitle(criterion),
          description: `Implements: ${criterion}`,
          category: inferCategory(criterion),
          effort: inferEffort(criterion),
          requirementRef: `success_criteria[${i}]`,
          confidence: 0.8,
        });
      }
    }
  }

  // From functional description
  if (prd.functionalDescription) {
    const features = extractFeatures(prd.functionalDescription);
    for (const feature of features) {
      suggestions.push({
        title: feature.title,
        description: feature.description,
        category: inferCategory(feature.title),
        effort: "medium",
        requirementRef: "functional_description",
        confidence: 0.6,
      });
    }
  }

  return suggestions;
}

export default router;
