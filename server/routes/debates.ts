/**
 * Debates Routes
 * Routes for debate management and viewing
 */
import { Router } from 'express';
import { asyncHandler, respond } from './shared.js';
import { query, getOne, reloadDb } from '../../database/db.js';
import { getActiveRooms, getClientCount } from '../websocket.js';

const router = Router();

// GET /api/debate/active - Get active debate rooms
router.get('/debate/active', asyncHandler(async (_req, res) => {
  const rooms = getActiveRooms();
  const roomInfo = rooms.map((slug) => ({
    slug,
    clients: getClientCount(slug),
  }));
  respond(res, roomInfo);
}));

// GET /api/debate/:slug/status - Get debate status for an idea
router.get('/debate/:slug/status', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const clients = getClientCount(slug);
  respond(res, {
    slug,
    clients,
    isActive: clients > 0,
  });
}));

// GET /api/debates - Get all debate sessions (including evaluation-only sessions)
router.get('/debates', asyncHandler(async (_req, res) => {
  // Reload database from disk to ensure we have the latest data
  // (sql.js uses in-memory DB which doesn't see changes from other processes)
  await reloadDb();

  // First, get sessions from evaluation_events table (captures all evaluation runs)
  const eventSessions = await query<{
    session_id: string;
    idea_id: string;
    started_at: string;
    latest_at: string;
  }>(
    `SELECT
      session_id,
      idea_id,
      MIN(created_at) as started_at,
      MAX(created_at) as latest_at
    FROM evaluation_events
    GROUP BY session_id, idea_id`
  );

  // Also get sessions from debate_rounds that might not be in evaluation_events
  const debateOnlySessions = await query<{
    session_id: string;
    idea_id: string;
    started_at: string;
    latest_at: string;
  }>(
    `SELECT
      evaluation_run_id as session_id,
      idea_id,
      MIN(timestamp) as started_at,
      MAX(timestamp) as latest_at
    FROM debate_rounds
    WHERE evaluation_run_id NOT IN (SELECT DISTINCT session_id FROM evaluation_events)
    GROUP BY evaluation_run_id, idea_id`
  );

  // Combine both sources
  const allSessions = [...eventSessions, ...debateOnlySessions];

  // Build a comprehensive list of sessions
  const sessions = await Promise.all(
    allSessions.map(async (es) => {
      // Get idea info
      const idea = await getOne<{ slug: string; title: string }>(
        'SELECT slug, title FROM ideas WHERE id = ?',
        [es.idea_id]
      );

      if (!idea) return null;

      // Get debate round counts for this session
      const roundInfo = await getOne<{ round_count: number; criterion_count: number; max_round_number: number }>(
        `SELECT
          COUNT(*) as round_count,
          COUNT(DISTINCT criterion) as criterion_count,
          MAX(round_number) as max_round_number
        FROM debate_rounds
        WHERE evaluation_run_id = ?`,
        [es.session_id]
      );

      // Get configured debate rounds from evaluation:config event (if stored)
      const configEvent = await getOne<{ event_data: string }>(
        `SELECT event_data FROM evaluation_events
         WHERE session_id = ? AND event_type = 'evaluation:config' LIMIT 1`,
        [es.session_id]
      );
      // Use max round_number as the debate rounds setting (round_number = debate rounds, challenge_number = challenges per criterion)
      let configuredRounds = roundInfo?.max_round_number || 1;
      if (configEvent) {
        try {
          const config = JSON.parse(configEvent.event_data);
          configuredRounds = config.debateRounds || configuredRounds;
        } catch { /* ignore parse errors */ }
      }

      // Check if synthesis exists (indicates completion)
      const synthesis = await getOne<{ id: number }>(
        'SELECT id FROM final_syntheses WHERE evaluation_run_id = ?',
        [es.session_id]
      );

      // Check if there are debate events but no debate_rounds (indicates data loss)
      const debateEvents = await getOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM evaluation_events
         WHERE session_id = ? AND event_type = 'arbiter:verdict'`,
        [es.session_id]
      );
      const hasDebateEvents = (debateEvents?.count || 0) > 0;
      const hasDebateRounds = (roundInfo?.round_count || 0) > 0;

      // Determine status based on what data exists
      let status: 'complete' | 'in-progress' | 'evaluation-only' | 'data-loss';
      if (synthesis && hasDebateRounds) {
        status = 'complete';
      } else if (hasDebateRounds) {
        status = 'in-progress';
      } else if (hasDebateEvents && !hasDebateRounds) {
        // Events exist but rounds weren't saved - indicates data loss
        status = 'data-loss';
      } else {
        status = 'evaluation-only';
      }

      return {
        evaluation_run_id: es.session_id,
        idea_id: es.idea_id,
        idea_slug: idea.slug,
        idea_title: idea.title,
        round_count: roundInfo?.round_count || 0,
        criterion_count: roundInfo?.criterion_count || 0,
        rounds_per_criterion: configuredRounds,
        started_at: es.started_at,
        latest_at: es.latest_at,
        status
      };
    })
  );

  // Filter out nulls and sort by latest_at descending
  const validSessions = sessions
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => new Date(b.latest_at).getTime() - new Date(a.latest_at).getTime());

  respond(res, validSessions);
}));

// GET /api/debates/:runId - Get a specific debate session
router.get('/debates/:runId', asyncHandler(async (req, res) => {
  const { runId } = req.params;

  // Reload database from disk to ensure we have the latest data
  await reloadDb();

  // First try to get session from debate_rounds (for sessions with debate data)
  let session = await getOne<{
    evaluation_run_id: string;
    idea_id: string;
    idea_slug: string;
    idea_title: string;
  }>(
    `SELECT
      d.evaluation_run_id,
      d.idea_id,
      i.slug as idea_slug,
      i.title as idea_title
    FROM debate_rounds d
    JOIN ideas i ON d.idea_id = i.id
    WHERE d.evaluation_run_id = ?
    LIMIT 1`,
    [runId]
  );

  // If not found in debate_rounds, check evaluation_events (for evaluation-only sessions)
  if (!session) {
    const evalSession = await getOne<{
      session_id: string;
      idea_id: string;
    }>(
      `SELECT session_id, idea_id FROM evaluation_events WHERE session_id = ? LIMIT 1`,
      [runId]
    );

    if (evalSession) {
      const idea = await getOne<{ slug: string; title: string }>(
        'SELECT slug, title FROM ideas WHERE id = ?',
        [evalSession.idea_id]
      );

      if (idea) {
        session = {
          evaluation_run_id: evalSession.session_id,
          idea_id: evalSession.idea_id,
          idea_slug: idea.slug,
          idea_title: idea.title,
        };
      }
    }
  }

  if (!session) {
    res.status(404).json({ success: false, error: 'Debate session not found' });
    return;
  }

  // Get all rounds for this session
  const rounds = await query<{
    id: number;
    round_number: number;
    criterion: string;
    challenge_number: number;
    evaluator_claim: string | null;
    redteam_persona: string | null;
    redteam_challenge: string | null;
    evaluator_defense: string | null;
    arbiter_verdict: string | null;
    first_principles_bonus: boolean;
    score_adjustment: number;
    timestamp: string;
  }>(
    `SELECT * FROM debate_rounds
     WHERE evaluation_run_id = ?
     ORDER BY criterion, round_number, challenge_number`,
    [runId]
  );

  // Get red team challenges for this session
  const redteamChallenges = await query(
    `SELECT * FROM redteam_log
     WHERE evaluation_run_id = ?
     ORDER BY logged_at`,
    [runId]
  );

  // Get synthesis if available
  const synthesis = await getOne<{
    overall_score: number;
    recommendation: string;
    executive_summary: string;
    key_strengths: string;
    key_weaknesses: string;
  }>(
    `SELECT overall_score, recommendation, executive_summary, key_strengths, key_weaknesses
     FROM final_syntheses
     WHERE evaluation_run_id = ?
     ORDER BY completed_at DESC LIMIT 1`,
    [runId]
  );

  // Recalculate overall_score from actual evaluations (synthesis table may have stale/wrong values)
  let recalculatedScore = synthesis?.overall_score || 0;
  if (synthesis) {
    const categoryWeightsForRecalc: Record<string, number> = {
      problem: 0.20,
      solution: 0.20,
      feasibility: 0.15,
      fit: 0.15,
      market: 0.15,
      risk: 0.15
    };
    // First principles: final_score is now correctly updated after debate
    const categoryScoresForRecalc = await query<{ category: string; avg_score: number }>(
      `SELECT category, AVG(final_score) as avg_score
       FROM evaluations
       WHERE evaluation_run_id = ?
       GROUP BY category`,
      [runId]
    );
    if (categoryScoresForRecalc.length > 0) {
      recalculatedScore = 0;
      for (const cat of categoryScoresForRecalc) {
        const weight = categoryWeightsForRecalc[cat.category] || 0;
        recalculatedScore += cat.avg_score * weight;
      }
      recalculatedScore = Math.round(recalculatedScore * 100) / 100;
    }
  }

  // Recalculate recommendation based on score (fixes stale recommendations)
  function getRecommendationFromScoreForDebate(score: number): string {
    if (score >= 7.0) return 'PURSUE';
    if (score >= 5.0) return 'REFINE';
    if (score >= 4.0) return 'PAUSE';
    return 'ABANDON';
  }
  const recalculatedRecommendation = synthesis
    ? getRecommendationFromScoreForDebate(recalculatedScore)
    : null;

  // Get API call count from the latest budget:status event
  const budgetEvent = await getOne<{ event_data: string }>(
    `SELECT event_data FROM evaluation_events
     WHERE session_id = ? AND event_type = 'budget:status'
     ORDER BY created_at DESC LIMIT 1`,
    [runId]
  );
  let apiCalls: number | undefined;
  if (budgetEvent) {
    try {
      const eventData = JSON.parse(budgetEvent.event_data);
      apiCalls = eventData.apiCalls;
    } catch {
      // Ignore parse errors
    }
  }

  // Get session start time from evaluation_events
  const startEvent = await getOne<{ started_at: string }>(
    `SELECT MIN(created_at) as started_at FROM evaluation_events WHERE session_id = ?`,
    [runId]
  );

  // Get configured debate rounds from evaluation:config event (if stored)
  const configEvent = await getOne<{ event_data: string }>(
    `SELECT event_data FROM evaluation_events
     WHERE session_id = ? AND event_type = 'evaluation:config' LIMIT 1`,
    [runId]
  );
  // Calculate max round_number from actual data (round_number = debate rounds setting, challenge_number = challenges per criterion)
  const maxRoundNumber = rounds.length > 0 ? Math.max(...rounds.map(r => r.round_number)) : 1;
  let roundsPerCriterion = maxRoundNumber;
  if (configEvent) {
    try {
      const config = JSON.parse(configEvent.event_data);
      roundsPerCriterion = config.debateRounds || roundsPerCriterion;
    } catch { /* ignore parse errors */ }
  }

  // Check if there are debate events but no debate_rounds (indicates data loss)
  const debateEventsForStatus = await getOne<{ count: number }>(
    `SELECT COUNT(*) as count FROM evaluation_events
     WHERE session_id = ? AND event_type = 'arbiter:verdict'`,
    [runId]
  );
  const hasDebateEvents = (debateEventsForStatus?.count || 0) > 0;
  const hasDebateRounds = rounds.length > 0;

  // Determine status
  let status: 'complete' | 'in-progress' | 'evaluation-only' | 'data-loss';
  if (synthesis && hasDebateRounds) {
    status = 'complete';
  } else if (hasDebateRounds) {
    status = 'in-progress';
  } else if (hasDebateEvents && !hasDebateRounds) {
    status = 'data-loss';
  } else {
    status = 'evaluation-only';
  }

  respond(res, {
    ...session,
    started_at: startEvent?.started_at || new Date().toISOString(),
    round_count: rounds.length,
    criterion_count: new Set(rounds.map(r => r.criterion)).size,
    rounds_per_criterion: roundsPerCriterion,
    rounds,
    redteamChallenges,
    apiCalls,
    status,
    synthesis: synthesis
      ? {
          ...synthesis,
          overall_score: recalculatedScore, // Use recalculated score from evaluations table
          recommendation: recalculatedRecommendation, // Use recalculated recommendation
          key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
          key_weaknesses: JSON.parse(synthesis.key_weaknesses || '[]'),
        }
      : null,
  });
}));

export default router;
