/**
 * Traceability API Routes
 *
 * Provides endpoints for PRD-to-Task traceability analysis.
 * Part of: Project Traceability Implementation Plan
 */

import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { traceabilityService } from "../services/traceability-service.js";
import { traceabilityGapAnalyzer } from "../services/traceability-gap-analyzer.js";
import { orphanLinkSuggester } from "../services/orphan-link-suggester.js";
import projectService from "../services/project-service.js";
import { run, saveDb, getOne, query } from "../../database/db.js";
import type {
  CreateTaskSpecLinkInput,
  TraceabilityLinkType,
} from "../../types/traceability.js";

const router = Router();

/**
 * GET /api/projects/:id/traceability
 * Get complete traceability view for a project
 */
router.get(
  "/projects/:id/traceability",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve project ID
      const projectId = await projectService.resolveProjectId(id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const traceability = await traceabilityService.getSpecCoverage(projectId);

      if (!traceability) {
        res.json({
          projectId,
          prdId: null,
          prdTitle: null,
          sections: [],
          overallCoverage: 100,
          orphanTaskCount: 0,
          gapCount: 0,
          message: "No PRD found for this project",
        });
        return;
      }

      res.json(traceability);
    } catch (error) {
      console.error("[traceability] Error getting traceability:", error);
      res.status(500).json({
        error: "Failed to get traceability",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/traceability/hierarchy
 * Get hierarchical traceability view for tree display
 */
router.get(
  "/projects/:id/traceability/hierarchy",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve project ID
      const projectId = await projectService.resolveProjectId(id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const hierarchy = await traceabilityService.getHierarchy(projectId);

      if (!hierarchy) {
        res.status(404).json({ error: "No PRD found for project" });
        return;
      }

      res.json(hierarchy);
    } catch (error) {
      console.error("[traceability] Error getting hierarchy:", error);
      res.status(500).json({
        error: "Failed to get traceability hierarchy",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/traceability/analyze
 * Run AI gap analysis for a project
 */
router.post(
  "/projects/:id/traceability/analyze",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const gaps = await traceabilityGapAnalyzer.analyzeProject(projectId);
      const counts = await traceabilityGapAnalyzer.getGapCounts(projectId);

      res.json({
        success: true,
        gapsFound: gaps.length,
        gaps,
        counts,
      });
    } catch (error) {
      console.error("[traceability] Error analyzing:", error);
      res.status(500).json({
        error: "Failed to analyze traceability",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/traceability/gaps
 * Get stored gaps for a project
 */
router.get(
  "/projects/:id/traceability/gaps",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const status = req.query.status as string | undefined;
      const gaps = await traceabilityGapAnalyzer.getGaps(projectId, status);
      const counts = await traceabilityGapAnalyzer.getGapCounts(projectId);

      res.json({ gaps, counts });
    } catch (error) {
      console.error("[traceability] Error fetching gaps:", error);
      res.status(500).json({
        error: "Failed to fetch gaps",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/traceability/gaps/:gapId/suggestions
 * Generate AI suggestions for a gap
 */
router.post(
  "/projects/:id/traceability/gaps/:gapId/suggestions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const suggestions = await traceabilityGapAnalyzer.generateSuggestions(
        req.params.gapId,
      );
      res.json({ suggestions });
    } catch (error) {
      console.error("[traceability] Error generating suggestions:", error);
      res.status(500).json({
        error: "Failed to generate suggestions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * PUT /api/projects/:id/traceability/gaps/:gapId/resolve
 * Mark a gap as resolved
 */
router.put(
  "/projects/:id/traceability/gaps/:gapId/resolve",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await traceabilityGapAnalyzer.resolveGap(req.params.gapId, "user");
      res.json({ success: true });
    } catch (error) {
      console.error("[traceability] Error resolving gap:", error);
      res.status(500).json({
        error: "Failed to resolve gap",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * PUT /api/projects/:id/traceability/gaps/:gapId/ignore
 * Mark a gap as ignored
 */
router.put(
  "/projects/:id/traceability/gaps/:gapId/ignore",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await traceabilityGapAnalyzer.ignoreGap(req.params.gapId);
      res.json({ success: true });
    } catch (error) {
      console.error("[traceability] Error ignoring gap:", error);
      res.status(500).json({
        error: "Failed to ignore gap",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/orphans
 * Get orphan tasks with link suggestions
 */
router.get(
  "/projects/:id/orphans",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const orphans =
        await orphanLinkSuggester.getOrphansWithSuggestions(projectId);

      res.json({
        orphans,
        totalCount: orphans.length,
      });
    } catch (error) {
      console.error("[traceability] Error getting orphans:", error);
      res.status(500).json({
        error: "Failed to get orphans",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/orphans/:taskId/suggest-links
 * Get AI-powered link suggestions for an orphan task
 */
router.post(
  "/projects/:id/orphans/:taskId/suggest-links",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const suggestions = await orphanLinkSuggester.suggestLinks(
        req.params.taskId,
        projectId,
      );

      res.json({ suggestions });
    } catch (error) {
      console.error("[traceability] Error suggesting links:", error);
      res.status(500).json({
        error: "Failed to suggest links",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/orphans/:taskId/apply-link
 * Apply a suggested link
 */
router.post(
  "/projects/:id/orphans/:taskId/apply-link",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const { requirementRef, linkType } = req.body;

      if (!requirementRef || !linkType) {
        res.status(400).json({ error: "Missing requirementRef or linkType" });
        return;
      }

      // Get PRD for project
      const prd = await getOne<{ id: string }>(
        "SELECT id FROM prds WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
        [projectId],
      );

      if (!prd) {
        res.status(404).json({ error: "No PRD found for project" });
        return;
      }

      const result = await orphanLinkSuggester.applyLink(
        {
          taskId: req.params.taskId,
          requirementRef,
          sectionType: requirementRef.split("[")[0],
          itemIndex: parseInt(
            requirementRef.match(/\[(\d+)\]/)?.[1] || "0",
            10,
          ),
          requirementContent: "",
          linkType,
          confidence: 100,
          reasoning: "User applied link",
        },
        prd.id,
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, linkId: result.linkId });
    } catch (error) {
      console.error("[traceability] Error applying link:", error);
      res.status(500).json({
        error: "Failed to apply link",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/orphans/:taskId/dismiss
 * Dismiss an orphan task (intentionally unlinked)
 */
router.post(
  "/projects/:id/orphans/:taskId/dismiss",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = await projectService.resolveProjectId(req.params.id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const { reason } = req.body;

      await orphanLinkSuggester.dismissOrphan(
        req.params.taskId,
        projectId,
        reason,
      );

      res.json({ success: true });
    } catch (error) {
      console.error("[traceability] Error dismissing orphan:", error);
      res.status(500).json({
        error: "Failed to dismiss orphan",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/coverage-gaps
 * Get coverage gaps (spec items with no linked tasks)
 */
router.get(
  "/projects/:id/coverage-gaps",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve project ID
      const projectId = await projectService.resolveProjectId(id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const gaps = await traceabilityService.getCoverageGaps(projectId);

      res.json({
        gaps,
        totalCount: gaps.length,
      });
    } catch (error) {
      console.error("[traceability] Error getting coverage gaps:", error);
      res.status(500).json({
        error: "Failed to get coverage gaps",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/orphan-tasks
 * Get tasks with no PRD links (orphan tasks)
 */
router.get(
  "/projects/:id/orphan-tasks",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve project ID
      const projectId = await projectService.resolveProjectId(id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const orphans = await traceabilityService.getOrphanTasks(projectId);

      res.json({
        tasks: orphans,
        totalCount: orphans.length,
      });
    } catch (error) {
      console.error("[traceability] Error getting orphan tasks:", error);
      res.status(500).json({
        error: "Failed to get orphan tasks",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:id/coverage-stats
 * Get coverage statistics summary
 */
router.get(
  "/projects/:id/coverage-stats",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Resolve project ID
      const projectId = await projectService.resolveProjectId(id);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const stats = await traceabilityService.getCoverageStats(projectId);

      if (!stats) {
        res.json({
          overallCoverage: 100,
          coveredRequirements: 0,
          totalRequirements: 0,
          orphanTaskCount: 0,
          gapCount: 0,
        });
        return;
      }

      res.json(stats);
    } catch (error) {
      console.error("[traceability] Error getting coverage stats:", error);
      res.status(500).json({
        error: "Failed to get coverage stats",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/tasks/:id/spec-links
 * Get PRD links for a specific task
 */
router.get(
  "/tasks/:id/spec-links",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const links = await traceabilityService.getTaskSpecLinks(id);

      res.json({
        links,
        totalCount: links.length,
      });
    } catch (error) {
      console.error("[traceability] Error getting task spec links:", error);
      res.status(500).json({
        error: "Failed to get task spec links",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/prd-tasks
 * Create a link between a task and a PRD requirement
 */
router.post(
  "/prd-tasks",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId, prdId, requirementRef, linkType } =
        req.body as CreateTaskSpecLinkInput;

      // Validate required fields
      if (!taskId || !prdId || !requirementRef || !linkType) {
        res.status(400).json({
          error: "Missing required fields",
          required: ["taskId", "prdId", "requirementRef", "linkType"],
        });
        return;
      }

      // Validate requirement ref format
      const refMatch = requirementRef.match(/^(\w+)\[(\d+)\]$/);
      if (!refMatch) {
        res.status(400).json({
          error: "Invalid requirement_ref format",
          expected: "section_name[index], e.g., success_criteria[0]",
        });
        return;
      }

      // Validate link type
      const validLinkTypes: TraceabilityLinkType[] = [
        "implements",
        "tests",
        "related",
      ];
      if (!validLinkTypes.includes(linkType)) {
        res.status(400).json({
          error: "Invalid link_type",
          valid: validLinkTypes,
        });
        return;
      }

      // Check if task exists
      const task = await getOne<{ id: string }>(
        "SELECT id FROM tasks WHERE id = ?",
        [taskId],
      );
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      // Check if PRD exists
      const prd = await getOne<{ id: string }>(
        "SELECT id FROM prds WHERE id = ?",
        [prdId],
      );
      if (!prd) {
        res.status(404).json({ error: "PRD not found" });
        return;
      }

      // Check if link already exists
      const existing = await getOne<{ id: string }>(
        "SELECT id FROM prd_tasks WHERE task_id = ? AND prd_id = ? AND requirement_ref = ?",
        [taskId, prdId, requirementRef],
      );
      if (existing) {
        res.status(409).json({
          error: "Link already exists",
          existingId: existing.id,
        });
        return;
      }

      // Create the link
      const id = uuidv4();
      await run(
        `INSERT INTO prd_tasks (id, prd_id, task_id, requirement_ref, link_type, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [id, prdId, taskId, requirementRef, linkType],
      );
      await saveDb();

      res.status(201).json({
        id,
        taskId,
        prdId,
        requirementRef,
        linkType,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[traceability] Error creating prd-task link:", error);
      res.status(500).json({
        error: "Failed to create link",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * DELETE /api/prd-tasks/:id
 * Remove a task-to-spec link
 */
router.delete(
  "/prd-tasks/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      // Check if link exists
      const existing = await getOne<{ id: string }>(
        "SELECT id FROM prd_tasks WHERE id = ?",
        [id],
      );
      if (!existing) {
        res.status(404).json({ error: "Link not found" });
        return;
      }

      await run("DELETE FROM prd_tasks WHERE id = ?", [id]);
      await saveDb();

      res.status(204).send();
    } catch (error) {
      console.error("[traceability] Error deleting prd-task link:", error);
      res.status(500).json({
        error: "Failed to delete link",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/prd-tasks/by-task/:taskId
 * Get all PRD links for a task
 */
router.get(
  "/prd-tasks/by-task/:taskId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;

      const links = await query<{
        id: string;
        prd_id: string;
        task_id: string;
        requirement_ref: string;
        link_type: string;
        created_at: string;
      }>("SELECT * FROM prd_tasks WHERE task_id = ?", [taskId]);

      res.json(
        links.map((l) => ({
          id: l.id,
          prdId: l.prd_id,
          taskId: l.task_id,
          requirementRef: l.requirement_ref,
          linkType: l.link_type,
          createdAt: l.created_at,
        })),
      );
    } catch (error) {
      console.error("[traceability] Error getting task links:", error);
      res.status(500).json({
        error: "Failed to get task links",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/prds/:prdId/requirement-tasks
 * Get tasks linked to a specific requirement in a PRD
 */
router.get(
  "/prds/:prdId/requirement-tasks",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { prdId } = req.params;
      const { ref } = req.query;

      if (!ref || typeof ref !== "string") {
        res.status(400).json({
          error: "Missing ref query parameter",
          expected: "?ref=success_criteria[0]",
        });
        return;
      }

      const tasks = await traceabilityService.getRequirementTasks(prdId, ref);

      res.json({
        tasks,
        totalCount: tasks.length,
      });
    } catch (error) {
      console.error("[traceability] Error getting requirement tasks:", error);
      res.status(500).json({
        error: "Failed to get requirement tasks",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/prd-tasks/by-prd/:prdId
 * Get all task links for a PRD
 */
router.get(
  "/prd-tasks/by-prd/:prdId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { prdId } = req.params;

      const links = await query<{
        id: string;
        prd_id: string;
        task_id: string;
        requirement_ref: string;
        link_type: string;
        created_at: string;
      }>("SELECT * FROM prd_tasks WHERE prd_id = ?", [prdId]);

      res.json(
        links.map((l) => ({
          id: l.id,
          prdId: l.prd_id,
          taskId: l.task_id,
          requirementRef: l.requirement_ref,
          linkType: l.link_type,
          createdAt: l.created_at,
        })),
      );
    } catch (error) {
      console.error("[traceability] Error getting PRD links:", error);
      res.status(500).json({
        error: "Failed to get PRD links",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
