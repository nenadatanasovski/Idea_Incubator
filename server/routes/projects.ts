/**
 * Projects API Routes
 *
 * CRUD operations for projects and idea-project linking.
 * Projects bridge Ideas (ideation) and Tasks (execution).
 */

import { Router, Request, Response } from "express";
import projectService from "../services/project-service.js";
import type { ProjectStatus } from "../../types/project.js";

const router = Router();

/**
 * GET /api/projects
 * List all projects with optional filtering
 * Query params: status, hasIdea, limit, offset
 */
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, hasIdea, limit, offset, ownerId } = req.query;

    const projects = await projectService.getAllProjects({
      status: status as ProjectStatus,
      hasIdea:
        hasIdea === "true" ? true : hasIdea === "false" ? false : undefined,
      ownerId: ownerId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(projects);
  } catch (error) {
    console.error("[projects] Error listing projects:", error);
    res.status(500).json({
      error: "Failed to list projects",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, code, ideaId, ownerId } = req.body;

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Name is required" });
      return;
    }

    const project = await projectService.createProject({
      name,
      description,
      code,
      ideaId,
      ownerId,
    });

    res.status(201).json(project);
  } catch (error) {
    console.error("[projects] Error creating project:", error);
    res.status(500).json({
      error: "Failed to create project",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/projects/from-idea
 * Create a project from an existing idea
 */
router.post(
  "/from-idea",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { ideaId } = req.body;

      if (!ideaId) {
        res.status(400).json({ error: "ideaId is required" });
        return;
      }

      const project = await projectService.createProjectFromIdea(ideaId);
      res.status(201).json(project);
    } catch (error) {
      console.error("[projects] Error creating project from idea:", error);
      res.status(500).json({
        error: "Failed to create project from idea",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/by-idea/:ideaSlug
 * Get project by idea slug
 */
router.get(
  "/by-idea/:ideaSlug",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { ideaSlug } = req.params;

      const project = await projectService.getProjectByIdeaSlug(ideaSlug);

      if (!project) {
        res.status(404).json({ error: "No project found for this idea" });
        return;
      }

      res.json(project);
    } catch (error) {
      console.error("[projects] Error getting project by idea:", error);
      res.status(500).json({
        error: "Failed to get project",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/check-code/:code
 * Check if a project code is available
 */
router.get(
  "/check-code/:code",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { code } = req.params;
      const available = await projectService.isCodeAvailable(code);
      res.json({ code: code.toUpperCase(), available });
    } catch (error) {
      console.error("[projects] Error checking code:", error);
      res.status(500).json({
        error: "Failed to check code",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * GET /api/projects/:ref
 * Get project by ID, code, or slug
 */
router.get("/:ref", async (req: Request, res: Response): Promise<void> => {
  try {
    const { ref } = req.params;
    const { withStats } = req.query;

    // If stats requested, get from stats view
    if (withStats === "true") {
      const projectId = await projectService.resolveProjectId(ref);
      if (!projectId) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const project = await projectService.getProjectStats(projectId);
      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json(project);
      return;
    }

    // Try all resolution methods
    let project = await projectService.getProjectById(ref);
    if (!project) project = await projectService.getProjectByCode(ref);
    if (!project) project = await projectService.getProjectBySlug(ref);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error("[projects] Error getting project:", error);
    res.status(500).json({
      error: "Failed to get project",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * PUT /api/projects/:id
 * Update a project
 */
router.put("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, status, ownerId } = req.body;

    const project = await projectService.updateProject(id, {
      name,
      description,
      status,
      ownerId,
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error("[projects] Error updating project:", error);
    res.status(500).json({
      error: "Failed to update project",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await projectService.deleteProject(id);

    if (!deleted) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("[projects] Error deleting project:", error);
    res.status(500).json({
      error: "Failed to delete project",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/projects/:id/link-idea
 * Link an idea to a project
 */
router.post(
  "/:id/link-idea",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { ideaId } = req.body;

      if (!ideaId) {
        res.status(400).json({ error: "ideaId is required" });
        return;
      }

      const project = await projectService.linkIdeaToProject(ideaId, id);
      res.json(project);
    } catch (error) {
      console.error("[projects] Error linking idea:", error);
      res.status(500).json({
        error: "Failed to link idea",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/unlink-idea
 * Unlink an idea from a project
 */
router.post(
  "/:id/unlink-idea",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const project = await projectService.unlinkIdeaFromProject(id);
      res.json(project);
    } catch (error) {
      console.error("[projects] Error unlinking idea:", error);
      res.status(500).json({
        error: "Failed to unlink idea",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/start
 * Mark project as started (sets started_at if not set)
 */
router.post(
  "/:id/start",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await projectService.markProjectStarted(id);
      const project = await projectService.getProjectById(id);

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      res.json(project);
    } catch (error) {
      console.error("[projects] Error starting project:", error);
      res.status(500).json({
        error: "Failed to start project",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

/**
 * POST /api/projects/:id/complete
 * Mark project as completed
 */
router.post(
  "/:id/complete",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      await projectService.markProjectCompleted(id);
      const project = await projectService.getProjectById(id);

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      res.json(project);
    } catch (error) {
      console.error("[projects] Error completing project:", error);
      res.status(500).json({
        error: "Failed to complete project",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

export default router;
