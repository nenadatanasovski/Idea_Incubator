/**
 * Stability API
 *
 * Exposes stability metrics and crash history.
 */
import { Router } from "express";
import { getStabilityStats } from "../stability/index.js";
import * as fs from "fs";
import * as path from "path";

export const stabilityRouter = Router();

const CRASH_LOG_FILE = path.join(
  process.env.HOME || "/tmp",
  ".harness",
  "crash.log",
);

/**
 * GET /api/stability
 * Get current stability stats
 */
stabilityRouter.get("/", (_req, res) => {
  const stats = getStabilityStats();

  // Calculate uptime
  const startedAt = new Date(stats.startedAt).getTime();
  const uptimeMs = Date.now() - startedAt;
  const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
  const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));

  res.json({
    ...stats,
    uptime: `${uptimeHours}h ${uptimeMinutes}m`,
    uptimeMs,
    memoryUsage: process.memoryUsage(),
    nodeVersion: process.version,
  });
});

/**
 * GET /api/stability/crashes
 * Get recent crash history
 */
stabilityRouter.get("/crashes", (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;

  if (!fs.existsSync(CRASH_LOG_FILE)) {
    res.json({ crashes: [], total: 0 });
    return;
  }

  try {
    const content = fs.readFileSync(CRASH_LOG_FILE, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);

    // Parse and return most recent crashes
    const crashes = lines
      .slice(-limit)
      .reverse()
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { raw: line };
        }
      });

    res.json({
      crashes,
      total: lines.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to read crash log" });
  }
});

/**
 * GET /api/stability/health
 * Quick health check with stability info
 */
stabilityRouter.get("/health", (_req, res) => {
  const stats = getStabilityStats();
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  // Calculate health status
  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  const issues: string[] = [];

  // Check crash count (more than 5 in current session = degraded)
  if (stats.crashCount > 10) {
    status = "unhealthy";
    issues.push(`High crash count: ${stats.crashCount}`);
  } else if (stats.crashCount > 5) {
    status = "degraded";
    issues.push(`Elevated crash count: ${stats.crashCount}`);
  }

  // Check memory (more than 80% = degraded, more than 95% = unhealthy)
  const heapPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  if (heapPercent > 95) {
    status = "unhealthy";
    issues.push(`Critical memory usage: ${heapPercent.toFixed(1)}%`);
  } else if (heapPercent > 80) {
    if (status === "healthy") status = "degraded";
    issues.push(`High memory usage: ${heapPercent.toFixed(1)}%`);
  }

  res.json({
    status,
    issues,
    tickCount: stats.tickCount,
    crashCount: stats.crashCount,
    memory: `${heapUsedMB}/${heapTotalMB}MB (${heapPercent.toFixed(1)}%)`,
    uptime: stats.startedAt,
  });
});

export default stabilityRouter;
