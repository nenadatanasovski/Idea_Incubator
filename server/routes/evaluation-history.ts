/**
 * Evaluation History Routes
 * Provides API endpoints for querying evaluation history, score trends,
 * and iterative improvement tracking across evaluation sessions.
 */
import { Router } from "express";
import { asyncHandler, respond, respondError } from "./shared.js";
import { query, getOne, reloadDb } from "../../database/db.js";

const router = Router();

// GET /api/evaluation-history/:ideaSlug/sessions - Get all evaluation sessions for an idea
router.get(
  "/:ideaSlug/sessions",
  asyncHandler(async (req, res) => {
    const { ideaSlug } = req.params;

    await reloadDb();

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );

    if (!idea) {
      respondError(res, 404, `Idea not found: ${ideaSlug}`);
      return;
    }

    const sessions = await query<{
      id: string;
      content_hash: string | null;
      overall_score: number | null;
      overall_confidence: number | null;
      created_at: string;
    }>(
      `SELECT id, content_hash, overall_score, overall_confidence, created_at
       FROM evaluation_sessions
       WHERE idea_id = ?
       ORDER BY created_at DESC`,
      [idea.id],
    );

    // Enrich each session with debate and synthesis info
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const debateInfo = await getOne<{
          round_count: number;
          criterion_count: number;
        }>(
          `SELECT COUNT(*) as round_count, COUNT(DISTINCT criterion) as criterion_count
           FROM debate_rounds WHERE evaluation_run_id = ?`,
          [session.id],
        );

        const synthesis = await getOne<{
          recommendation: string;
          redteam_survival_rate: number | null;
        }>(
          `SELECT recommendation, redteam_survival_rate
           FROM final_syntheses WHERE evaluation_run_id = ?
           ORDER BY completed_at DESC LIMIT 1`,
          [session.id],
        );

        return {
          ...session,
          debate_rounds: debateInfo?.round_count || 0,
          criteria_debated: debateInfo?.criterion_count || 0,
          recommendation: synthesis?.recommendation || null,
          redteam_survival_rate: synthesis?.redteam_survival_rate || null,
        };
      }),
    );

    respond(res, {
      idea_slug: ideaSlug,
      session_count: enrichedSessions.length,
      sessions: enrichedSessions,
    });
  }),
);

// GET /api/evaluation-history/:ideaSlug/trends - Get score trends across sessions
router.get(
  "/:ideaSlug/trends",
  asyncHandler(async (req, res) => {
    const { ideaSlug } = req.params;

    await reloadDb();

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );

    if (!idea) {
      respondError(res, 404, `Idea not found: ${ideaSlug}`);
      return;
    }

    // Get overall score progression across sessions
    const overallTrend = await query<{
      session_id: string;
      overall_score: number | null;
      created_at: string;
    }>(
      `SELECT id as session_id, overall_score, created_at
       FROM evaluation_sessions
       WHERE idea_id = ?
       ORDER BY created_at ASC`,
      [idea.id],
    );

    // Get per-criterion score trends from evaluations table
    const criterionTrends = await query<{
      session_id: string;
      criterion: string;
      category: string;
      initial_score: number;
      final_score: number;
      created_at: string;
    }>(
      `SELECT e.session_id, e.criterion, e.category,
              e.initial_score, e.final_score, e.created_at
       FROM evaluations e
       JOIN evaluation_sessions s ON s.id = e.session_id
       WHERE s.idea_id = ?
       ORDER BY e.created_at ASC, e.category, e.criterion`,
      [idea.id],
    );

    // Get score_history entries for detailed change tracking
    const scoreChanges = await query<{
      session_id: string;
      criterion: string;
      score_before: number | null;
      score_after: number;
      adjustment: number;
      reason: string | null;
      created_at: string;
    }>(
      `SELECT session_id, criterion, score_before, score_after, adjustment, reason, created_at
       FROM score_history
       WHERE idea_id = ?
       ORDER BY created_at ASC`,
      [idea.id],
    );

    // Calculate improvement metrics
    let improvement = null;
    if (overallTrend.length >= 2) {
      const first = overallTrend[0];
      const last = overallTrend[overallTrend.length - 1];
      improvement = {
        first_score: first.overall_score,
        latest_score: last.overall_score,
        delta:
          first.overall_score !== null && last.overall_score !== null
            ? last.overall_score - first.overall_score
            : null,
        sessions: overallTrend.length,
        first_evaluated: first.created_at,
        latest_evaluated: last.created_at,
      };
    }

    respond(res, {
      idea_slug: ideaSlug,
      overall_trend: overallTrend,
      criterion_trends: criterionTrends,
      score_changes: scoreChanges,
      improvement,
    });
  }),
);

// GET /api/evaluation-history/:ideaSlug/compare/:sessionId1/:sessionId2 - Compare two sessions
router.get(
  "/:ideaSlug/compare/:sessionId1/:sessionId2",
  asyncHandler(async (req, res) => {
    const { ideaSlug, sessionId1, sessionId2 } = req.params;

    await reloadDb();

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );

    if (!idea) {
      respondError(res, 404, `Idea not found: ${ideaSlug}`);
      return;
    }

    // Get scores for both sessions
    const getSessionScores = async (sessionId: string) => {
      const session = await getOne<{
        overall_score: number | null;
        overall_confidence: number | null;
        created_at: string;
      }>(
        `SELECT overall_score, overall_confidence, created_at
         FROM evaluation_sessions WHERE id = ? AND idea_id = ?`,
        [sessionId, idea.id],
      );

      if (!session) return null;

      const scores = await query<{
        criterion: string;
        category: string;
        initial_score: number;
        final_score: number;
        confidence: number;
        user_override: number | null;
      }>(
        `SELECT criterion, category, initial_score, final_score, confidence, user_override
         FROM evaluations WHERE session_id = ?
         ORDER BY category, criterion`,
        [sessionId],
      );

      return { ...session, scores };
    };

    const session1 = await getSessionScores(sessionId1);
    const session2 = await getSessionScores(sessionId2);

    if (!session1) {
      respondError(res, 404, `Session not found: ${sessionId1}`);
      return;
    }
    if (!session2) {
      respondError(res, 404, `Session not found: ${sessionId2}`);
      return;
    }

    // Build comparison
    const comparisons = session2.scores.map((s2) => {
      const s1 = session1.scores.find((s) => s.criterion === s2.criterion);
      return {
        criterion: s2.criterion,
        category: s2.category,
        session1_score: s1?.final_score ?? null,
        session2_score: s2.final_score,
        delta: s1 ? s2.final_score - s1.final_score : null,
        session1_confidence: s1?.confidence ?? null,
        session2_confidence: s2.confidence,
      };
    });

    respond(res, {
      idea_slug: ideaSlug,
      session1: {
        id: sessionId1,
        overall_score: session1.overall_score,
        created_at: session1.created_at,
      },
      session2: {
        id: sessionId2,
        overall_score: session2.overall_score,
        created_at: session2.created_at,
      },
      overall_delta:
        session1.overall_score !== null && session2.overall_score !== null
          ? session2.overall_score - session1.overall_score
          : null,
      comparisons,
    });
  }),
);

// GET /api/evaluation-history/:ideaSlug/score-changes - Get all score changes with reasons
router.get(
  "/:ideaSlug/score-changes",
  asyncHandler(async (req, res) => {
    const { ideaSlug } = req.params;

    await reloadDb();

    const idea = await getOne<{ id: string }>(
      "SELECT id FROM ideas WHERE slug = ?",
      [ideaSlug],
    );

    if (!idea) {
      respondError(res, 404, `Idea not found: ${ideaSlug}`);
      return;
    }

    const changes = await query<{
      id: number;
      session_id: string;
      criterion: string;
      score_before: number | null;
      score_after: number;
      adjustment: number;
      reason: string | null;
      created_at: string;
    }>(
      `SELECT id, session_id, criterion, score_before, score_after, adjustment, reason, created_at
       FROM score_history
       WHERE idea_id = ?
       ORDER BY created_at DESC`,
      [idea.id],
    );

    // Group by criterion for analysis
    const byCriterion: Record<
      string,
      { total_adjustment: number; change_count: number }
    > = {};
    for (const change of changes) {
      if (!byCriterion[change.criterion]) {
        byCriterion[change.criterion] = {
          total_adjustment: 0,
          change_count: 0,
        };
      }
      byCriterion[change.criterion].total_adjustment += change.adjustment;
      byCriterion[change.criterion].change_count += 1;
    }

    respond(res, {
      idea_slug: ideaSlug,
      total_changes: changes.length,
      changes,
      summary_by_criterion: byCriterion,
    });
  }),
);

export default router;
