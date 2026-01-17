/**
 * Spec API Routes
 *
 * Endpoints for spec generation, retrieval, and management.
 * Part of: Ideation Agent Spec Generation Implementation (SPEC-004-C)
 */

import { Router, Request, Response } from "express";
import {
  generateSpec,
  getSpec,
  getSpecBySession,
  getSpecSections,
  updateSpecSection,
  updateSpecWorkflowState,
} from "../../agents/ideation/spec-generator.js";
import { calculateReadiness } from "../../agents/ideation/readiness-calculator.js";
import { messageStore } from "../../agents/ideation/message-store.js";
import {
  getAllowedTransitions,
  getWorkflowHistory,
} from "../services/spec/workflow-state-machine.js";
import type { SpecWorkflowState } from "../../types/spec.js";

const router = Router();

/**
 * POST /api/specs/generate
 * Generate a spec from an ideation session
 */
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, ideaTitle } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const result = await generateSpec(sessionId, userId, ideaTitle);

    res.json({
      success: true,
      spec: result.spec,
      confidence: result.confidence,
      sectionConfidences: result.sectionConfidences,
      needsReviewSections: result.needsReviewSections,
      clarifyingQuestions: result.clarifyingQuestions,
    });
  } catch (error) {
    console.error("[SpecRoutes] Generate error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate spec",
    });
  }
});

/**
 * GET /api/specs/readiness/:sessionId
 * Get readiness score for a session
 */
router.get("/readiness/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const messages = await messageStore.getBySession(sessionId);
    const readiness = await calculateReadiness(messages);

    res.json({
      success: true,
      readiness,
    });
  } catch (error) {
    console.error("[SpecRoutes] Readiness error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to calculate readiness",
    });
  }
});

/**
 * GET /api/specs/session/:sessionId
 * Get spec by session ID
 * NOTE: This route must be defined BEFORE /:id to prevent "session" being matched as an id
 */
router.get("/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const spec = await getSpecBySession(sessionId);

    if (!spec) {
      return res.status(404).json({ error: "No spec found for session" });
    }

    const sections = await getSpecSections(spec.id);

    res.json({
      success: true,
      spec,
      sections,
    });
  } catch (error) {
    console.error("[SpecRoutes] Get spec by session error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get spec",
    });
  }
});

/**
 * GET /api/specs/:id
 * Get a spec by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await getSpec(id);

    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    const sections = await getSpecSections(id);

    res.json({
      success: true,
      spec,
      sections,
    });
  } catch (error) {
    console.error("[SpecRoutes] Get spec error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get spec",
    });
  }
});

/**
 * PATCH /api/specs/:id/sections/:sectionId
 * Update a spec section
 */
router.patch(
  "/:id/sections/:sectionId",
  async (req: Request, res: Response) => {
    try {
      const { sectionId } = req.params;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "content is required" });
      }

      await updateSpecSection(sectionId, content);

      res.json({ success: true });
    } catch (error) {
      console.error("[SpecRoutes] Update section error:", error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Failed to update section",
      });
    }
  },
);

/**
 * POST /api/specs/:id/submit
 * Submit spec for review (draft -> review)
 */
router.post("/:id/submit", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await getSpec(id);
    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    if (spec.workflowState !== "draft") {
      return res.status(400).json({
        error: `Cannot submit spec in ${spec.workflowState} state`,
      });
    }

    const updated = await updateSpecWorkflowState(id, "review");

    res.json({
      success: true,
      spec: updated,
    });
  } catch (error) {
    console.error("[SpecRoutes] Submit error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to submit spec",
    });
  }
});

/**
 * POST /api/specs/:id/approve
 * Approve spec (review -> approved)
 */
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await getSpec(id);
    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    if (spec.workflowState !== "review") {
      return res.status(400).json({
        error: `Cannot approve spec in ${spec.workflowState} state`,
      });
    }

    const updated = await updateSpecWorkflowState(id, "approved");

    res.json({
      success: true,
      spec: updated,
    });
  } catch (error) {
    console.error("[SpecRoutes] Approve error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to approve spec",
    });
  }
});

/**
 * POST /api/specs/:id/request-changes
 * Request changes (review -> draft)
 */
router.post("/:id/request-changes", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const spec = await getSpec(id);
    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    if (spec.workflowState !== "review") {
      return res.status(400).json({
        error: `Cannot request changes for spec in ${spec.workflowState} state`,
      });
    }

    const updated = await updateSpecWorkflowState(id, "draft");

    res.json({
      success: true,
      spec: updated,
      reason,
    });
  } catch (error) {
    console.error("[SpecRoutes] Request changes error:", error);
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to request changes",
    });
  }
});

/**
 * POST /api/specs/:id/archive
 * Archive spec (any -> archived)
 */
router.post("/:id/archive", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await getSpec(id);
    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    if (spec.workflowState === "archived") {
      return res.status(400).json({ error: "Spec is already archived" });
    }

    const updated = await updateSpecWorkflowState(id, "archived");

    res.json({
      success: true,
      spec: updated,
    });
  } catch (error) {
    console.error("[SpecRoutes] Archive error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to archive spec",
    });
  }
});

/**
 * GET /api/specs/:id/allowed-transitions
 * Get allowed workflow transitions for a spec
 */
router.get("/:id/allowed-transitions", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const spec = await getSpec(id);
    if (!spec) {
      return res.status(404).json({ error: "Spec not found" });
    }

    const currentState = spec.workflowState as SpecWorkflowState;
    const allowedTransitions = getAllowedTransitions(currentState);

    res.json({
      success: true,
      currentState,
      allowedTransitions,
    });
  } catch (error) {
    console.error("[SpecRoutes] Get allowed transitions error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get allowed transitions",
    });
  }
});

/**
 * GET /api/specs/:id/history
 * Get workflow history for a spec
 */
router.get("/:id/history", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const history = await getWorkflowHistory(id);

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("[SpecRoutes] Get history error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get history",
    });
  }
});

export default router;
