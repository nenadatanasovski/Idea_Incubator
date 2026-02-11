import { Router } from "express";
import {
  spawnAgentSession,
  killSession,
  getRunningSessions,
  getPerMinuteRateLimitStats,
  getRateLimitProtectionStatus,
  getRollingWindowStats,
} from "../spawner/index.js";
import * as agents from "../db/agents.js";
import * as tasks from "../db/tasks.js";

export const spawnRouter = Router();

/**
 * POST /api/spawn
 * Spawn an agent session for a task
 */
spawnRouter.post("/", async (req, res) => {
  const { taskId, agentId, timeout, model } = req.body;

  if (!taskId || !agentId) {
    return res.status(400).json({
      error: "Missing required fields: taskId, agentId",
      status: 400,
    });
  }

  // Verify task exists
  const task = tasks.getTask(taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found", status: 404 });
  }

  // Verify agent exists
  const agent = agents.getAgent(agentId);
  if (!agent) {
    return res.status(404).json({ error: "Agent not found", status: 404 });
  }

  // Check agent is available
  if (agent.status !== "idle") {
    return res.status(409).json({
      error: `Agent ${agentId} is not available (status: ${agent.status})`,
      status: 409,
    });
  }

  // Check task is available
  if (task.status !== "pending") {
    return res.status(409).json({
      error: `Task ${taskId} is not available (status: ${task.status})`,
      status: 409,
    });
  }

  // Spawn the agent session (async, returns immediately with session ID)
  const result = await spawnAgentSession({ taskId, agentId, timeout, model });

  if (result.success) {
    res.status(201).json({
      success: true,
      sessionId: result.sessionId,
      message: `Agent ${agentId} spawned for task ${taskId}`,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error,
    });
  }
});

/**
 * DELETE /api/spawn/:sessionId
 * Kill a running agent session
 */
spawnRouter.delete("/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const killed = killSession(sessionId);

  if (killed) {
    res.json({ success: true, message: `Session ${sessionId} terminated` });
  } else {
    res
      .status(404)
      .json({ error: "Session not found or not running", status: 404 });
  }
});

/**
 * GET /api/spawn/running
 * Get list of currently running sessions
 */
spawnRouter.get("/running", (_req, res) => {
  const running = getRunningSessions();
  res.json({ sessions: running, count: running.length });
});

/**
 * GET /api/spawn/rate-limit
 * Get comprehensive rate limit status for dashboard
 */
spawnRouter.get("/rate-limit", (_req, res) => {
  const perMinute = getPerMinuteRateLimitStats();
  const protection = getRateLimitProtectionStatus();
  const rollingWindow = getRollingWindowStats();

  res.json({
    perMinute: {
      requests: {
        current: perMinute.usage.requests,
        limit: perMinute.limits.maxRequestsPerMinute,
        percent: perMinute.utilizationPercent.requests,
      },
      tokens: {
        current: perMinute.usage.tokens,
        limit: perMinute.limits.maxTokensPerMinute,
        percent: perMinute.utilizationPercent.tokens,
      },
      concurrent: {
        active: perMinute.usage.concurrent,
        reserved: perMinute.usage.reserved,
        limit: perMinute.limits.maxConcurrent,
        percent: perMinute.utilizationPercent.concurrent,
      },
      detectedLimits: perMinute.detectedLimits,
      debug: perMinute.debug,
    },
    backoff: {
      isActive: perMinute.backoff.isLimited,
      until: perMinute.backoff.backoffUntil,
      remainingMs: perMinute.backoff.remainingMs,
      consecutiveCount: perMinute.backoff.consecutiveCount,
      historyCount: perMinute.backoff.historyCount,
    },
    rollingWindow: {
      spawns: rollingWindow.spawnsInWindow,
      tokens: rollingWindow.tokensInWindow,
      cost: rollingWindow.costInWindow,
      oldestTimestamp: rollingWindow.oldestTimestamp,
    },
    protection,
    status: perMinute.backoff.isLimited ? "paused" : "active",
  });
});
