import { Router } from "express";
import * as sessions from "../db/sessions.js";

export const sessionsRouter = Router();

/**
 * GET /api/sessions
 * List sessions with optional filters
 */
sessionsRouter.get("/", (req, res) => {
  const filters = {
    agentId: req.query.agentId as string | undefined,
    taskId: req.query.taskId as string | undefined,
    status: req.query.status as sessions.AgentSession["status"] | undefined,
    limit: req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : undefined,
    offset: req.query.offset
      ? parseInt(req.query.offset as string, 10)
      : undefined,
  };

  const allSessions = sessions.getSessions(filters);
  res.json(allSessions);
});

/**
 * GET /api/sessions/:id
 * Get a single session with iterations
 */
sessionsRouter.get("/:id", (req, res) => {
  const session = sessions.getSessionWithIterations(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found", status: 404 });
  }
  res.json(session);
});

/**
 * GET /api/sessions/:id/iterations
 * Get iterations for a session
 */
sessionsRouter.get("/:id/iterations", (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found", status: 404 });
  }

  const iterations = sessions.getSessionIterations(req.params.id);
  res.json(iterations);
});

/**
 * POST /api/sessions
 * Create a new session
 */
sessionsRouter.post("/", (req, res) => {
  const { agentId, taskId } = req.body;

  if (!agentId) {
    return res.status(400).json({ error: "Missing agentId", status: 400 });
  }

  const session = sessions.createSession(agentId, taskId);
  res.status(201).json(session);
});

/**
 * POST /api/sessions/:id/terminate
 * Terminate a session
 */
sessionsRouter.post("/:id/terminate", (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found", status: 404 });
  }

  sessions.terminateSession(req.params.id);
  const updated = sessions.getSession(req.params.id);
  res.json(updated);
});

/**
 * PATCH /api/sessions/:id
 * Update session status
 */
sessionsRouter.patch("/:id", (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found", status: 404 });
  }

  const { status, finalResult, errorMessage } = req.body;

  if (status) {
    sessions.updateSessionStatus(
      req.params.id,
      status,
      finalResult,
      errorMessage,
    );
  }

  const updated = sessions.getSession(req.params.id);
  res.json(updated);
});

/**
 * POST /api/sessions/:id/iterations
 * Log an iteration
 */
sessionsRouter.post("/:id/iterations", (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found", status: 404 });
  }

  const {
    iterationNumber,
    inputMessage,
    outputMessage,
    toolCalls,
    toolResults,
    tokensInput,
    tokensOutput,
    cost,
    durationMs,
    status,
    errorMessage,
  } = req.body;

  if (
    iterationNumber === undefined ||
    tokensInput === undefined ||
    tokensOutput === undefined
  ) {
    return res.status(400).json({
      error:
        "Missing required fields: iterationNumber, tokensInput, tokensOutput",
      status: 400,
    });
  }

  const iteration = sessions.logIteration(req.params.id, iterationNumber, {
    inputMessage,
    outputMessage,
    toolCalls,
    toolResults,
    tokensInput,
    tokensOutput,
    cost: cost || 0,
    durationMs: durationMs || 0,
    status: status || "completed",
    errorMessage,
  });

  res.status(201).json(iteration);
});
