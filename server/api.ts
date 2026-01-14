import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { spawn } from 'child_process';
import { query, getOne, saveDb } from '../database/db.js';
import { initWebSocket, getClientCount, emitDebateEvent } from './websocket.js';
import {
  getRelevantQuestions,
  getQuestionById,
  getQuestionStats,
  populateQuestionBank
} from '../questions/loader.js';
import {
  getAnswersForIdea,
  saveAnswer,
  deleteAnswer,
  calculateReadiness,
  calculateCriterionCoverage,
  startDevelopmentSession,
  completeDevelopmentSession,
  getSessionHistory,
  selectNextQuestions,
  getNextQuestionsAfterAnswer,
  getQuestionsForCriterion,
  getBalancedQuestions
} from '../questions/readiness.js';
import {
  generatePreliminaryChallenges,
  generatePreliminarySynthesis
} from '../questions/preliminary-analysis.js';
import type {
  IdeaTypeFilter,
  LifecycleStageFilter,
  QuestionPriority
} from '../questions/types.js';
import {
  getVersionHistory,
  getVersionSnapshot,
  compareVersions,
  createVersionSnapshot
} from '../utils/versioning.js';
import {
  updateIdeaStatus,
  getStatusHistory
} from '../utils/status.js';
import {
  createBranch,
  getLineage
} from '../utils/lineage.js';
import {
  getIterationHistory
} from '../agents/iteration.js';
import {
  generateProactiveSuggestions
} from '../agents/gap-suggestion.js';
import {
  runDifferentiationAnalysis
} from '../agents/differentiation.js';
import {
  runPositioningAnalysis
} from '../agents/positioning.js';
import {
  validateDifferentiationAnalysis
} from '../agents/differentiation-validator.js';
import {
  generateUpdateSuggestions
} from '../agents/update-generator.js';
import { CostTracker } from '../utils/cost-tracker.js';
import type { IdeaStatus, IdeaContext, ProfileContext, StrategicApproach, IdeaFinancialAllocation } from '../types/incubation.js';
import { ideationRouter } from './routes/ideation.js';
import { splitIdeationRouter } from './routes/ideation/index.js';
import buildsRouter from './routes/builds.js';
import statsRouter from './routes/stats.js';
import { apiCounter } from './middleware/api-counter.js';
import { apiRateLimiter, strictRateLimiter, ideationRateLimiter, searchRateLimiter } from './middleware/rate-limiter.js';
import systemRouter from './routes/system.js';
import ideasRouter from './routes/ideas.js';
import profilesRouter from './routes/profiles.js';
import debatesRouter from './routes/debates.js';
import exportImportRouter from './routes/export-import.js';
import profileRouter from './routes/profile.js';
import notificationsRouter from './routes/notifications.js';
import validationRouter from './routes/validation.js';
import siaRouter from './routes/sia.js';
import agentsRouter from './routes/agents.js';
import tasksRouter from './routes/tasks.js';
import taskListsRouter from './routes/task-lists.js';
import executorRouter from './routes/executor.js';
import taskAssignmentRouter from './routes/task-assignment.js';
import questionsRouter, { startExpiryChecker } from './routes/questions.js';
import taskAgentRouter from './routes/task-agent.js';
import { initNotificationSystem } from './notifications/index.js';
import { getCommunicationHub } from './communication/communication-hub.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Static files for avatars
app.use('/assets', express.static('assets'));

// API call counter middleware - must be before routes
app.use('/api', apiCounter);

// Rate limiting middleware (SEC-004)
app.use('/api', apiRateLimiter);

// Mount split ideation routes FIRST (session + artifact routes)
// These take precedence over the legacy routes in ideation.ts
app.use('/api/ideation', splitIdeationRouter);

// Mount main ideation routes (message handling, actions)
app.use('/api/ideation', ideationRouter);

// Mount build agent routes
app.use('/api/builds', buildsRouter);

// Mount stats routes
app.use('/api/stats', statsRouter);

// Mount system routes (db/reload, stats)
app.use('/api', systemRouter);

// Mount ideas routes (CRUD)
app.use('/api/ideas', ideasRouter);

// Mount profiles routes (evaluator profiles)
app.use('/api/profiles', profilesRouter);

// Mount user profile routes (authenticated user settings)
app.use('/api/profile', profileRouter);

// Mount debates routes
app.use('/api', debatesRouter);

// Mount export/import routes
app.use('/api', exportImportRouter);

// Mount notification routes
app.use('/api/notifications', notificationsRouter);

// Mount validation routes
app.use('/api/validation', validationRouter);

// Mount SIA routes
app.use('/api/sia', siaRouter);

// Mount agent monitoring routes
app.use('/api/agents', agentsRouter);

// Mount task management routes
app.use('/api/tasks', tasksRouter);

// Mount task list (markdown file) management routes
app.use('/api/task-lists', taskListsRouter);

// Mount task executor (autonomous execution) routes
app.use('/api/executor', executorRouter);

// Mount task assignment (agent work queue) routes
app.use('/api/task-assignment', taskAssignmentRouter);

// Mount questions (blocking questions, answers) routes
app.use('/api/questions', questionsRouter);

// Mount task agent (parallel execution, evaluation queue) routes
app.use('/api/task-agent', taskAgentRouter);

// Initialize notification system
initNotificationSystem();

// Types
interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

// Helper to wrap async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Response helper
function respond<T>(res: Response, data: T): void {
  res.json({ success: true, data } as ApiResponse<T>);
}

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message } as ApiResponse<null>);
});

// ==================== ROUTES ====================

// GET /api/ideas/:slug/evaluations - Get evaluations for an idea
app.get('/api/ideas/:slug/evaluations', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = 'SELECT * FROM evaluations WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (runId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(runId as string);
  } else {
    // Get latest run
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    if (latestRun) {
      sql += ' AND evaluation_run_id = ?';
      params.push(latestRun.evaluation_run_id);
    }
  }

  const evaluations = await query(sql, params);
  respond(res, evaluations);
}));

// GET /api/ideas/:slug/category-scores - Get category scores
app.get('/api/ideas/:slug/category-scores', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Determine run_id
  let targetRunId = runId as string;
  if (!targetRunId) {
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    targetRunId = latestRun?.evaluation_run_id || '';
  }

  if (!targetRunId) {
    respond(res, []);
    return;
  }

  // Get all evaluations for this run
  // First principles: final_score is now correctly updated after debate
  // (via saveDebateResults in evaluate.ts and migration 015)
  // No need for complex JOIN - just use the stored values directly
  const evaluations = await query<{
    category: string;
    criterion: string;
    initial_score: number;
    final_score: number;
    confidence: number;
    reasoning: string;
  }>(
    `SELECT
       e.category,
       e.criterion,
       COALESCE(e.initial_score, e.final_score) as initial_score,
       e.final_score,
       e.confidence,
       e.reasoning
     FROM evaluations e
     WHERE e.idea_id = ? AND e.evaluation_run_id = ?
     ORDER BY e.category, e.criterion`,
    [idea.id, targetRunId]
  );

  // Group by category and calculate averages
  // final_score = post-debate score (already clamped to [1,10])
  // initial_score = pre-debate score (for before/after display)
  const categoryMap = new Map<string, {
    scores: number[];
    initialScores: number[];
    confidences: number[];
    criteria: typeof evaluations;
  }>();

  for (const eval_ of evaluations) {
    if (!categoryMap.has(eval_.category)) {
      categoryMap.set(eval_.category, { scores: [], initialScores: [], confidences: [], criteria: [] });
    }
    const cat = categoryMap.get(eval_.category)!;
    // Use final_score which is the correct post-debate score
    cat.scores.push(eval_.final_score);
    // Track initial score for before/after comparison
    cat.initialScores.push(eval_.initial_score);
    cat.confidences.push(eval_.confidence);
    cat.criteria.push(eval_);
  }

  const categoryScores = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    avg_score: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
    avg_initial_score: data.initialScores.reduce((a, b) => a + b, 0) / data.initialScores.length,
    avg_confidence: data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length,
    criteria: data.criteria,
  }));

  respond(res, categoryScores);
}));

// GET /api/ideas/:slug/evaluation-runs - Get all evaluation runs for an idea
app.get('/api/ideas/:slug/evaluation-runs', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const runs = await query<{ evaluation_run_id: string }>(
    'SELECT DISTINCT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC',
    [idea.id]
  );

  respond(res, runs.map((r) => r.evaluation_run_id));
}));

// GET /api/ideas/:slug/debates - Get debate rounds
app.get('/api/ideas/:slug/debates', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Default to latest evaluation run if no runId provided
  let targetRunId = runId as string;
  if (!targetRunId) {
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    targetRunId = latestRun?.evaluation_run_id || '';
  }

  let sql = 'SELECT * FROM debate_rounds WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (targetRunId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(targetRunId);
  }

  sql += ' ORDER BY round_number';

  const rounds = await query(sql, params);
  respond(res, rounds);
}));

// GET /api/ideas/:slug/redteam - Get red team challenges
app.get('/api/ideas/:slug/redteam', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Default to latest evaluation run if no runId provided
  let targetRunId = runId as string;
  if (!targetRunId) {
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    targetRunId = latestRun?.evaluation_run_id || '';
  }

  let sql = 'SELECT * FROM redteam_log WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (targetRunId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(targetRunId);
  }

  sql += ' ORDER BY logged_at';

  const challenges = await query(sql, params);

  // If no evaluation challenges exist, generate preliminary analysis
  if (challenges.length === 0) {
    const preliminaryChallenges = await generatePreliminaryChallenges(idea.id);
    respond(res, preliminaryChallenges.map(c => ({
      ...c,
      is_preliminary: true
    })));
    return;
  }

  respond(res, challenges);
}));

// GET /api/ideas/:slug/synthesis - Get final synthesis
app.get('/api/ideas/:slug/synthesis', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { runId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Default to latest EVALUATION run if no runId provided
  // This ensures synthesis matches the evaluation data shown elsewhere
  let targetRunId = runId as string;
  if (!targetRunId) {
    const latestRun = await getOne<{ evaluation_run_id: string }>(
      'SELECT evaluation_run_id FROM evaluations WHERE idea_id = ? ORDER BY evaluated_at DESC LIMIT 1',
      [idea.id]
    );
    targetRunId = latestRun?.evaluation_run_id || '';
  }

  let sql = 'SELECT * FROM final_syntheses WHERE idea_id = ?';
  const params: (string | number)[] = [idea.id];

  if (targetRunId) {
    sql += ' AND evaluation_run_id = ?';
    params.push(targetRunId);
  }

  sql += ' ORDER BY completed_at DESC LIMIT 1';

  const synthesis = await getOne<{
    key_strengths: string;
    key_weaknesses: string;
    critical_assumptions: string;
    unresolved_questions: string;
    [key: string]: unknown;
  }>(sql, params);

  if (synthesis) {
    // Recalculate overall_score from actual evaluations for this run
    // This fixes data integrity issues where synthesis was saved with wrong scores
    const categoryWeights: Record<string, number> = {
      problem: 0.20,
      solution: 0.20,
      feasibility: 0.15,
      fit: 0.15,
      market: 0.15,
      risk: 0.15
    };

    // First principles: final_score is now correctly updated after debate
    // (via saveDebateResults in evaluate.ts and migration 015)
    const categoryScores = await query<{ category: string; avg_score: number; avg_confidence: number }>(
      `SELECT category, AVG(final_score) as avg_score, AVG(confidence) as avg_confidence
       FROM evaluations
       WHERE idea_id = ? AND evaluation_run_id = ?
       GROUP BY category`,
      [idea.id, targetRunId]
    );

    let recalculatedScore = 0;
    let recalculatedConfidence = 0;
    let totalWeight = 0;

    for (const cat of categoryScores) {
      const weight = categoryWeights[cat.category] || 0;
      recalculatedScore += cat.avg_score * weight;
      recalculatedConfidence += (cat.avg_confidence || 0.5) * weight;
      totalWeight += weight;
    }

    // Normalize if not all categories present
    if (totalWeight > 0 && totalWeight < 1) {
      recalculatedScore = recalculatedScore / totalWeight;
      recalculatedConfidence = recalculatedConfidence / totalWeight;
    }

    // Round to 2 decimal places
    recalculatedScore = Math.round(recalculatedScore * 100) / 100;

    // Recalculate recommendation based on score (fixes stale recommendations)
    function getRecommendationFromScore(score: number): string {
      if (score >= 7.0) return 'PURSUE';
      if (score >= 5.0) return 'REFINE';
      if (score >= 4.0) return 'PAUSE';
      return 'ABANDON';
    }
    const recalculatedRecommendation = getRecommendationFromScore(recalculatedScore);

    // Get actual weak criteria from evaluations (final_score < 6)
    // final_score is now correctly updated after debate
    const weakEvaluations = await query<{ criterion: string; final_score: number }>(
      `SELECT criterion, final_score FROM evaluations
       WHERE idea_id = ? AND evaluation_run_id = ? AND final_score < 6
       ORDER BY final_score ASC`,
      [idea.id, targetRunId]
    );

    const recalculatedWeaknesses = weakEvaluations.map(e =>
      `${e.criterion.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}: Weak (${e.final_score}/10)`
    );

    // Parse JSON arrays from stored synthesis
    respond(res, {
      ...synthesis,
      // Use recalculated values instead of stored ones
      overall_score: recalculatedScore,
      overall_confidence: Math.round(recalculatedConfidence * 100) / 100,
      confidence: Math.round(recalculatedConfidence * 100) / 100, // Frontend uses 'confidence' field
      recommendation: recalculatedRecommendation, // Override stored recommendation
      key_strengths: JSON.parse(synthesis.key_strengths || '[]'),
      key_weaknesses: recalculatedWeaknesses.length > 0
        ? recalculatedWeaknesses
        : JSON.parse(synthesis.key_weaknesses || '[]'),
      critical_assumptions: JSON.parse(synthesis.critical_assumptions || '[]'),
      unresolved_questions: JSON.parse(synthesis.unresolved_questions || '[]'),
      is_preliminary: false
    });
  } else {
    // Generate preliminary synthesis if no full evaluation exists for this run
    const preliminarySynthesis = await generatePreliminarySynthesis(idea.id);
    respond(res, preliminarySynthesis);
  }
}));

// GET /api/ideas/:slug/development - Get development log
app.get('/api/ideas/:slug/development', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const log = await query(
    'SELECT * FROM development_log WHERE idea_id = ? ORDER BY created_at',
    [idea.id]
  );
  respond(res, log);
}));

// GET /api/ideas/:slug/relationships - Get idea relationships
app.get('/api/ideas/:slug/relationships', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const relationships = await query(
    `SELECT ir.*, i.title as target_title, i.slug as target_slug
     FROM idea_relationships ir
     JOIN ideas i ON ir.target_idea_id = i.id
     WHERE ir.source_idea_id = ?`,
    [idea.id]
  );
  respond(res, relationships);
}));

// GET /api/ideas/:slug/costs - Get cost log
app.get('/api/ideas/:slug/costs', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const costs = await query(
    'SELECT * FROM cost_log WHERE idea_id = ? ORDER BY timestamp',
    [idea.id]
  );
  respond(res, costs);
}));

// GET /api/ideas/:slug/costs/total - Get total costs
app.get('/api/ideas/:slug/costs/total', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const total = await getOne<{ total: number }>(
    'SELECT SUM(estimated_cost) as total FROM cost_log WHERE idea_id = ?',
    [idea.id]
  );

  const byOperation = await query<{ operation: string; total: number }>(
    'SELECT operation, SUM(estimated_cost) as total FROM cost_log WHERE idea_id = ? GROUP BY operation',
    [idea.id]
  );

  respond(res, {
    total: total?.total || 0,
    byAgent: Object.fromEntries(byOperation.map((a) => [a.operation, a.total])),
  });
}));

// POST /api/ideas/:slug/evaluate - Trigger evaluation for an idea
app.post('/api/ideas/:slug/evaluate', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { budget = 15, mode = 'v2', skipDebate = false, unlimited = false, debateRounds = 1 } = req.body;

  // Check if idea exists
  const idea = await getOne<{ id: string; title: string }>('SELECT id, title FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Generate a run ID
  const runId = crypto.randomUUID();

  // Store configured debate_rounds in evaluation_events for later retrieval
  const rounds = Math.min(3, Math.max(1, Number(debateRounds) || 1));
  await query(
    `INSERT INTO evaluation_events (session_id, idea_id, event_type, event_data, created_at)
     VALUES (?, ?, 'evaluation:config', ?, ?)`,
    [runId, idea.id, JSON.stringify({ debateRounds: rounds, budget, mode, skipDebate, unlimited }), new Date().toISOString()]
  );

  // Emit start event to WebSocket
  emitDebateEvent('debate:started', slug, runId, {
    message: `Starting evaluation for: ${idea.title}`,
  });

  // Spawn the evaluation process in the background
  const args = ['scripts/evaluate.ts', slug, '--budget', String(budget), '--mode', mode, '--force', '--run-id', runId];
  if (skipDebate) {
    args.push('--skip-debate');
  }
  if (unlimited) {
    args.push('--unlimited');
  }
  // Add debate rounds (1-3, default 1) - rounds already calculated above
  args.push('--debate-rounds', String(rounds));

  console.log(`[Evaluate] Starting: npx tsx ${args.join(' ')}`);

  const child = spawn('npx', ['tsx', ...args], {
    cwd: process.cwd(),
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
    env: { ...process.env }, // Explicitly pass environment (includes ANTHROPIC_API_KEY)
  });

  // Log output for debugging
  child.stdout?.on('data', (data) => {
    console.log(`[Evaluate stdout] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data) => {
    console.error(`[Evaluate stderr] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error(`[Evaluate error] Failed to start: ${err.message}`);
    emitDebateEvent('error', slug, runId, { error: err.message });
  });

  child.on('exit', (code, signal) => {
    if (code !== 0) {
      console.error(`[Evaluate] Exited with code ${code}, signal ${signal}`);
      emitDebateEvent('error', slug, runId, { error: `Evaluation process exited with code ${code}` });
    } else {
      console.log(`[Evaluate] Completed successfully`);
    }
  });

  // Don't wait for the child process
  child.unref();

  respond(res, {
    message: 'Evaluation started',
    runId,
    slug,
  });
}));

// POST /api/internal/broadcast - Internal endpoint for evaluation script to emit events
app.post('/api/internal/broadcast', asyncHandler(async (req, res) => {
  const { type, ideaSlug, runId, data } = req.body;

  if (!type || !ideaSlug || !runId) {
    res.status(400).json({ success: false, error: 'Missing required fields: type, ideaSlug, runId' });
    return;
  }

  // Get idea ID for database storage
  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [ideaSlug]);

  // Persist event to database for replay capability
  if (idea) {
    try {
      await query(
        `INSERT INTO evaluation_events (session_id, idea_id, event_type, event_data, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [runId, idea.id, type, JSON.stringify(data || {}), new Date().toISOString()]
      );
    } catch (err) {
      console.error('Failed to persist event:', err);
      // Don't fail the broadcast if persistence fails
    }
  }

  emitDebateEvent(type, ideaSlug, runId, data || {});
  respond(res, { success: true });
}));

// GET /api/ideas/:slug/events - Get evaluation events for replay
app.get('/api/ideas/:slug/events', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { sessionId } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  let sql = `
    SELECT session_id, event_type, event_data, created_at
    FROM evaluation_events
    WHERE idea_id = ?
  `;
  const params: (string | number)[] = [idea.id];

  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId as string);
  }

  sql += ' ORDER BY created_at ASC';

  const events = await query<{
    session_id: string;
    event_type: string;
    event_data: string;
    created_at: string;
  }>(sql, params);

  // Parse event_data JSON
  const parsedEvents = events.map(e => ({
    ...e,
    event_data: JSON.parse(e.event_data || '{}'),
  }));

  respond(res, parsedEvents);
}));

// GET /api/ideas/:slug/events/sessions - Get list of event sessions
app.get('/api/ideas/:slug/events/sessions', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const sessions = await query<{
    session_id: string;
    event_count: number;
    started_at: string;
    ended_at: string;
  }>(
    `SELECT
      session_id,
      COUNT(*) as event_count,
      MIN(created_at) as started_at,
      MAX(created_at) as ended_at
    FROM evaluation_events
    WHERE idea_id = ?
    GROUP BY session_id
    ORDER BY started_at DESC`,
    [idea.id]
  );

  respond(res, sessions);
}));

// GET /api/ideas/:slug/evaluate/status - Check if evaluation is in progress
app.get('/api/ideas/:slug/evaluate/status', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Check for recent evaluations (within last 10 minutes = in progress)
  const recentEval = await getOne<{ evaluation_run_id: string; evaluated_at: string }>(
    `SELECT evaluation_run_id, MAX(evaluated_at) as evaluated_at
     FROM evaluations
     WHERE idea_id = ?
     GROUP BY evaluation_run_id
     ORDER BY evaluated_at DESC
     LIMIT 1`,
    [idea.id]
  );

  // Check WebSocket connections (indicates active viewers)
  const activeClients = getClientCount(slug);

  respond(res, {
    hasEvaluations: !!recentEval,
    lastRunId: recentEval?.evaluation_run_id || null,
    lastEvaluatedAt: recentEval?.evaluated_at || null,
    activeViewers: activeClients,
  });
}));

// ==================== DYNAMIC QUESTIONING ENDPOINTS ====================

// GET /api/questions - Get all questions or filtered by type/stage
app.get('/api/questions', asyncHandler(async (req, res) => {
  const { ideaType, stage, category } = req.query;

  let questions = await getRelevantQuestions(
    ideaType as IdeaTypeFilter | null,
    stage as LifecycleStageFilter | null
  );

  // Filter by category if specified
  if (category) {
    questions = questions.filter(q => q.category === category);
  }

  respond(res, questions);
}));

// GET /api/questions/stats - Get question bank statistics
app.get('/api/questions/stats', asyncHandler(async (_req, res) => {
  const stats = await getQuestionStats();
  respond(res, stats);
}));

// POST /api/questions/populate - Populate question bank from YAML files
app.post('/api/questions/populate', asyncHandler(async (req, res) => {
  const { force = false } = req.body;
  const count = await populateQuestionBank(force);
  respond(res, { populated: count, message: `Populated ${count} questions` });
}));

// GET /api/questions/:id - Get single question by ID
app.get('/api/questions/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const question = await getQuestionById(id);

  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  respond(res, question);
}));

// GET /api/ideas/:slug/questions - Get next questions for an idea
app.get('/api/ideas/:slug/questions', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { limit = 5 } = req.query;

  // Get idea
  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get relevant questions for this idea type and stage
  const allQuestions = await getRelevantQuestions(
    idea.idea_type as IdeaTypeFilter | null,
    idea.lifecycle_stage as LifecycleStageFilter | null
  );

  // Get existing answers
  const answers = await getAnswersForIdea(idea.id);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Filter to unanswered questions
  const unanswered = allQuestions.filter(q => !answeredIds.has(q.id));

  // Check dependencies - only show questions whose dependencies are satisfied
  const eligible = unanswered.filter(q => {
    if (!q.depends_on || q.depends_on.length === 0) return true;
    return q.depends_on.every(depId => answeredIds.has(depId));
  });

  // Sort by priority (critical first)
  const sorted = eligible.sort((a, b) => {
    const priorityOrder: Record<QuestionPriority, number> = {
      'critical': 0,
      'important': 1,
      'nice-to-have': 2
    };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Limit results
  const questions = sorted.slice(0, parseInt(limit as string, 10));

  // Get readiness
  const readiness = await calculateReadiness(idea.id);

  // Get coverage
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, {
    questions,
    readiness,
    coverage,
    totalQuestions: allQuestions.length,
    answeredCount: answeredIds.size,
    answeredIds: Array.from(answeredIds),
    remainingCount: unanswered.length
  });
}));

// GET /api/ideas/:slug/questions/all - Get ALL questions grouped by category
app.get('/api/ideas/:slug/questions/all', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get idea
  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get all relevant questions for this idea type and stage
  const allQuestions = await getRelevantQuestions(
    idea.idea_type as IdeaTypeFilter | null,
    idea.lifecycle_stage as LifecycleStageFilter | null
  );

  // Get existing answers
  const answers = await getAnswersForIdea(idea.id);
  const answerMap = new Map(answers.map(a => [a.questionId, a.answer]));

  // Group questions by category
  const categories = ['problem', 'solution', 'feasibility', 'fit', 'market', 'risk', 'business_model'] as const;
  const grouped: Record<string, Array<{
    id: string;
    text: string;
    criterion: string;
    category: string;
    priority: string;
    answered: boolean;
    answer?: string;
  }>> = {};

  for (const cat of categories) {
    grouped[cat] = [];
  }

  for (const q of allQuestions) {
    const isAnswered = answerMap.has(q.id);
    const questionData = {
      id: q.id,
      text: q.text,
      criterion: q.criterion,
      category: q.category,
      priority: q.priority,
      answered: isAnswered,
      answer: isAnswered ? answerMap.get(q.id) : undefined
    };

    if (grouped[q.category]) {
      grouped[q.category].push(questionData);
    }
  }

  // Sort each category by priority
  const priorityOrder: Record<string, number> = {
    'critical': 0,
    'important': 1,
    'nice-to-have': 2
  };

  for (const cat of categories) {
    grouped[cat].sort((a, b) =>
      (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99)
    );
  }

  respond(res, {
    grouped,
    totalQuestions: allQuestions.length,
    answeredCount: answerMap.size
  });
}));

// GET /api/ideas/:slug/answers - Get all answers for an idea
app.get('/api/ideas/:slug/answers', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const answers = await getAnswersForIdea(idea.id);

  // Enrich with question data
  const enrichedAnswers = await Promise.all(
    answers.map(async (answer) => {
      const question = await getQuestionById(answer.questionId);
      return {
        ...answer,
        question
      };
    })
  );

  // Get coverage
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, { answers: enrichedAnswers, coverage });
}));

// POST /api/ideas/:slug/answers - Submit an answer to a question
app.post('/api/ideas/:slug/answers', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { questionId, answer, source = 'user', confidence = 1.0 } = req.body;

  if (!questionId || !answer) {
    res.status(400).json({ success: false, error: 'questionId and answer are required' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Verify question exists
  const question = await getQuestionById(questionId);
  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  // Save answer
  const savedAnswer = await saveAnswer(
    idea.id,
    questionId,
    answer,
    source as 'user' | 'ai_extracted' | 'ai_inferred',
    confidence
  );

  // Get updated readiness
  const readiness = await calculateReadiness(idea.id);

  // Get next questions using smart selection algorithm
  const nextQuestions = await getNextQuestionsAfterAnswer(idea.id, questionId, 3);

  respond(res, {
    answer: savedAnswer,
    readiness,
    nextQuestions
  });
}));

// DELETE /api/ideas/:slug/answers/:questionId - Delete an answer
app.delete('/api/ideas/:slug/answers/:questionId', asyncHandler(async (req, res) => {
  const { slug, questionId } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await deleteAnswer(idea.id, questionId);

  // Get updated readiness
  const readiness = await calculateReadiness(idea.id);

  respond(res, { success: true, readiness });
}));

// GET /api/ideas/:slug/readiness - Get readiness assessment
app.get('/api/ideas/:slug/readiness', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const readiness = await calculateReadiness(idea.id);
  const coverage = await calculateCriterionCoverage(idea.id);

  respond(res, {
    ...readiness,
    coverage
  });
}));

// POST /api/ideas/:slug/develop - Start or continue a development session
app.post('/api/ideas/:slug/develop', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { mode = 'start', sessionId } = req.body;

  const idea = await getOne<{
    id: string;
    idea_type: string;
    lifecycle_stage: string;
  }>('SELECT id, idea_type, lifecycle_stage FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  if (mode === 'start') {
    // Start new session
    const session = await startDevelopmentSession(idea.id);

    // Get initial questions using balanced selection across categories
    let questions = await getBalancedQuestions(idea.id, 2);

    // If no questions found (all have unmet dependencies), try with skipDependencies
    if (questions.length === 0) {
      questions = await getBalancedQuestions(idea.id, 2, true);
    }

    respond(res, { session, questions });
  } else if (mode === 'complete' && sessionId) {
    // Complete session
    const session = await completeDevelopmentSession(sessionId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    respond(res, { session });
  } else {
    res.status(400).json({ success: false, error: 'Invalid mode or missing sessionId' });
  }
}));

// GET /api/ideas/:slug/readiness/coverage - Get criterion coverage
app.get('/api/ideas/:slug/readiness/coverage', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const coverage = await calculateCriterionCoverage(idea.id);
  respond(res, coverage);
}));

// GET /api/ideas/:slug/develop - Get active development session
app.get('/api/ideas/:slug/develop', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get active (incomplete) session
  const session = await getOne<{
    id: string;
    idea_id: string;
    started_at: string;
    completed_at: string | null;
    questions_asked: number;
    questions_answered: number;
    readiness_before: number;
    readiness_after: number | null;
  }>(`SELECT * FROM development_sessions
      WHERE idea_id = ? AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1`, [idea.id]);

  if (!session) {
    respond(res, null);
    return;
  }

  respond(res, {
    id: session.id,
    ideaId: session.idea_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    questionsAsked: session.questions_asked,
    questionsAnswered: session.questions_answered,
    readinessBefore: session.readiness_before,
    readinessAfter: session.readiness_after
  });
}));

// GET /api/ideas/:slug/develop/history - Get development session history
app.get('/api/ideas/:slug/develop/history', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const sessions = await getSessionHistory(idea.id);
  respond(res, sessions);
}));

// GET /api/ideas/:slug/questions/smart - Get smart-selected questions
app.get('/api/ideas/:slug/questions/smart', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { category, criterion, limit, skipDependencies } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const questions = await selectNextQuestions(idea.id, {
    focusCategory: category as 'problem' | 'solution' | 'feasibility' | 'fit' | 'market' | 'risk' | 'business_model' | undefined,
    focusCriterion: criterion as string | undefined,
    limit: limit ? parseInt(limit as string, 10) : 5,
    skipDependencies: skipDependencies === 'true'
  });

  respond(res, questions);
}));

// GET /api/ideas/:slug/questions/criterion/:criterion - Get questions for a specific criterion
app.get('/api/ideas/:slug/questions/criterion/:criterion', asyncHandler(async (req, res) => {
  const { slug, criterion } = req.params;
  const { limit } = req.query;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const questions = await getQuestionsForCriterion(
    idea.id,
    criterion,
    limit ? parseInt(limit as string, 10) : 5
  );

  respond(res, questions);
}));

// POST /api/ideas/:slug/questions/:questionId/suggestions - Get AI suggestions for a question
app.post('/api/ideas/:slug/questions/:questionId/suggestions', asyncHandler(async (req, res) => {
  const { slug, questionId } = req.params;
  const fs = await import('fs/promises');
  const path = await import('path');

  // Get idea
  const idea = await getOne<{ id: string; folder_path: string }>('SELECT id, folder_path FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get the question
  const question = await getQuestionById(questionId);
  if (!question) {
    res.status(404).json({ success: false, error: 'Question not found' });
    return;
  }

  // Read idea content from file
  let content = '';
  try {
    const readmePath = path.join(idea.folder_path, 'README.md');
    content = await fs.readFile(readmePath, 'utf-8');
  } catch {
    // Content not available - continue with empty string
  }

  // Get existing answers for context
  const answers = await getAnswersForIdea(idea.id);
  const answerMap: Record<string, string> = {};
  for (const a of answers) {
    const q = await getQuestionById(a.questionId);
    if (q) {
      answerMap[q.text] = a.answer;
    }
  }

  // Build idea context
  const ideaContext: IdeaContext = {
    problem: content.match(/## Problem\s*\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim() || '',
    solution: content.match(/## Solution\s*\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim() || '',
    targetUser: content.match(/## Target User\s*\n([\s\S]*?)(?=\n##|$)/)?.[1]?.trim() || '',
    currentAnswers: answerMap
  };

  // Get profile if linked
  let profileContext: ProfileContext = {};
  const linkedProfile = await getOne<{ profile_id: string }>(
    'SELECT profile_id FROM idea_profiles WHERE idea_id = ?',
    [idea.id]
  );

  if (linkedProfile) {
    const profile = await getOne<{
      primary_goals: string | null;
      technical_skills: string | null;
      industry_connections: string | null;
      risk_tolerance: string | null;
    }>(
      'SELECT primary_goals, technical_skills, industry_connections, risk_tolerance FROM user_profiles WHERE id = ?',
      [linkedProfile.profile_id]
    );
    if (profile) {
      profileContext = {
        goals: profile.primary_goals ? [profile.primary_goals] : [],
        skills: profile.technical_skills ? profile.technical_skills.split(',').map(s => s.trim()) : [],
        network: profile.industry_connections ? profile.industry_connections.split(',').map(s => s.trim()) : [],
        constraints: profile.risk_tolerance ? [profile.risk_tolerance] : []
      };
    }
  }

  // Generate suggestions
  const costTracker = new CostTracker();
  const suggestions = await generateProactiveSuggestions(
    question.text,
    ideaContext,
    profileContext,
    costTracker
  );

  respond(res, {
    suggestions,
    cost: costTracker.getEstimatedCost()
  });
}));

// GET /api/ideas/:slug/structured-data - Get structured answers for evaluation
app.get('/api/ideas/:slug/structured-data', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const answers = await getAnswersForIdea(idea.id);

  // Organize answers by criterion
  const structuredData: Record<string, Record<string, string>> = {};

  for (const answer of answers) {
    const question = await getQuestionById(answer.questionId);
    if (!question) continue;

    if (!structuredData[question.category]) {
      structuredData[question.category] = {};
    }

    // Use question ID as key (e.g., P1_CORE, S1_WHAT)
    structuredData[question.category][question.id] = answer.answer;
  }

  const readiness = await calculateReadiness(idea.id);

  respond(res, {
    structuredData,
    readiness,
    hasProfile: readiness.byCategory.fit >= 1.0
  });
}));

// GET /api/ideas/:slug/profile - Get profile linked to an idea
app.get('/api/ideas/:slug/profile', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get idea
  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get linked profile
  const profile = await getOne<{
    id: string;
    name: string;
    slug: string;
    primary_goals: string;
    success_definition: string | null;
    interests: string | null;
    technical_skills: string | null;
    professional_experience: string | null;
    domain_expertise: string | null;
    employment_status: string | null;
    weekly_hours_available: number | null;
    risk_tolerance: string | null;
    updated_at: string;
  }>(`
    SELECT p.* FROM user_profiles p
    JOIN idea_profiles ip ON p.id = ip.profile_id
    WHERE ip.idea_id = ?
  `, [idea.id]);

  respond(res, profile || null);
}));

// ==================== INCUBATION LIFECYCLE ROUTES ====================

// GET /api/ideas/:slug/versions - Get version history
app.get('/api/ideas/:slug/versions', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const versions = await getVersionHistory(idea.id);
  respond(res, versions);
}));

// GET /api/ideas/:slug/versions/:version - Get specific version
app.get('/api/ideas/:slug/versions/:version', asyncHandler(async (req, res) => {
  const { slug, version } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const versionData = await getVersionSnapshot(idea.id, parseInt(version, 10));
  if (!versionData) {
    res.status(404).json({ success: false, error: 'Version not found' });
    return;
  }

  respond(res, versionData);
}));

// GET /api/ideas/:slug/versions/compare/:v1/:v2 - Compare two versions
app.get('/api/ideas/:slug/versions/compare/:v1/:v2', asyncHandler(async (req, res) => {
  const { slug, v1, v2 } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const diff = await compareVersions(idea.id, parseInt(v1, 10), parseInt(v2, 10));
  respond(res, diff);
}));

// POST /api/ideas/:slug/snapshot - Create manual version snapshot
app.post('/api/ideas/:slug/snapshot', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { summary } = req.body;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const versionId = await createVersionSnapshot(idea.id, 'manual', summary || 'Manual snapshot');
  await saveDb();

  respond(res, { versionId });
}));

// GET /api/ideas/:slug/lineage - Get lineage tree
app.get('/api/ideas/:slug/lineage', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const lineage = await getLineage(idea.id);
  respond(res, lineage);
}));

// POST /api/ideas/:slug/branch - Create a branch from an idea
app.post('/api/ideas/:slug/branch', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { title, reason, parentAction = 'keep_active' } = req.body;

  if (!title || !reason) {
    res.status(400).json({ success: false, error: 'Title and reason are required' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const newSlug = await createBranch({
    parentIdeaId: idea.id,
    newTitle: title,
    branchReason: reason,
    parentAction
  });
  await saveDb();

  respond(res, { slug: newSlug });
}));

// GET /api/ideas/:slug/status-history - Get status history
app.get('/api/ideas/:slug/status-history', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const history = await getStatusHistory(idea.id);
  respond(res, history);
}));

// POST /api/ideas/:slug/status - Update idea status
app.post('/api/ideas/:slug/status', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { status, reason } = req.body;

  if (!status) {
    res.status(400).json({ success: false, error: 'Status is required' });
    return;
  }

  const idea = await getOne<{ id: string; status: string }>('SELECT id, status FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await updateIdeaStatus(idea.id, status as IdeaStatus, reason);
  await saveDb();

  respond(res, { previousStatus: idea.status, newStatus: status });
}));

// GET /api/ideas/:slug/iterations - Get iteration history
app.get('/api/ideas/:slug/iterations', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const iterations = await getIterationHistory(idea.id);
  respond(res, iterations);
}));

// GET /api/ideas/:slug/assumptions - Get assumptions
app.get('/api/ideas/:slug/assumptions', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const assumptions = await query<{
    id: string;
    assumption_text: string;
    category: string;
    risk_level: string;
    validated: number;
    validation_notes: string | null;
    created_at: string;
  }>('SELECT * FROM idea_assumptions WHERE idea_id = ? ORDER BY risk_level DESC, created_at DESC', [idea.id]);

  respond(res, assumptions.map(a => ({
    ...a,
    validated: Boolean(a.validated)
  })));
}));

// GET /api/ideas/:slug/gates - Get gate decisions
app.get('/api/ideas/:slug/gates', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const gates = await query<{
    id: string;
    gate_type: string;
    advisory_shown: string;
    user_choice: string;
    readiness_score: number | null;
    overall_score: number | null;
    decided_at: string;
  }>('SELECT * FROM gate_decisions WHERE idea_id = ? ORDER BY decided_at DESC', [idea.id]);

  respond(res, gates);
}));

// POST /api/ideas/:slug/gates - Record a gate decision
app.post('/api/ideas/:slug/gates', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { gateType, advisoryShown, userChoice, readinessScore, overallScore } = req.body;

  if (!gateType || !advisoryShown || !userChoice) {
    res.status(400).json({ success: false, error: 'gateType, advisoryShown, and userChoice are required' });
    return;
  }

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Build context JSON with scores
  const context = JSON.stringify({
    readinessScore: readinessScore ?? null,
    overallScore: overallScore ?? null
  });

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO gate_decisions (id, idea_id, gate_type, recommendation, user_choice, context)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, idea.id, gateType, advisoryShown, userChoice, context]
  );
  await saveDb();

  respond(res, { id });
}));

// POST /api/ideas/:slug/phase - Update incubation phase
app.post('/api/ideas/:slug/phase', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  let { phase } = req.body;

  // Valid UI phases: 'position' is the new name, 'differentiate' still accepted for backward compat
  const uiPhases = ['capture', 'clarify', 'position', 'differentiate', 'update', 'evaluate', 'iterate'];

  if (!phase || !uiPhases.includes(phase)) {
    res.status(400).json({ success: false, error: `Invalid phase. Must be one of: ${uiPhases.join(', ')}` });
    return;
  }

  // Map UI phase to DB phase - both 'position' and 'differentiate' map to 'differentiation' in DB
  // (DB constraint still uses 'differentiation' for backward compatibility)
  const mapUiToDb = (p: string) => {
    if (p === 'differentiate' || p === 'position') return 'differentiation';
    return p;
  };
  const dbPhase = mapUiToDb(phase);

  const idea = await getOne<{ id: string; incubation_phase: string }>('SELECT id, incubation_phase FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Map DB phase back to UI phase for response - always use 'position' now
  const mapDbToUi = (p: string) => p === 'differentiation' ? 'position' : p;
  const previousPhase = mapDbToUi(idea.incubation_phase || 'capture');

  await query('UPDATE ideas SET incubation_phase = ?, updated_at = ? WHERE id = ?', [
    dbPhase,
    new Date().toISOString(),
    idea.id
  ]);
  await saveDb();

  // Return 'position' as the canonical phase name
  const canonicalPhase = phase === 'differentiate' ? 'position' : phase;
  respond(res, { previousPhase, newPhase: canonicalPhase });
}));

// POST /api/ideas/:slug/differentiate - Run differentiation analysis
app.post('/api/ideas/:slug/differentiate', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // Get the idea
  const idea = await getOne<{
    id: string;
    title: string;
    summary: string | null;
    folder_path: string;
  }>('SELECT id, title, summary, folder_path FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Read content from README.md file
  let content = '';
  if (idea.folder_path) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const readmePath = path.join(idea.folder_path, 'README.md');
      content = await fs.readFile(readmePath, 'utf-8');
    } catch {
      // Content not available
    }
  }

  const ideaContent = `# ${idea.title}\n\n${idea.summary || ''}\n\n${content || ''}`;

  // Get answers for the idea
  const answersData = await getAnswersForIdea(idea.id);
  const answers: Record<string, string> = {};
  for (const a of answersData) {
    const question = await getQuestionById(a.questionId);
    if (question) {
      answers[question.text] = a.answer;
    }
  }

  // Calculate readiness for the viability gate check
  const readiness = await calculateReadiness(idea.id);
  if (readiness.overall < 0.5) {
    res.status(400).json({
      success: false,
      error: `Viability gate requires at least 50% readiness. Current: ${Math.round(readiness.overall * 100)}%`
    });
    return;
  }

  // Get linked profile if available
  const profileLink = await getOne<{ profile_id: string }>(
    'SELECT profile_id FROM idea_profiles WHERE idea_id = ?',
    [idea.id]
  );

  let profileContext: ProfileContext = {};
  if (profileLink) {
    const profile = await getOne<{
      primary_goals: string | null;
      technical_skills: string | null;
      professional_network: string | null;
      other_commitments: string | null;
      interests: string | null;
    }>('SELECT primary_goals, technical_skills, professional_network, other_commitments, interests FROM user_profiles WHERE id = ?', [profileLink.profile_id]);

    if (profile) {
      // Parse text fields into arrays (they may be comma-separated or JSON)
      const parseField = (val: string | null): string[] => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          // If not JSON, split by comma or newline
          return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        }
      };
      profileContext = {
        goals: parseField(profile.primary_goals),
        skills: parseField(profile.technical_skills),
        network: parseField(profile.professional_network),
        constraints: parseField(profile.other_commitments),
        interests: parseField(profile.interests)
      };
    }
  }

  // Build gap analysis from readiness data
  const gapAnalysis = {
    assumptions: readiness.blockingGaps?.map((gap, idx) => ({
      id: `gap-${idx}`,
      text: gap,
      category: 'problem' as const,
      impact: 'critical' as const,
      confidence: 'low' as const,
      addressed: false
    })) || [],
    criticalGapsCount: readiness.blockingGaps?.length || 0,
    significantGapsCount: 0,
    readinessScore: Math.round(readiness.overall * 100)
  };

  // Create cost tracker with $5 budget for differentiation analysis
  const costTracker = new CostTracker(5.00);

  try {
    // Run differentiation analysis
    const analysis = await runDifferentiationAnalysis(
      ideaContent,
      gapAnalysis,
      answers,
      profileContext,
      costTracker
    );

    // Build idea context for validation
    const ideaContext: IdeaContext = {
      problem: answers['What problem does this solve?'] || idea.summary || '',
      solution: answers['How does this solution work?'] || '',
      targetUser: answers['Who is the target user?'] || '',
      currentAnswers: answers
    };

    // Validate the analysis
    const validatedAnalysis = await validateDifferentiationAnalysis(
      analysis,
      ideaContext,
      profileContext,
      costTracker
    );

    // Transform to frontend format
    const opportunities = validatedAnalysis.marketOpportunities.map((opp, idx) => ({
      id: `opp-${idx}`,
      segment: opp.targetSegment,
      description: opp.description,
      fit: opp.potentialImpact as 'high' | 'medium' | 'low',
      confidence: Math.round(opp.validationConfidence * 100),
      reasons: opp.validationWarnings.length > 0 ? opp.validationWarnings : ['Aligned with profile']
    }));

    const strategies = validatedAnalysis.differentiationStrategies.map((strat, idx) => ({
      id: `strat-${idx}`,
      approach: strat.name,
      description: strat.description,
      validated: strat.validationConfidence >= 0.7,
      validationNotes: strat.validationWarnings.join('; ') || undefined,
      alignedWith: strat.differentiators,
      risks: strat.tradeoffs
    }));

    const competitiveRisks = validatedAnalysis.competitiveRisks.map((risk, idx) => ({
      id: `risk-${idx}`,
      competitor: 'Competitor',
      threat: risk.description,
      severity: risk.severity as 'high' | 'medium' | 'low',
      mitigation: risk.mitigation
    }));

    // Log cost report
    const costReport = costTracker.getReport();
    console.log(`Differentiation analysis complete. Cost: $${costReport.estimatedCost.toFixed(4)}, API calls: ${costReport.apiCalls}`);

    // Save cost to database (using a synthetic run_id for differentiation)
    const diffRunId = `diff-${Date.now()}`;
    for (const entry of costTracker.getLog()) {
      await query(
        `INSERT INTO cost_log (evaluation_run_id, idea_id, operation, input_tokens, output_tokens, estimated_cost, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          diffRunId,
          idea.id,
          entry.operation,
          entry.inputTokens,
          entry.outputTokens,
          entry.cost,
          entry.timestamp.toISOString()
        ]
      );
    }
    await saveDb();

    // Save results to database for persistence
    const diffResultId = `diff-result-${Date.now()}`;
    await query(
      `INSERT INTO differentiation_results
       (id, idea_id, run_id, opportunities, strategies, competitive_risks, summary, overall_confidence, cost_dollars, api_calls, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        diffResultId,
        idea.id,
        diffRunId,
        JSON.stringify(opportunities),
        JSON.stringify(strategies),
        JSON.stringify(competitiveRisks),
        validatedAnalysis.summary,
        validatedAnalysis.overallConfidence,
        costReport.estimatedCost,
        costReport.apiCalls,
        new Date().toISOString()
      ]
    );
    await saveDb();

    respond(res, {
      opportunities,
      strategies,
      competitiveRisks,
      summary: validatedAnalysis.summary,
      overallConfidence: Math.round(validatedAnalysis.overallConfidence * 100)
    });
  } catch (err) {
    console.error('Differentiation analysis failed:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message || 'Differentiation analysis failed'
    });
  }
}));

// GET /api/ideas/:slug/differentiation - Get saved differentiation results
app.get('/api/ideas/:slug/differentiation', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get the most recent differentiation result
  const result = await getOne<{
    id: string;
    run_id: string;
    opportunities: string;
    strategies: string;
    competitive_risks: string;
    summary: string;
    overall_confidence: number;
    cost_dollars: number;
    api_calls: number;
    created_at: string;
  }>(
    `SELECT * FROM differentiation_results
     WHERE idea_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [idea.id]
  );

  if (!result) {
    respond(res, null);
    return;
  }

  // Parse JSON fields
  respond(res, {
    id: result.id,
    runId: result.run_id,
    opportunities: JSON.parse(result.opportunities),
    strategies: JSON.parse(result.strategies),
    competitiveRisks: JSON.parse(result.competitive_risks),
    summary: result.summary,
    overallConfidence: Math.round(result.overall_confidence * 100),
    cost: result.cost_dollars,
    apiCalls: result.api_calls,
    createdAt: result.created_at
  });
}));

// POST /api/ideas/:slug/generate-update - Generate AI update suggestions
app.post('/api/ideas/:slug/generate-update', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { selectedStrategyIndex } = req.body;

  // Get the idea
  const idea = await getOne<{
    id: string;
    title: string;
    summary: string | null;
    folder_path: string;
  }>('SELECT id, title, summary, folder_path FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Read content from README.md
  let content = '';
  if (idea.folder_path) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const readmePath = path.join(idea.folder_path, 'README.md');
      content = await fs.readFile(readmePath, 'utf-8');
    } catch {
      // Content not available
    }
  }

  // Get the latest differentiation results (including extended analysis fields)
  const diffResult = await getOne<{
    opportunities: string;
    strategies: string;
    competitive_risks: string;
    summary: string;
    market_timing_analysis: string | null;
    execution_roadmap: string | null;
    strategic_summary: string | null;
    strategic_approach: string | null;
  }>(
    `SELECT opportunities, strategies, competitive_risks, summary,
            market_timing_analysis, execution_roadmap, strategic_summary, strategic_approach
     FROM differentiation_results
     WHERE idea_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [idea.id]
  );

  if (!diffResult) {
    res.status(400).json({
      success: false,
      error: 'No differentiation analysis found. Run differentiation analysis first.'
    });
    return;
  }

  // Get linked profile
  const profileLink = await getOne<{ profile_id: string }>(
    'SELECT profile_id FROM idea_profiles WHERE idea_id = ?',
    [idea.id]
  );

  let profileContext: ProfileContext = {};
  if (profileLink) {
    const profile = await getOne<{
      primary_goals: string | null;
      success_definition: string | null;
      technical_skills: string | null;
      interests: string | null;
      motivations: string | null;
      domain_connection: string | null;
      professional_experience: string | null;
      domain_expertise: string | null;
      known_gaps: string | null;
      industry_connections: string | null;
      professional_network: string | null;
      employment_status: string | null;
      weekly_hours_available: number | null;
      risk_tolerance: string | null;
    }>(`SELECT primary_goals, success_definition, technical_skills, interests,
        motivations, domain_connection, professional_experience, domain_expertise,
        known_gaps, industry_connections, professional_network, employment_status,
        weekly_hours_available, risk_tolerance
        FROM user_profiles WHERE id = ?`, [profileLink.profile_id]);

    if (profile) {
      const parseField = (val: string | null): string[] => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        }
      };
      profileContext = {
        goals: parseField(profile.primary_goals),
        skills: parseField(profile.technical_skills),
        interests: parseField(profile.interests),
        // Extended fields
        successDefinition: profile.success_definition || undefined,
        motivations: profile.motivations || undefined,
        domainConnection: profile.domain_connection || undefined,
        professionalExperience: profile.professional_experience || undefined,
        domainExpertise: parseField(profile.domain_expertise),
        knownGaps: profile.known_gaps || undefined,
        industryConnections: parseField(profile.industry_connections),
        professionalNetwork: profile.professional_network || undefined,
        employmentStatus: profile.employment_status || undefined,
        weeklyHoursAvailable: profile.weekly_hours_available || undefined,
        riskTolerance: profile.risk_tolerance || undefined
      };
    }
  }

  // Parse differentiation results
  const differentiationAnalysis = {
    marketOpportunities: JSON.parse(diffResult.opportunities),
    differentiationStrategies: JSON.parse(diffResult.strategies),
    competitiveRisks: JSON.parse(diffResult.competitive_risks),
    summary: diffResult.summary
  };

  // Load full positioning decision (user's strategic choices)
  const positioningDecision = await getOne<{
    primary_strategy_id: string | null;
    primary_strategy_name: string | null;
    secondary_strategy_name: string | null;
    timing_decision: string | null;
    timing_rationale: string | null;
    selected_approach: string | null;
    risk_responses: string | null;
    notes: string | null;
  }>(`SELECT primary_strategy_id, primary_strategy_name, secondary_strategy_name,
             timing_decision, timing_rationale, selected_approach, risk_responses, notes
      FROM positioning_decisions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1`, [idea.id]);

  const riskResponses = positioningDecision?.risk_responses
    ? JSON.parse(positioningDecision.risk_responses)
    : [];

  // Load financial allocation (user's resource commitment)
  const financialAllocation = await getOne<{
    allocated_budget: number | null;
    allocated_weekly_hours: number | null;
    allocated_runway_months: number | null;
    target_income_from_idea: number | null;
    income_timeline_months: number | null;
    income_type: string | null;
    validation_budget: number | null;
    kill_criteria: string | null;
    strategic_approach: string | null;
    approach_rationale: string | null;
  }>(`SELECT allocated_budget, allocated_weekly_hours, allocated_runway_months,
             target_income_from_idea, income_timeline_months, income_type,
             validation_budget, kill_criteria, strategic_approach, approach_rationale
      FROM idea_financial_allocations WHERE idea_id = ?`, [idea.id]);

  // Load Q&A answers from Clarify phase
  const answersResult = await query(
    `SELECT q.id as question_id, q.question_text, a.answer
     FROM idea_answers a
     JOIN question_bank q ON a.question_id = q.id
     WHERE a.idea_id = ?
     ORDER BY a.answered_at`,
    [idea.id]
  ) as Array<{ question_id: string; question_text: string; answer: string }>;

  const qaContext = answersResult.map((a: { question_text: string; answer: string }) => ({
    question: a.question_text,
    answer: a.answer
  }));

  // Create cost tracker
  const costTracker = new CostTracker(3.00);

  // Build positioning context from user's decisions
  const positioningContext = positioningDecision ? {
    primaryStrategyId: positioningDecision.primary_strategy_id || undefined,
    primaryStrategyName: positioningDecision.primary_strategy_name || undefined,
    secondaryStrategyName: positioningDecision.secondary_strategy_name || undefined,
    timingDecision: positioningDecision.timing_decision as 'proceed_now' | 'wait' | 'urgent' | undefined,
    timingRationale: positioningDecision.timing_rationale || undefined,
    strategicApproach: positioningDecision.selected_approach as any,
    notes: positioningDecision.notes || undefined
  } : undefined;

  // Build financial context from allocation
  const financialCtx = financialAllocation ? {
    allocatedBudget: financialAllocation.allocated_budget || undefined,
    allocatedWeeklyHours: financialAllocation.allocated_weekly_hours || undefined,
    allocatedRunwayMonths: financialAllocation.allocated_runway_months || undefined,
    targetIncome: financialAllocation.target_income_from_idea || undefined,
    incomeTimelineMonths: financialAllocation.income_timeline_months || undefined,
    incomeType: financialAllocation.income_type as any,
    validationBudget: financialAllocation.validation_budget || undefined,
    killCriteria: financialAllocation.kill_criteria || undefined,
    strategicApproach: financialAllocation.strategic_approach as any,
    approachRationale: financialAllocation.approach_rationale || undefined
  } : undefined;

  // Build extended analysis context
  const extendedAnalysis = {
    marketTimingAnalysis: diffResult.market_timing_analysis
      ? JSON.parse(diffResult.market_timing_analysis)
      : undefined,
    executionRoadmap: diffResult.execution_roadmap
      ? JSON.parse(diffResult.execution_roadmap)
      : undefined,
    strategicSummary: diffResult.strategic_summary || undefined
  };

  try {
    const suggestion = await generateUpdateSuggestions(
      {
        title: idea.title,
        summary: idea.summary || '',
        content: content
      },
      differentiationAnalysis,
      selectedStrategyIndex ?? null,
      profileContext,
      qaContext,
      costTracker,
      riskResponses,
      positioningContext,
      financialCtx,
      extendedAnalysis
    );

    // Save the suggestion to database
    const suggestionId = `update-${Date.now()}`;
    await query(
      `INSERT INTO update_suggestions
       (id, idea_id, suggested_title, suggested_summary, suggested_content, change_rationale, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        suggestionId,
        idea.id,
        suggestion.suggestedTitle,
        suggestion.suggestedSummary,
        suggestion.suggestedContent,
        JSON.stringify(suggestion.changeRationale),
        new Date().toISOString()
      ]
    );
    await saveDb();

    const costReport = costTracker.getReport();
    console.log(`Update suggestion generated. Cost: $${costReport.estimatedCost.toFixed(4)}`);

    respond(res, {
      id: suggestionId,
      ...suggestion,
      cost: costReport.estimatedCost
    });
  } catch (err) {
    console.error('Update suggestion generation failed:', err);
    res.status(500).json({
      success: false,
      error: (err as Error).message || 'Failed to generate update suggestions'
    });
  }
}));

// GET /api/ideas/:slug/update-suggestion - Get latest update suggestion
app.get('/api/ideas/:slug/update-suggestion', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const suggestion = await getOne<{
    id: string;
    suggested_title: string;
    suggested_summary: string;
    suggested_content: string;
    change_rationale: string;
    status: string;
    created_at: string;
  }>(
    `SELECT * FROM update_suggestions
     WHERE idea_id = ? AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [idea.id]
  );

  if (!suggestion) {
    respond(res, null);
    return;
  }

  respond(res, {
    id: suggestion.id,
    suggestedTitle: suggestion.suggested_title,
    suggestedSummary: suggestion.suggested_summary,
    suggestedContent: suggestion.suggested_content,
    changeRationale: JSON.parse(suggestion.change_rationale),
    status: suggestion.status,
    createdAt: suggestion.created_at
  });
}));

// POST /api/ideas/:slug/apply-update - Apply the update suggestion
app.post('/api/ideas/:slug/apply-update', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { suggestionId, modified } = req.body;

  const idea = await getOne<{ id: string; folder_path: string }>(
    'SELECT id, folder_path FROM ideas WHERE slug = ?',
    [slug]
  );

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get the suggestion
  const suggestion = await getOne<{
    id: string;
    suggested_title: string;
    suggested_summary: string;
    suggested_content: string;
  }>(
    'SELECT * FROM update_suggestions WHERE id = ? AND idea_id = ?',
    [suggestionId, idea.id]
  );

  if (!suggestion) {
    res.status(404).json({ success: false, error: 'Update suggestion not found' });
    return;
  }

  // Apply the updates (use modified content if provided)
  const newTitle = modified?.title || suggestion.suggested_title;
  const newSummary = modified?.summary || suggestion.suggested_summary;
  const newContent = modified?.content || suggestion.suggested_content;

  // Update the idea in database
  await query(
    'UPDATE ideas SET title = ?, summary = ?, updated_at = ? WHERE id = ?',
    [newTitle, newSummary, new Date().toISOString(), idea.id]
  );

  // Update the README.md file if folder exists
  if (idea.folder_path) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const readmePath = path.join(idea.folder_path, 'README.md');
      await fs.writeFile(readmePath, newContent, 'utf-8');
    } catch (err) {
      console.error('Failed to update README.md:', err);
    }
  }

  // Mark suggestion as accepted
  await query(
    `UPDATE update_suggestions SET status = ?, resolved_at = ?, user_modified_content = ? WHERE id = ?`,
    [
      modified ? 'modified' : 'accepted',
      new Date().toISOString(),
      modified ? JSON.stringify(modified) : null,
      suggestionId
    ]
  );
  await saveDb();

  respond(res, { success: true, message: 'Update applied successfully' });
}));

// ==================== FINANCIAL ALLOCATION ENDPOINTS ====================

// GET /api/ideas/:slug/allocation - Get financial allocation for an idea
app.get('/api/ideas/:slug/allocation', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const allocation = await getOne<{
    id: string;
    idea_id: string;
    allocated_budget: number;
    allocated_weekly_hours: number;
    allocated_runway_months: number;
    allocation_priority: string;
    target_income_from_idea: number | null;
    income_timeline_months: number | null;
    income_type: string;
    exit_intent: number;
    idea_risk_tolerance: string | null;
    max_acceptable_loss: number | null;
    pivot_willingness: string;
    validation_budget: number;
    max_time_to_validate_months: number | null;
    kill_criteria: string | null;
    strategic_approach: string | null;
    approach_rationale: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM idea_financial_allocations WHERE idea_id = ?', [idea.id]);

  if (!allocation) {
    // Return default allocation if none exists
    respond(res, {
      ideaId: idea.id,
      allocatedBudget: 0,
      allocatedWeeklyHours: 0,
      allocatedRunwayMonths: 0,
      allocationPriority: 'exploration',
      targetIncomeFromIdea: null,
      incomeTimelineMonths: null,
      incomeType: 'supplement',
      exitIntent: false,
      ideaRiskTolerance: null,
      maxAcceptableLoss: null,
      pivotWillingness: 'moderate',
      validationBudget: 0,
      maxTimeToValidateMonths: null,
      killCriteria: null,
      strategicApproach: null,
      approachRationale: null,
      exists: false
    });
    return;
  }

  respond(res, {
    id: allocation.id,
    ideaId: allocation.idea_id,
    allocatedBudget: allocation.allocated_budget,
    allocatedWeeklyHours: allocation.allocated_weekly_hours,
    allocatedRunwayMonths: allocation.allocated_runway_months,
    allocationPriority: allocation.allocation_priority,
    targetIncomeFromIdea: allocation.target_income_from_idea,
    incomeTimelineMonths: allocation.income_timeline_months,
    incomeType: allocation.income_type,
    exitIntent: Boolean(allocation.exit_intent),
    ideaRiskTolerance: allocation.idea_risk_tolerance,
    maxAcceptableLoss: allocation.max_acceptable_loss,
    pivotWillingness: allocation.pivot_willingness,
    validationBudget: allocation.validation_budget,
    maxTimeToValidateMonths: allocation.max_time_to_validate_months,
    killCriteria: allocation.kill_criteria,
    strategicApproach: allocation.strategic_approach,
    approachRationale: allocation.approach_rationale,
    createdAt: allocation.created_at,
    updatedAt: allocation.updated_at,
    exists: true
  });
}));

// POST /api/ideas/:slug/allocation - Create or update financial allocation
app.post('/api/ideas/:slug/allocation', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const {
    allocatedBudget,
    allocatedWeeklyHours,
    allocatedRunwayMonths,
    allocationPriority,
    targetIncomeFromIdea,
    incomeTimelineMonths,
    incomeType,
    exitIntent,
    ideaRiskTolerance,
    maxAcceptableLoss,
    pivotWillingness,
    validationBudget,
    maxTimeToValidateMonths,
    killCriteria,
    strategicApproach,
    approachRationale
  } = req.body;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Check if allocation exists
  const existing = await getOne<{ id: string }>('SELECT id FROM idea_financial_allocations WHERE idea_id = ?', [idea.id]);

  if (existing) {
    // Update existing allocation
    await query(
      `UPDATE idea_financial_allocations SET
        allocated_budget = ?,
        allocated_weekly_hours = ?,
        allocated_runway_months = ?,
        allocation_priority = ?,
        target_income_from_idea = ?,
        income_timeline_months = ?,
        income_type = ?,
        exit_intent = ?,
        idea_risk_tolerance = ?,
        max_acceptable_loss = ?,
        pivot_willingness = ?,
        validation_budget = ?,
        max_time_to_validate_months = ?,
        kill_criteria = ?,
        strategic_approach = ?,
        approach_rationale = ?,
        updated_at = ?
       WHERE idea_id = ?`,
      [
        allocatedBudget ?? 0,
        allocatedWeeklyHours ?? 0,
        allocatedRunwayMonths ?? 0,
        allocationPriority ?? 'exploration',
        targetIncomeFromIdea ?? null,
        incomeTimelineMonths ?? null,
        incomeType ?? 'supplement',
        exitIntent ? 1 : 0,
        ideaRiskTolerance ?? null,
        maxAcceptableLoss ?? null,
        pivotWillingness ?? 'moderate',
        validationBudget ?? 0,
        maxTimeToValidateMonths ?? null,
        killCriteria ?? null,
        strategicApproach ?? null,
        approachRationale ?? null,
        new Date().toISOString(),
        idea.id
      ]
    );
    await saveDb();
    respond(res, { id: existing.id, updated: true });
  } else {
    // Create new allocation
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO idea_financial_allocations (
        id, idea_id, allocated_budget, allocated_weekly_hours, allocated_runway_months,
        allocation_priority, target_income_from_idea, income_timeline_months, income_type,
        exit_intent, idea_risk_tolerance, max_acceptable_loss, pivot_willingness,
        validation_budget, max_time_to_validate_months, kill_criteria,
        strategic_approach, approach_rationale
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        idea.id,
        allocatedBudget ?? 0,
        allocatedWeeklyHours ?? 0,
        allocatedRunwayMonths ?? 0,
        allocationPriority ?? 'exploration',
        targetIncomeFromIdea ?? null,
        incomeTimelineMonths ?? null,
        incomeType ?? 'supplement',
        exitIntent ? 1 : 0,
        ideaRiskTolerance ?? null,
        maxAcceptableLoss ?? null,
        pivotWillingness ?? 'moderate',
        validationBudget ?? 0,
        maxTimeToValidateMonths ?? null,
        killCriteria ?? null,
        strategicApproach ?? null,
        approachRationale ?? null
      ]
    );
    await saveDb();
    respond(res, { id, created: true });
  }
}));

// DELETE /api/ideas/:slug/allocation - Delete financial allocation
app.delete('/api/ideas/:slug/allocation', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  await query('DELETE FROM idea_financial_allocations WHERE idea_id = ?', [idea.id]);
  await saveDb();

  respond(res, { deleted: true });
}));

// ==================== POSITIONING DECISION ENDPOINTS ====================

// GET /api/ideas/:slug/positioning-decision - Get positioning decision for an idea
app.get('/api/ideas/:slug/positioning-decision', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get the most recent decision
  const decision = await getOne<{
    id: string;
    idea_id: string;
    primary_strategy_id: string | null;
    primary_strategy_name: string | null;
    secondary_strategy_id: string | null;
    secondary_strategy_name: string | null;
    acknowledged_risk_ids: string;
    risk_responses: string | null;
    risk_response_stats: string | null;
    timing_decision: string | null;
    timing_rationale: string | null;
    selected_approach: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM positioning_decisions WHERE idea_id = ? ORDER BY created_at DESC LIMIT 1', [idea.id]);

  if (!decision) {
    respond(res, { exists: false, ideaId: idea.id });
    return;
  }

  respond(res, {
    id: decision.id,
    ideaId: decision.idea_id,
    primaryStrategyId: decision.primary_strategy_id,
    primaryStrategyName: decision.primary_strategy_name,
    secondaryStrategyId: decision.secondary_strategy_id,
    secondaryStrategyName: decision.secondary_strategy_name,
    acknowledgedRiskIds: JSON.parse(decision.acknowledged_risk_ids || '[]'),
    riskResponses: JSON.parse(decision.risk_responses || '[]'),
    riskResponseStats: decision.risk_response_stats ? JSON.parse(decision.risk_response_stats) : null,
    timingDecision: decision.timing_decision,
    timingRationale: decision.timing_rationale,
    selectedApproach: decision.selected_approach,
    notes: decision.notes,
    createdAt: decision.created_at,
    updatedAt: decision.updated_at,
    exists: true
  });
}));

// Risk response type definitions for API
interface RiskResponseInput {
  riskId: string;
  riskDescription: string;
  riskSeverity: 'high' | 'medium' | 'low';
  response: 'mitigate' | 'accept' | 'monitor' | 'disagree' | 'skip';
  disagreeReason?: 'not_applicable' | 'already_addressed' | 'low_likelihood' | 'insider_knowledge' | 'other';
  reasoning?: string;
  mitigationPlan?: string;
  respondedAt: string;
}

// Calculate risk response stats
function calculateRiskResponseStats(responses: RiskResponseInput[]): {
  total: number;
  responded: number;
  mitigate: number;
  accept: number;
  monitor: number;
  disagree: number;
  skipped: number;
} {
  return {
    total: responses.length,
    responded: responses.filter(r => r.response !== 'skip').length,
    mitigate: responses.filter(r => r.response === 'mitigate').length,
    accept: responses.filter(r => r.response === 'accept').length,
    monitor: responses.filter(r => r.response === 'monitor').length,
    disagree: responses.filter(r => r.response === 'disagree').length,
    skipped: responses.filter(r => r.response === 'skip').length,
  };
}

// POST /api/ideas/:slug/positioning-decision - Create or update positioning decision
app.post('/api/ideas/:slug/positioning-decision', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const {
    primaryStrategyId,
    primaryStrategyName,
    secondaryStrategyId,
    secondaryStrategyName,
    acknowledgedRiskIds,
    riskResponses,
    timingDecision,
    timingRationale,
    selectedApproach,
    notes
  } = req.body;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Calculate risk response stats if responses provided
  const riskResponsesArray: RiskResponseInput[] = riskResponses ?? [];
  const stats = riskResponsesArray.length > 0 ? calculateRiskResponseStats(riskResponsesArray) : null;

  // Always create a new decision record (we keep history)
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO positioning_decisions (
      id, idea_id, primary_strategy_id, primary_strategy_name,
      secondary_strategy_id, secondary_strategy_name, acknowledged_risk_ids,
      risk_responses, risk_response_stats,
      timing_decision, timing_rationale, selected_approach, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      idea.id,
      primaryStrategyId ?? null,
      primaryStrategyName ?? null,
      secondaryStrategyId ?? null,
      secondaryStrategyName ?? null,
      JSON.stringify(acknowledgedRiskIds ?? []),
      JSON.stringify(riskResponsesArray),
      stats ? JSON.stringify(stats) : null,
      timingDecision ?? null,
      timingRationale ?? null,
      selectedApproach ?? null,
      notes ?? null
    ]
  );

  // Log individual risk responses for analytics
  if (riskResponsesArray.length > 0) {
    for (const response of riskResponsesArray) {
      const logId = crypto.randomUUID();
      await query(
        `INSERT INTO risk_response_log (
          id, idea_id, risk_id, risk_description, risk_severity,
          response_type, disagree_reason, reasoning, mitigation_plan,
          strategic_approach, positioning_decision_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          idea.id,
          response.riskId,
          response.riskDescription,
          response.riskSeverity,
          response.response,
          response.disagreeReason ?? null,
          response.reasoning ?? null,
          response.mitigationPlan ?? null,
          selectedApproach ?? null,
          id
        ]
      );
    }
  }

  await saveDb();

  respond(res, { id, created: true, stats });
}));

// GET /api/ideas/:slug/positioning-decisions - Get all positioning decisions (history)
app.get('/api/ideas/:slug/positioning-decisions', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  const decisions = await query<{
    id: string;
    idea_id: string;
    primary_strategy_id: string | null;
    primary_strategy_name: string | null;
    secondary_strategy_id: string | null;
    secondary_strategy_name: string | null;
    acknowledged_risk_ids: string;
    risk_responses: string | null;
    risk_response_stats: string | null;
    timing_decision: string | null;
    timing_rationale: string | null;
    selected_approach: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM positioning_decisions WHERE idea_id = ? ORDER BY created_at DESC', [idea.id]);

  respond(res, decisions.map(d => ({
    id: d.id,
    ideaId: d.idea_id,
    primaryStrategyId: d.primary_strategy_id,
    primaryStrategyName: d.primary_strategy_name,
    secondaryStrategyId: d.secondary_strategy_id,
    secondaryStrategyName: d.secondary_strategy_name,
    acknowledgedRiskIds: JSON.parse(d.acknowledged_risk_ids || '[]'),
    riskResponses: JSON.parse(d.risk_responses || '[]'),
    riskResponseStats: d.risk_response_stats ? JSON.parse(d.risk_response_stats) : null,
    timingDecision: d.timing_decision,
    timingRationale: d.timing_rationale,
    selectedApproach: d.selected_approach,
    notes: d.notes,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  })));
}));

// ==================== POSITIONING ANALYSIS ENDPOINT ====================

// GET /api/ideas/:slug/positioning - Get saved positioning analysis results
app.get('/api/ideas/:slug/positioning', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const idea = await getOne<{ id: string }>('SELECT id FROM ideas WHERE slug = ?', [slug]);
  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Get the most recent positioning result (differentiation_results with strategic_approach)
  const result = await getOne<{
    id: string;
    run_id: string;
    opportunities: string;
    strategies: string;
    competitive_risks: string;
    summary: string;
    overall_confidence: number;
    cost_dollars: number;
    api_calls: number;
    strategic_approach: string | null;
    strategic_summary: string | null;
    created_at: string;
  }>(
    `SELECT * FROM differentiation_results
     WHERE idea_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [idea.id]
  );

  if (!result) {
    respond(res, null);
    return;
  }

  // Parse JSON fields
  const opportunities = JSON.parse(result.opportunities || '[]');
  const strategies = JSON.parse(result.strategies || '[]');
  const competitiveRisks = JSON.parse(result.competitive_risks || '[]');
  const strategicSummary = result.strategic_summary ? JSON.parse(result.strategic_summary) : null;

  respond(res, {
    id: result.id,
    runId: result.run_id,
    approach: result.strategic_approach,
    strategicSummary,
    marketOpportunities: opportunities,
    strategies: strategies.map((s: any, i: number) => ({
      ...s,
      id: s.id || `strategy-${i}`,
    })),
    competitiveRisks: competitiveRisks.map((r: any, i: number) => ({
      ...r,
      id: r.id || `risk-${i}`,
    })),
    summary: result.summary,
    overallConfidence: result.overall_confidence,
    cost: {
      dollars: result.cost_dollars,
      apiCalls: result.api_calls,
    },
    createdAt: result.created_at
  });
}));

// POST /api/ideas/:slug/position - Run positioning analysis with strategic approach
app.post('/api/ideas/:slug/position', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { approach } = req.body as { approach: StrategicApproach };

  // Validate approach
  const validApproaches: StrategicApproach[] = ['create', 'copy_improve', 'combine', 'localize', 'specialize', 'time'];
  if (!approach || !validApproaches.includes(approach)) {
    res.status(400).json({
      success: false,
      error: `Invalid strategic approach. Must be one of: ${validApproaches.join(', ')}`
    });
    return;
  }

  // Get the idea
  const idea = await getOne<{
    id: string;
    title: string;
    summary: string | null;
    folder_path: string;
  }>('SELECT id, title, summary, folder_path FROM ideas WHERE slug = ?', [slug]);

  if (!idea) {
    res.status(404).json({ success: false, error: 'Idea not found' });
    return;
  }

  // Read content from README.md file
  let content = '';
  if (idea.folder_path) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const readmePath = path.join(idea.folder_path, 'README.md');
      content = await fs.readFile(readmePath, 'utf-8');
    } catch {
      // Content not available
    }
  }

  const ideaContent = `# ${idea.title}\n\n${idea.summary || ''}\n\n${content || ''}`;

  // Get answers for the idea
  const answersData = await getAnswersForIdea(idea.id);
  const answers: Record<string, string> = {};
  for (const a of answersData) {
    const question = await getQuestionById(a.questionId);
    if (question) {
      answers[question.text] = a.answer;
    }
  }

  // Calculate readiness for the viability gate check
  const readiness = await calculateReadiness(idea.id);
  if (readiness.overall < 0.5) {
    res.status(400).json({
      success: false,
      error: `Viability gate requires at least 50% readiness. Current: ${Math.round(readiness.overall * 100)}%`
    });
    return;
  }

  // Get linked profile if available
  const profileLink = await getOne<{ profile_id: string }>(
    'SELECT profile_id FROM idea_profiles WHERE idea_id = ?',
    [idea.id]
  );

  let profileContext: ProfileContext = {};
  if (profileLink) {
    const profile = await getOne<{
      primary_goals: string | null;
      technical_skills: string | null;
      professional_network: string | null;
      other_commitments: string | null;
      interests: string | null;
      current_monthly_income: number | null;
      financial_runway_months: number | null;
      weekly_hours_available: number | null;
      risk_tolerance: string | null;
    }>('SELECT primary_goals, technical_skills, professional_network, other_commitments, interests, current_monthly_income, financial_runway_months, weekly_hours_available, risk_tolerance FROM user_profiles WHERE id = ?', [profileLink.profile_id]);

    if (profile) {
      // Parse text fields into arrays (they may be comma-separated or JSON)
      const parseField = (val: string | null): string[] => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          // If not JSON, split by comma or newline
          return val.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
        }
      };
      profileContext = {
        goals: parseField(profile.primary_goals),
        skills: parseField(profile.technical_skills),
        network: parseField(profile.professional_network),
        constraints: parseField(profile.other_commitments),
        interests: parseField(profile.interests),
        currentAnnualIncome: profile.current_monthly_income ? profile.current_monthly_income * 12 : undefined,
        runwayMonths: profile.financial_runway_months ?? undefined,
        hoursPerWeek: profile.weekly_hours_available ?? undefined,
        riskTolerance: profile.risk_tolerance ?? undefined
      };
    }
  }

  // Get financial allocation for this idea
  const allocationRow = await getOne<{
    id: string;
    idea_id: string;
    allocated_budget: number;
    allocated_weekly_hours: number;
    allocated_runway_months: number;
    allocation_priority: string;
    strategic_approach: string | null;
    target_income_from_idea: number | null;
    income_timeline_months: number | null;
    income_type: string | null;
    exit_intent: number;
    idea_risk_tolerance: string | null;
    max_acceptable_loss: number | null;
    pivot_willingness: string | null;
    validation_budget: number;
    max_time_to_validate_months: number | null;
    kill_criteria: string | null;
  }>('SELECT * FROM idea_financial_allocations WHERE idea_id = ?', [idea.id]);

  let allocation: IdeaFinancialAllocation | undefined;
  if (allocationRow) {
    allocation = {
      id: allocationRow.id,
      ideaId: allocationRow.idea_id,
      allocatedBudget: allocationRow.allocated_budget,
      allocatedWeeklyHours: allocationRow.allocated_weekly_hours,
      allocatedRunwayMonths: allocationRow.allocated_runway_months,
      allocationPriority: (allocationRow.allocation_priority || 'exploration') as 'primary' | 'secondary' | 'exploration' | 'parked',
      strategicApproach: allocationRow.strategic_approach as StrategicApproach || undefined,
      targetIncomeFromIdea: allocationRow.target_income_from_idea ?? undefined,
      incomeTimelineMonths: allocationRow.income_timeline_months ?? undefined,
      incomeType: (allocationRow.income_type || 'supplement') as 'full_replacement' | 'partial_replacement' | 'supplement' | 'wealth_building' | 'learning',
      exitIntent: allocationRow.exit_intent === 1,
      ideaRiskTolerance: allocationRow.idea_risk_tolerance as 'low' | 'medium' | 'high' | 'very_high' | undefined,
      maxAcceptableLoss: allocationRow.max_acceptable_loss ?? undefined,
      pivotWillingness: (allocationRow.pivot_willingness || 'moderate') as 'rigid' | 'moderate' | 'flexible' | 'very_flexible',
      validationBudget: allocationRow.validation_budget,
      maxTimeToValidateMonths: allocationRow.max_time_to_validate_months ?? undefined,
      killCriteria: allocationRow.kill_criteria ?? undefined
    };
  }

  // Build gap analysis from readiness data
  const gapAnalysis = {
    assumptions: readiness.blockingGaps?.map((gap, idx) => ({
      id: `gap-${idx}`,
      text: gap,
      category: 'problem' as const,
      impact: 'critical' as const,
      confidence: 'low' as const,
      addressed: false
    })) || [],
    criticalGapsCount: readiness.blockingGaps?.length || 0,
    significantGapsCount: 0,
    readinessScore: Math.round(readiness.overall * 100)
  };

  // Create cost tracker with $5 budget for positioning analysis
  const costTracker = new CostTracker(5.00);

  try {
    // Run positioning analysis
    const analysis = await runPositioningAnalysis({
      ideaTitle: idea.title,
      ideaSummary: idea.summary || '',
      ideaContent,
      approach,
      gapAnalysis,
      answers,
      profile: profileContext,
      allocation
    }, costTracker);

    // Get cost report
    const costReport = costTracker.getReport();
    console.log(`Positioning analysis complete. Cost: $${costReport.estimatedCost.toFixed(4)}, API calls: ${costReport.apiCalls}`);

    // Save cost to database
    const runId = `pos-${Date.now()}`;
    for (const entry of costTracker.getLog()) {
      await query(
        `INSERT INTO cost_log (evaluation_run_id, idea_id, operation, input_tokens, output_tokens, estimated_cost, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          idea.id,
          entry.operation,
          entry.inputTokens,
          entry.outputTokens,
          entry.cost,
          entry.timestamp.toISOString()
        ]
      );
    }
    await saveDb();

    // Transform analysis for storage
    const strategies = analysis.strategies.map((strat, idx) => ({
      id: strat.id || `strat-${idx}`,
      name: strat.name,
      description: strat.description,
      differentiators: strat.differentiators,
      tradeoffs: strat.tradeoffs,
      fitWithProfile: strat.fitWithProfile,
      fiveWH: strat.fiveWH,
      addressesOpportunities: strat.addressesOpportunities,
      mitigatesRisks: strat.mitigatesRisks,
      timingAlignment: strat.timingAlignment,
      revenueEstimates: strat.revenueEstimates,
      goalAlignment: strat.goalAlignment,
      profileFitBreakdown: strat.profileFitBreakdown
    }));

    // Save results to differentiation_results table
    const resultId = `pos-result-${Date.now()}`;
    await query(
      `INSERT INTO differentiation_results
       (id, idea_id, run_id, opportunities, strategies, competitive_risks, summary, overall_confidence, cost_dollars, api_calls, created_at, strategic_approach, strategic_summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        idea.id,
        runId,
        JSON.stringify(analysis.marketOpportunities),
        JSON.stringify(strategies),
        JSON.stringify(analysis.competitiveRisks),
        analysis.summary,
        analysis.overallConfidence,
        costReport.estimatedCost,
        costReport.apiCalls,
        new Date().toISOString(),
        approach,
        JSON.stringify(analysis.strategicSummary)
      ]
    );

    await saveDb();

    // Return results
    respond(res, {
      id: resultId,
      approach: analysis.strategicApproach,
      strategicSummary: analysis.strategicSummary,
      marketOpportunities: analysis.marketOpportunities,
      competitiveRisks: analysis.competitiveRisks,
      strategies,
      marketTiming: analysis.marketTiming,
      summary: analysis.summary,
      overallConfidence: analysis.overallConfidence,
      cost: {
        dollars: costReport.estimatedCost,
        apiCalls: costReport.apiCalls
      }
    });
  } catch (err) {
    console.error('Positioning analysis failed:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Positioning analysis failed'
    });
  }
}));

// Start server with WebSocket support
export async function startServer(): Promise<void> {
  const server = createServer(app);
  initWebSocket(server);

  // Start background jobs
  startExpiryChecker(); // QUE-004: Check for expired questions every 5 minutes

  // Start Communication Hub for Telegram integration
  try {
    const hub = getCommunicationHub({
      run: async () => ({ lastID: 0, changes: 0 }),
      get: async () => undefined,
      all: async () => [],
    });
    await hub.start();
    console.log('[TaskAgent] Communication hub started - Telegram polling enabled');
  } catch (error) {
    console.error('[TaskAgent] Failed to start communication hub:', error);
  }

  server.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`WebSocket server available at ws://localhost:${PORT}/ws`);
  });
}

export default app;
