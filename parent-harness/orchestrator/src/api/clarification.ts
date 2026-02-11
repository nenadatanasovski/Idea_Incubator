import { Router } from "express";
import * as clarification from "../clarification/index.js";

export const clarificationRouter = Router();

/**
 * GET /api/clarifications
 * Get all pending clarifications
 */
clarificationRouter.get("/", (_req, res) => {
  const pending = clarification.getPendingClarifications();
  res.json(pending);
});

/**
 * GET /api/clarifications/:id
 * Get a specific clarification
 */
clarificationRouter.get("/:id", (req, res) => {
  const request = clarification.getClarificationRequest(req.params.id);
  if (!request) {
    return res
      .status(404)
      .json({ error: "Clarification not found", status: 404 });
  }
  return res.json(request);
});

/**
 * POST /api/clarifications
 * Create a new clarification request
 */
clarificationRouter.post("/", async (req, res) => {
  const { taskId, question, context, suggestedOptions, expiresInHours } =
    req.body;

  if (!taskId || !question) {
    return res.status(400).json({
      error: "Missing required fields: taskId, question",
      status: 400,
    });
  }

  const request = await clarification.requestClarification(taskId, question, {
    context,
    suggestedOptions,
    expiresInHours,
  });

  return res.status(201).json(request);
});

/**
 * POST /api/clarifications/:id/answer
 * Answer a clarification
 */
clarificationRouter.post("/:id/answer", async (req, res) => {
  const { answer, answeredBy } = req.body;

  if (!answer) {
    return res.status(400).json({ error: "Missing answer", status: 400 });
  }

  const request = await clarification.answerClarification(
    req.params.id,
    answer,
    answeredBy,
  );

  if (!request) {
    return res.status(404).json({
      error: "Clarification not found or already answered",
      status: 404,
    });
  }

  return res.json(request);
});

/**
 * POST /api/clarifications/:id/skip
 * Skip a clarification
 */
clarificationRouter.post("/:id/skip", async (req, res) => {
  const { reason } = req.body;

  const request = await clarification.skipClarification(req.params.id, reason);

  if (!request) {
    return res.status(404).json({
      error: "Clarification not found or already handled",
      status: 404,
    });
  }

  return res.json(request);
});

/**
 * GET /api/clarifications/task/:taskId
 * Get clarifications for a specific task
 */
clarificationRouter.get("/task/:taskId", (req, res) => {
  const requests = clarification.getTaskClarifications(req.params.taskId);
  res.json(requests);
});

/**
 * GET /api/clarification/pending-approval
 * Get the pending strategic plan approval
 */
clarificationRouter.get("/pending-approval", (_req, res) => {
  const pending = clarification.getPendingApproval();
  if (!pending) {
    return res.json({ hasPending: false });
  }
  return res.json({ hasPending: true, ...pending });
});

/**
 * POST /api/clarification/respond
 * Respond to pending strategic plan approval
 * Body: { action: "approve" | "reject", feedback?: string }
 */
clarificationRouter.post("/respond", (req, res) => {
  const { action, feedback } = req.body;

  if (!action || !["approve", "reject", "feedback"].includes(action)) {
    return res.status(400).json({
      error: "Invalid action. Use: approve, reject, or feedback",
      status: 400,
    });
  }

  const result = clarification.handleApprovalResponse(
    `/${action}`,
    feedback || "",
    "api",
  );

  if (!result.handled) {
    return res.status(404).json({
      error: "No pending approval found",
      status: 404,
    });
  }

  return res.json({ success: true, message: result.message });
});
