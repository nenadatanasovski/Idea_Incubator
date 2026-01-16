/**
 * Statistics API Routes
 */
import { Router, Request, Response } from "express";
import {
  getCallStats,
  getStatsSummary,
  getCallCount,
} from "../../database/db.js";
import { CallStatsFilters } from "../../types/api-stats.js";

const router = Router();

function parseFilters(req: Request): CallStatsFilters {
  return {
    endpoint: req.query.endpoint as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  };
}

router.get("/calls", async (req: Request, res: Response) => {
  try {
    const filters = parseFilters(req);
    const stats = await getCallStats(filters);
    const total = stats.reduce((sum, s) => sum + s.count, 0);

    return res.json({
      calls: stats,
      total,
      period: { from: filters.from || null, to: filters.to || null },
    });
  } catch (error) {
    console.error("Failed to fetch call stats:", error);
    return res.status(500).json({ error: "Failed to fetch call stats" });
  }
});

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    return res.json(await getStatsSummary());
  } catch (error) {
    console.error("Failed to fetch summary:", error);
    return res.status(500).json({ error: "Failed to fetch summary" });
  }
});

router.get("/count", async (req: Request, res: Response) => {
  try {
    const count = await getCallCount(parseFilters(req));
    return res.json({ count });
  } catch (error) {
    console.error("Failed to fetch call count:", error);
    return res.status(500).json({ error: "Failed to fetch call count" });
  }
});

export default router;
