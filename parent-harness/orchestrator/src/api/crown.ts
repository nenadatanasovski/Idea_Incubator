/**
 * Crown Agent API
 *
 * Endpoints for monitoring and controlling the Crown (SIA) agent.
 */
import { Router } from "express";
import * as crown from "../crown/index.js";

export const crownRouter = Router();

/**
 * GET /api/crown/status
 * Get Crown agent status and last report
 */
crownRouter.get("/status", (_req, res) => {
  const lastReport = crown.getLastReport();

  res.json({
    status: "running",
    lastCheck: lastReport?.timestamp?.toISOString() || null,
    lastReport: lastReport
      ? {
          interventions: lastReport.interventions,
          alerts: lastReport.alerts,
          healthChecks: lastReport.healthChecks.map((h) => ({
            agentId: h.agentId,
            status: h.status,
            failureRate: Math.round(h.failureRate * 100),
            isStuck: h.isStuck,
            consecutiveFailures: h.consecutiveFailures,
          })),
        }
      : null,
  });
});

/**
 * POST /api/crown/check
 * Trigger a manual Crown check
 */
crownRouter.post("/check", async (_req, res) => {
  try {
    const report = await crown.triggerCrownCheck();

    res.json({
      success: true,
      report: {
        timestamp: report.timestamp.toISOString(),
        interventions: report.interventions,
        alerts: report.alerts,
        healthChecks: report.healthChecks.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * GET /api/crown/health
 * Get detailed health checks for all agents
 */
crownRouter.get("/health", async (_req, res) => {
  try {
    const report = await crown.runCrownCheck();

    res.json({
      timestamp: report.timestamp.toISOString(),
      agents: report.healthChecks.map((h) => ({
        agentId: h.agentId,
        status: h.status,
        recentSessions: h.recentSessions,
        failedSessions: h.failedSessions,
        failureRate: `${Math.round(h.failureRate * 100)}%`,
        isStuck: h.isStuck,
        timeSinceHeartbeat: h.timeSinceHeartbeat
          ? `${Math.round(h.timeSinceHeartbeat / 60000)} min`
          : "N/A",
        consecutiveFailures: h.consecutiveFailures,
        currentTaskId: h.currentTaskId,
      })),
      interventions: report.interventions,
      alerts: report.alerts,
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
