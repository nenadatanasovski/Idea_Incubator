/**
 * Build API Routes (Idea-centric)
 *
 * REST API for managing build executions tied to ideas.
 * Works with the pipeline orchestrator and build bridge.
 */

import { Router, Request, Response } from "express";
import { getBuildBridge } from "../pipeline/build-bridge.js";
import { asyncHandler } from "../errors/build-errors.js";
import { getOne } from "../../database/db.js";

const router = Router();

/**
 * GET /api/build/:ideaId/status
 * Get current build status for an idea
 */
router.get(
  "/:ideaId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const { ideaId } = req.params;

    const bridge = getBuildBridge();
    const session = bridge.getSessionForIdea(ideaId);

    if (!session) {
      return res.json({
        status: "not_started",
        ideaId,
        session: null,
      });
    }

    return res.json({
      sessionId: session.sessionId,
      ideaId: session.ideaId,
      status: session.status,
      progress: {
        total: session.tasksTotal,
        completed: session.tasksComplete,
        failed: session.tasksFailed,
        current: session.currentTask || null,
      },
      siaInterventions: session.siaInterventions,
      error: session.error || null,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() || null,
    });
  }),
);

/**
 * POST /api/build/:ideaId/start
 * Start a new build for an idea
 */
router.post(
  "/:ideaId/start",
  asyncHandler(async (req: Request, res: Response) => {
    const { ideaId } = req.params;

    // Check if idea exists
    const idea = await getOne<{ id: string; title: string }>(
      "SELECT id, title FROM ideas WHERE id = ? OR slug = ?",
      [ideaId, ideaId],
    );

    if (!idea) {
      return res.status(404).json({
        success: false,
        error: "Idea not found",
        code: "IDEA_NOT_FOUND",
      });
    }

    const bridge = getBuildBridge();

    // Check for existing active session
    const existingSession = bridge.getSessionForIdea(idea.id);
    if (
      existingSession &&
      ["pending", "running"].includes(existingSession.status)
    ) {
      return res.status(409).json({
        success: false,
        error: "Build already in progress",
        code: "BUILD_IN_PROGRESS",
        sessionId: existingSession.sessionId,
        status: existingSession.status,
      });
    }

    try {
      const session = await bridge.startBuild(idea.id);

      return res.status(201).json({
        success: true,
        sessionId: session.sessionId,
        ideaId: session.ideaId,
        status: session.status,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to start build",
        code: "BUILD_START_FAILED",
      });
    }
  }),
);

/**
 * POST /api/build/:sessionId/pause
 * Pause a running build session
 */
router.post(
  "/:sessionId/pause",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const bridge = getBuildBridge();
    const session = bridge.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.status !== "running") {
      return res.status(400).json({
        success: false,
        error: `Cannot pause session in ${session.status} state`,
        code: "INVALID_STATE",
        currentStatus: session.status,
      });
    }

    // Note: Full pause implementation would require stopping the agent mid-loop
    // For now, we mark the session and the agent will check on next task
    (session as any)._pauseRequested = true;

    return res.json({
      success: true,
      message: "Pause requested - will pause after current task completes",
      sessionId,
    });
  }),
);

/**
 * POST /api/build/:sessionId/resume
 * Resume a paused or human_needed build session
 */
router.post(
  "/:sessionId/resume",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const bridge = getBuildBridge();
    const session = bridge.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (!["paused", "human_needed", "failed"].includes(session.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot resume session in ${session.status} state`,
        code: "INVALID_STATE",
        currentStatus: session.status,
      });
    }

    try {
      await bridge.resumeBuild(sessionId);

      return res.json({
        success: true,
        message: "Build resumed",
        sessionId,
        status: "running",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to resume build",
        code: "RESUME_FAILED",
      });
    }
  }),
);

/**
 * POST /api/build/:sessionId/skip
 * Skip the current failing task and continue
 */
router.post(
  "/:sessionId/skip",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { resolution } = req.body;

    const bridge = getBuildBridge();
    const session = bridge.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.status !== "human_needed" && session.status !== "failed") {
      return res.status(400).json({
        success: false,
        error: `Cannot skip task in ${session.status} state`,
        code: "INVALID_STATE",
        currentStatus: session.status,
      });
    }

    // Record SIA intervention if provided
    if (resolution && session.currentTask) {
      await bridge.recordSiaIntervention(
        sessionId,
        session.currentTask,
        resolution,
      );
    }

    // Mark task as skipped and continue
    try {
      // Reset the failure count and status to allow resume
      session.tasksFailed = 0;
      session.status = "running";

      await bridge.resumeBuild(sessionId);

      return res.json({
        success: true,
        message: "Task skipped - build continuing",
        sessionId,
        skippedTask: session.currentTask,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to skip task",
        code: "SKIP_FAILED",
      });
    }
  }),
);

/**
 * POST /api/build/:sessionId/resolve
 * Manually resolve a task (mark as fixed by human)
 */
router.post(
  "/:sessionId/resolve",
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({
        success: false,
        error: "Resolution description is required",
        code: "RESOLUTION_REQUIRED",
      });
    }

    const bridge = getBuildBridge();
    const session = bridge.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
        code: "SESSION_NOT_FOUND",
      });
    }

    if (session.status !== "human_needed" && session.status !== "failed") {
      return res.status(400).json({
        success: false,
        error: `Cannot resolve task in ${session.status} state`,
        code: "INVALID_STATE",
        currentStatus: session.status,
      });
    }

    // Record the SIA intervention
    if (session.currentTask) {
      await bridge.recordSiaIntervention(
        sessionId,
        session.currentTask,
        resolution,
      );
    }

    // Mark current task as complete (resolved by human) and continue
    session.tasksComplete++;
    session.tasksFailed = 0;
    session.status = "running";

    try {
      await bridge.resumeBuild(sessionId);

      return res.json({
        success: true,
        message: "Task resolved - build continuing",
        sessionId,
        resolvedTask: session.currentTask,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed after resolution",
        code: "RESOLVE_CONTINUE_FAILED",
      });
    }
  }),
);

/**
 * GET /api/build/:ideaId/history
 * Get build history for an idea
 */
router.get(
  "/:ideaId/history",
  asyncHandler(async (req: Request, res: Response) => {
    const { ideaId } = req.params;

    const bridge = getBuildBridge();
    const allSessions = bridge.listSessions();

    const ideaSessions = allSessions
      .filter((s) => s.ideaId === ideaId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return res.json({
      ideaId,
      sessions: ideaSessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        tasksTotal: s.tasksTotal,
        tasksComplete: s.tasksComplete,
        tasksFailed: s.tasksFailed,
        siaInterventions: s.siaInterventions,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() || null,
        error: s.error || null,
      })),
      count: ideaSessions.length,
    });
  }),
);

/**
 * GET /api/build/sessions
 * List all build sessions (for debugging/admin)
 */
router.get(
  "/sessions",
  asyncHandler(async (_req: Request, res: Response) => {
    const bridge = getBuildBridge();
    const sessions = bridge.listSessions();

    return res.json({
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        ideaId: s.ideaId,
        status: s.status,
        tasksTotal: s.tasksTotal,
        tasksComplete: s.tasksComplete,
        tasksFailed: s.tasksFailed,
        siaInterventions: s.siaInterventions,
        currentTask: s.currentTask || null,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() || null,
      })),
      count: sessions.length,
    });
  }),
);

export default router;
