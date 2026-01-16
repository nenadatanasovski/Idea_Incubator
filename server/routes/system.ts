/**
 * System Routes
 * Routes for database operations and system statistics
 */
import { Router } from "express";
import { asyncHandler, respond } from "./shared.js";
import { query, getOne, reloadDb } from "../../database/db.js";

const router = Router();

// POST /api/db/reload - Force reload database from disk
// Useful when external processes have written to the database file
router.post(
  "/db/reload",
  asyncHandler(async (_req, res) => {
    await reloadDb();
    respond(res, { message: "Database reloaded from disk" });
  }),
);

// GET /api/stats - Get overall statistics
router.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const totalIdeas = await getOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM ideas",
    );

    const byType = await query<{ idea_type: string; count: number }>(
      "SELECT idea_type, COUNT(*) as count FROM ideas GROUP BY idea_type",
    );

    const byStage = await query<{ lifecycle_stage: string; count: number }>(
      "SELECT lifecycle_stage, COUNT(*) as count FROM ideas GROUP BY lifecycle_stage",
    );

    const avgScore = await getOne<{ avg: number }>(
      "SELECT AVG(avg_score) as avg FROM idea_scores WHERE avg_score IS NOT NULL",
    );

    const totalCost = await getOne<{ total: number }>(
      "SELECT SUM(estimated_cost) as total FROM cost_log",
    );

    respond(res, {
      totalIdeas: totalIdeas?.count || 0,
      byType: Object.fromEntries(byType.map((t) => [t.idea_type, t.count])),
      byStage: Object.fromEntries(
        byStage.map((s) => [s.lifecycle_stage, s.count]),
      ),
      avgScore: avgScore?.avg || 0,
      totalCost: totalCost?.total || 0,
    });
  }),
);

export default router;
