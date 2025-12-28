import { v4 as uuidv4 } from 'uuid';
import { query, run, getOne, saveDb } from '../database/db.js';
import { getRelevantQuestions } from './loader.js';
import {
  QuestionWithCategory,
  QuestionCategory,
  Answer,
  AnswerSource,
  ReadinessScore,
  CriterionCoverage,
  DevelopmentSession,
  PRIORITY_WEIGHTS,
  CATEGORY_WEIGHTS,
  READINESS_THRESHOLDS,
  IdeaTypeFilter,
  LifecycleStageFilter
} from './types.js';

// Database row interfaces
interface DBAnswer {
  id: string;
  idea_id: string;
  question_id: string;
  answer: string;
  answer_source: string;
  confidence: number;
  answered_at: string;
  updated_at: string;
}

interface DBIdea {
  id: string;
  slug: string;
  title: string;
  idea_type: string;
  lifecycle_stage: string;
}

interface DBReadiness {
  idea_id: string;
  overall_readiness: number;
  problem_coverage: number;
  solution_coverage: number;
  feasibility_coverage: number;
  fit_coverage: number;
  market_coverage: number;
  risk_coverage: number;
  business_model_coverage: number;
  last_calculated: string;
}

interface DBIdeaProfile {
  idea_id: string;
  profile_id: string;
}

// ==========================================
// ANSWER MANAGEMENT
// ==========================================

// Get all answers for an idea
export async function getAnswersForIdea(ideaId: string): Promise<Answer[]> {
  const rows = await query<DBAnswer>(
    'SELECT * FROM idea_answers WHERE idea_id = ? ORDER BY answered_at',
    [ideaId]
  );

  return rows.map(row => ({
    id: row.id,
    ideaId: row.idea_id,
    questionId: row.question_id,
    answer: row.answer,
    answerSource: row.answer_source as AnswerSource,
    confidence: row.confidence,
    answeredAt: row.answered_at,
    updatedAt: row.updated_at
  }));
}

// Get answer for a specific question
export async function getAnswer(
  ideaId: string,
  questionId: string
): Promise<Answer | null> {
  const row = await getOne<DBAnswer>(
    'SELECT * FROM idea_answers WHERE idea_id = ? AND question_id = ?',
    [ideaId, questionId]
  );

  if (!row) return null;

  return {
    id: row.id,
    ideaId: row.idea_id,
    questionId: row.question_id,
    answer: row.answer,
    answerSource: row.answer_source as AnswerSource,
    confidence: row.confidence,
    answeredAt: row.answered_at,
    updatedAt: row.updated_at
  };
}

// Save or update an answer
export async function saveAnswer(
  ideaId: string,
  questionId: string,
  answer: string,
  source: AnswerSource = 'user',
  confidence: number = 1.0
): Promise<Answer> {
  const existing = await getAnswer(ideaId, questionId);
  const now = new Date().toISOString();

  if (existing) {
    // Update existing answer
    await run(
      `UPDATE idea_answers
       SET answer = ?, answer_source = ?, confidence = ?, updated_at = ?
       WHERE idea_id = ? AND question_id = ?`,
      [answer, source, confidence, now, ideaId, questionId]
    );

    await saveDb();

    // Recalculate readiness after answer update
    await calculateAndSaveReadiness(ideaId);

    return {
      ...existing,
      answer,
      answerSource: source,
      confidence,
      updatedAt: now
    };
  } else {
    // Insert new answer
    const id = uuidv4();
    await run(
      `INSERT INTO idea_answers
       (id, idea_id, question_id, answer, answer_source, confidence, answered_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ideaId, questionId, answer, source, confidence, now, now]
    );

    await saveDb();

    // Recalculate readiness after new answer
    await calculateAndSaveReadiness(ideaId);

    return {
      id,
      ideaId,
      questionId,
      answer,
      answerSource: source,
      confidence,
      answeredAt: now,
      updatedAt: now
    };
  }
}

// Delete an answer
export async function deleteAnswer(ideaId: string, questionId: string): Promise<boolean> {
  await run(
    'DELETE FROM idea_answers WHERE idea_id = ? AND question_id = ?',
    [ideaId, questionId]
  );
  await saveDb();

  // Recalculate readiness after deletion
  await calculateAndSaveReadiness(ideaId);

  return true;
}

// ==========================================
// READINESS CALCULATION
// ==========================================

// Get idea by ID
async function getIdeaById(ideaId: string): Promise<DBIdea | null> {
  return await getOne<DBIdea>('SELECT * FROM ideas WHERE id = ?', [ideaId]);
}

// Get idea by slug
export async function getIdeaBySlug(slug: string): Promise<DBIdea | null> {
  return await getOne<DBIdea>('SELECT * FROM ideas WHERE slug = ?', [slug]);
}

// Check if idea has linked profile (for fit coverage)
async function hasLinkedProfile(ideaId: string): Promise<boolean> {
  const row = await getOne<DBIdeaProfile>(
    'SELECT * FROM idea_profiles WHERE idea_id = ?',
    [ideaId]
  );
  return row !== null;
}

// Calculate criterion coverage for an idea
export async function calculateCriterionCoverage(
  ideaId: string
): Promise<CriterionCoverage[]> {
  const idea = await getIdeaById(ideaId);
  if (!idea) return [];

  const ideaType = idea.idea_type as IdeaTypeFilter | null;
  const lifecycleStage = idea.lifecycle_stage as LifecycleStageFilter | null;

  // Get relevant questions for this idea
  const questions = await getRelevantQuestions(ideaType, lifecycleStage);

  // Get all answers for this idea
  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Group questions by criterion
  const criterionGroups = new Map<string, QuestionWithCategory[]>();
  for (const q of questions) {
    const existing = criterionGroups.get(q.criterion) || [];
    existing.push(q);
    criterionGroups.set(q.criterion, existing);
  }

  // Calculate coverage per criterion
  const coverages: CriterionCoverage[] = [];
  for (const [criterion, qs] of criterionGroups) {
    const answered = qs.filter(q => answeredIds.has(q.id)).length;
    const total = qs.length;
    coverages.push({
      criterion,
      category: qs[0].category,
      answered,
      total,
      coverage: total > 0 ? answered / total : 0
    });
  }

  return coverages;
}

// Calculate weighted readiness score
export async function calculateReadiness(ideaId: string): Promise<ReadinessScore> {
  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return {
      overall: 0,
      byCategory: {
        problem: 0,
        solution: 0,
        feasibility: 0,
        fit: 0,
        market: 0,
        risk: 0,
        business_model: 0
      },
      readyForEvaluation: false,
      readinessLevel: 'SPARK',
      blockingGaps: ['Idea not found']
    };
  }

  const ideaType = idea.idea_type as IdeaTypeFilter | null;
  const lifecycleStage = idea.lifecycle_stage as LifecycleStageFilter | null;

  // Get relevant questions
  const questions = await getRelevantQuestions(ideaType, lifecycleStage);

  // Get answers
  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Calculate weighted scores per category
  const categoryScores: Record<QuestionCategory, { weight: number; answered: number }> = {
    problem: { weight: 0, answered: 0 },
    solution: { weight: 0, answered: 0 },
    feasibility: { weight: 0, answered: 0 },
    fit: { weight: 0, answered: 0 },
    market: { weight: 0, answered: 0 },
    risk: { weight: 0, answered: 0 },
    business_model: { weight: 0, answered: 0 }
  };

  // Calculate weighted coverage
  for (const q of questions) {
    const weight = PRIORITY_WEIGHTS[q.priority];
    categoryScores[q.category].weight += weight;
    if (answeredIds.has(q.id)) {
      categoryScores[q.category].answered += weight;
    }
  }

  // Calculate category percentages
  const byCategory = {
    problem: categoryScores.problem.weight > 0
      ? categoryScores.problem.answered / categoryScores.problem.weight
      : 0,
    solution: categoryScores.solution.weight > 0
      ? categoryScores.solution.answered / categoryScores.solution.weight
      : 0,
    feasibility: categoryScores.feasibility.weight > 0
      ? categoryScores.feasibility.answered / categoryScores.feasibility.weight
      : 0,
    fit: await hasLinkedProfile(ideaId) ? 1.0 : 0,
    market: categoryScores.market.weight > 0
      ? categoryScores.market.answered / categoryScores.market.weight
      : 0,
    risk: categoryScores.risk.weight > 0
      ? categoryScores.risk.answered / categoryScores.risk.weight
      : 0,
    business_model: categoryScores.business_model.weight > 0
      ? categoryScores.business_model.answered / categoryScores.business_model.weight
      : 0
  };

  // Calculate overall weighted average
  // Adjust weights based on idea type
  let adjustedWeights = { ...CATEGORY_WEIGHTS };
  if (ideaType === 'business') {
    // Business ideas should include business model
    adjustedWeights.business_model = 0.10;
    // Reduce other weights proportionally
    const reduction = 0.10 / 5;
    adjustedWeights.problem -= reduction;
    adjustedWeights.solution -= reduction;
    adjustedWeights.feasibility -= reduction;
    adjustedWeights.market -= reduction;
    adjustedWeights.risk -= reduction;
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const [category, weight] of Object.entries(adjustedWeights)) {
    totalWeight += weight;
    weightedSum += byCategory[category as keyof typeof byCategory] * weight;
  }

  const overall = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Determine readiness level
  let readinessLevel: 'SPARK' | 'CLARIFY' | 'READY' | 'CONFIDENT' = 'SPARK';
  if (overall >= READINESS_THRESHOLDS.READY) {
    readinessLevel = 'CONFIDENT';
  } else if (overall >= READINESS_THRESHOLDS.CLARIFY) {
    readinessLevel = 'READY';
  } else if (overall >= READINESS_THRESHOLDS.SPARK) {
    readinessLevel = 'CLARIFY';
  }

  // Identify blocking gaps (critical questions not answered)
  const blockingGaps: string[] = [];
  for (const q of questions) {
    if (q.priority === 'critical' && !answeredIds.has(q.id)) {
      blockingGaps.push(`${q.criterion}: ${q.text}`);
    }
  }

  // Limit to first 5 gaps
  const topGaps = blockingGaps.slice(0, 5);

  return {
    overall,
    byCategory,
    readyForEvaluation: overall >= READINESS_THRESHOLDS.CLARIFY,
    readinessLevel,
    blockingGaps: topGaps
  };
}

// Calculate and persist readiness to database
export async function calculateAndSaveReadiness(ideaId: string): Promise<ReadinessScore> {
  const readiness = await calculateReadiness(ideaId);
  const now = new Date().toISOString();

  // Check if record exists
  const existing = await getOne<DBReadiness>(
    'SELECT * FROM idea_readiness WHERE idea_id = ?',
    [ideaId]
  );

  if (existing) {
    await run(
      `UPDATE idea_readiness SET
        overall_readiness = ?,
        problem_coverage = ?,
        solution_coverage = ?,
        feasibility_coverage = ?,
        fit_coverage = ?,
        market_coverage = ?,
        risk_coverage = ?,
        business_model_coverage = ?,
        last_calculated = ?
       WHERE idea_id = ?`,
      [
        readiness.overall,
        readiness.byCategory.problem,
        readiness.byCategory.solution,
        readiness.byCategory.feasibility,
        readiness.byCategory.fit,
        readiness.byCategory.market,
        readiness.byCategory.risk,
        readiness.byCategory.business_model || 0,
        now,
        ideaId
      ]
    );
  } else {
    await run(
      `INSERT INTO idea_readiness
       (idea_id, overall_readiness, problem_coverage, solution_coverage,
        feasibility_coverage, fit_coverage, market_coverage, risk_coverage,
        business_model_coverage, last_calculated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ideaId,
        readiness.overall,
        readiness.byCategory.problem,
        readiness.byCategory.solution,
        readiness.byCategory.feasibility,
        readiness.byCategory.fit,
        readiness.byCategory.market,
        readiness.byCategory.risk,
        readiness.byCategory.business_model || 0,
        now
      ]
    );
  }

  await saveDb();
  return readiness;
}

// Get cached readiness (from database)
export async function getCachedReadiness(ideaId: string): Promise<ReadinessScore | null> {
  const row = await getOne<DBReadiness>(
    'SELECT * FROM idea_readiness WHERE idea_id = ?',
    [ideaId]
  );

  if (!row) return null;

  // Calculate blocking gaps (need to re-fetch)
  const readiness = await calculateReadiness(ideaId);

  return {
    overall: row.overall_readiness,
    byCategory: {
      problem: row.problem_coverage,
      solution: row.solution_coverage,
      feasibility: row.feasibility_coverage,
      fit: row.fit_coverage,
      market: row.market_coverage,
      risk: row.risk_coverage,
      business_model: row.business_model_coverage
    },
    readyForEvaluation: row.overall_readiness >= READINESS_THRESHOLDS.CLARIFY,
    readinessLevel: row.overall_readiness >= READINESS_THRESHOLDS.READY
      ? 'CONFIDENT'
      : row.overall_readiness >= READINESS_THRESHOLDS.CLARIFY
        ? 'READY'
        : row.overall_readiness >= READINESS_THRESHOLDS.SPARK
          ? 'CLARIFY'
          : 'SPARK',
    blockingGaps: readiness.blockingGaps
  };
}

// ==========================================
// DEVELOPMENT SESSIONS
// ==========================================

// Start a new development session
export async function startDevelopmentSession(ideaId: string): Promise<DevelopmentSession> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const readiness = await calculateReadiness(ideaId);

  await run(
    `INSERT INTO development_sessions
     (id, idea_id, started_at, readiness_before)
     VALUES (?, ?, ?, ?)`,
    [id, ideaId, now, readiness.overall]
  );

  await saveDb();

  return {
    id,
    ideaId,
    startedAt: now,
    completedAt: null,
    questionsAsked: 0,
    questionsAnswered: 0,
    readinessBefore: readiness.overall,
    readinessAfter: null
  };
}

// Complete a development session
export async function completeDevelopmentSession(
  sessionId: string
): Promise<DevelopmentSession | null> {
  interface DBSession {
    id: string;
    idea_id: string;
    started_at: string;
    completed_at: string | null;
    questions_asked: number;
    questions_answered: number;
    readiness_before: number | null;
    readiness_after: number | null;
  }

  const session = await getOne<DBSession>(
    'SELECT * FROM development_sessions WHERE id = ?',
    [sessionId]
  );

  if (!session) return null;

  const now = new Date().toISOString();
  const readiness = await calculateReadiness(session.idea_id);

  await run(
    `UPDATE development_sessions SET
      completed_at = ?,
      readiness_after = ?
     WHERE id = ?`,
    [now, readiness.overall, sessionId]
  );

  await saveDb();

  return {
    id: session.id,
    ideaId: session.idea_id,
    startedAt: session.started_at,
    completedAt: now,
    questionsAsked: session.questions_asked,
    questionsAnswered: session.questions_answered,
    readinessBefore: session.readiness_before,
    readinessAfter: readiness.overall
  };
}

// Increment session question counts
export async function updateSessionProgress(
  sessionId: string,
  asked: number,
  answered: number
): Promise<void> {
  await run(
    `UPDATE development_sessions SET
      questions_asked = questions_asked + ?,
      questions_answered = questions_answered + ?
     WHERE id = ?`,
    [asked, answered, sessionId]
  );
  await saveDb();
}

// Get session history for an idea
export async function getSessionHistory(ideaId: string): Promise<DevelopmentSession[]> {
  interface DBSession {
    id: string;
    idea_id: string;
    started_at: string;
    completed_at: string | null;
    questions_asked: number;
    questions_answered: number;
    readiness_before: number | null;
    readiness_after: number | null;
  }

  const rows = await query<DBSession>(
    'SELECT * FROM development_sessions WHERE idea_id = ? ORDER BY started_at DESC',
    [ideaId]
  );

  return rows.map(row => ({
    id: row.id,
    ideaId: row.idea_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    questionsAsked: row.questions_asked,
    questionsAnswered: row.questions_answered,
    readinessBefore: row.readiness_before,
    readinessAfter: row.readiness_after
  }));
}

// ==========================================
// SMART QUESTION SELECTION
// ==========================================

interface QuestionScore {
  question: QuestionWithCategory;
  score: number;
  reason: string;
}

interface SelectionOptions {
  focusCategory?: QuestionCategory;
  focusCriterion?: string;
  lastAnsweredQuestionId?: string;
  limit?: number;
  includeFollowUps?: boolean;
  skipDependencies?: boolean;
}

/**
 * Smart question selection algorithm
 *
 * Factors considered:
 * 1. Priority (critical = 100, important = 50, nice-to-have = 20)
 * 2. Category coverage (lower coverage = higher score, up to +50)
 * 3. Dependency satisfaction (must be satisfied to be eligible)
 * 4. Follow-up chaining (+30 if follow-up to recently answered)
 * 5. Question type balancing (+10 if underrepresented type)
 * 6. Focus area (+40 if matches focus category/criterion)
 */
export async function selectNextQuestions(
  ideaId: string,
  options: SelectionOptions = {}
): Promise<QuestionWithCategory[]> {
  const {
    focusCategory,
    focusCriterion,
    lastAnsweredQuestionId,
    limit = 5,
    includeFollowUps = true,
    skipDependencies = false
  } = options;

  const idea = await getIdeaById(ideaId);
  if (!idea) return [];

  const ideaType = idea.idea_type as IdeaTypeFilter | null;
  const lifecycleStage = idea.lifecycle_stage as LifecycleStageFilter | null;

  // Get all relevant questions
  const allQuestions = await getRelevantQuestions(ideaType, lifecycleStage);

  // Get existing answers
  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Get answer type distribution
  const answeredByType = {
    factual: 0,
    analytical: 0,
    reflective: 0
  };
  for (const q of allQuestions) {
    if (answeredIds.has(q.id)) {
      answeredByType[q.type]++;
    }
  }
  const totalAnswered = answeredByType.factual + answeredByType.analytical + answeredByType.reflective;

  // Calculate category coverage
  const categoryCoverage: Record<QuestionCategory, { answered: number; total: number }> = {
    problem: { answered: 0, total: 0 },
    solution: { answered: 0, total: 0 },
    feasibility: { answered: 0, total: 0 },
    fit: { answered: 0, total: 0 },
    market: { answered: 0, total: 0 },
    risk: { answered: 0, total: 0 },
    business_model: { answered: 0, total: 0 }
  };
  for (const q of allQuestions) {
    categoryCoverage[q.category].total++;
    if (answeredIds.has(q.id)) {
      categoryCoverage[q.category].answered++;
    }
  }

  // Get follow-ups from last answered question
  let lastQuestionFollowUps = new Set<string>();
  if (includeFollowUps && lastAnsweredQuestionId) {
    const lastQ = allQuestions.find(q => q.id === lastAnsweredQuestionId);
    if (lastQ?.follow_ups) {
      lastQuestionFollowUps = new Set(lastQ.follow_ups);
    }
  }

  // Score each unanswered question
  const scored: QuestionScore[] = [];

  for (const q of allQuestions) {
    // Skip already answered
    if (answeredIds.has(q.id)) continue;

    // Check dependencies - skip if not satisfied (unless skipDependencies is true)
    if (!skipDependencies && q.depends_on && q.depends_on.length > 0) {
      const allDependenciesMet = q.depends_on.every(depId => answeredIds.has(depId));
      if (!allDependenciesMet) continue;
    }

    let score = 0;
    let reason = '';

    // 1. Priority scoring (base score)
    const priorityScores = {
      critical: 100,
      important: 50,
      'nice-to-have': 20
    };
    score += priorityScores[q.priority];
    reason = `Priority: ${q.priority}`;

    // 2. Category coverage bonus (lower coverage = higher bonus)
    const catCov = categoryCoverage[q.category];
    const coveragePercent = catCov.total > 0 ? catCov.answered / catCov.total : 0;
    const coverageBonus = Math.round((1 - coveragePercent) * 50);
    if (coverageBonus > 0) {
      score += coverageBonus;
      reason += `, Low coverage in ${q.category}`;
    }

    // 3. Follow-up bonus
    if (lastQuestionFollowUps.has(q.id)) {
      score += 30;
      reason += ', Follow-up to previous';
    }

    // 4. Question type balancing
    if (totalAnswered > 0) {
      const typePercent = {
        factual: answeredByType.factual / totalAnswered,
        analytical: answeredByType.analytical / totalAnswered,
        reflective: answeredByType.reflective / totalAnswered
      };
      // Boost underrepresented types (target is ~33% each)
      if (typePercent[q.type] < 0.25) {
        score += 10;
        reason += `, Underrepresented type: ${q.type}`;
      }
    }

    // 5. Focus area bonus
    if (focusCategory && q.category === focusCategory) {
      score += 40;
      reason += ', Focus category match';
    }
    if (focusCriterion && q.criterion === focusCriterion) {
      score += 40;
      reason += ', Focus criterion match';
    }

    scored.push({ question: q, score, reason });
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top questions
  return scored.slice(0, limit).map(s => s.question);
}

/**
 * Get next questions after submitting an answer
 * Returns follow-up questions if available, otherwise uses smart selection
 */
export async function getNextQuestionsAfterAnswer(
  ideaId: string,
  answeredQuestionId: string,
  limit: number = 3
): Promise<QuestionWithCategory[]> {
  // First, try to get follow-up questions
  const allQuestions = await getRelevantQuestions(null, null);
  const answeredQuestion = allQuestions.find(q => q.id === answeredQuestionId);

  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  const followUps: QuestionWithCategory[] = [];
  if (answeredQuestion?.follow_ups) {
    for (const followUpId of answeredQuestion.follow_ups) {
      // Only include if not already answered
      if (!answeredIds.has(followUpId)) {
        const followUp = allQuestions.find(q => q.id === followUpId);
        if (followUp) {
          followUps.push(followUp);
        }
      }
    }
  }

  // If we have enough follow-ups, return them
  if (followUps.length >= limit) {
    return followUps.slice(0, limit);
  }

  // Otherwise, supplement with smart selection
  const remaining = limit - followUps.length;
  const smartSelection = await selectNextQuestions(ideaId, {
    lastAnsweredQuestionId: answeredQuestionId,
    limit: remaining + 5, // Get extras in case of overlap
    includeFollowUps: false // We already handled follow-ups
  });

  // Filter out any that are already in followUps
  const followUpIds = new Set(followUps.map(f => f.id));
  const filtered = smartSelection.filter(q => !followUpIds.has(q.id));

  return [...followUps, ...filtered.slice(0, remaining)];
}

/**
 * Get questions to improve a specific criterion score
 */
export async function getQuestionsForCriterion(
  ideaId: string,
  criterion: string,
  limit: number = 5
): Promise<QuestionWithCategory[]> {
  const idea = await getIdeaById(ideaId);
  if (!idea) return [];

  const ideaType = idea.idea_type as IdeaTypeFilter | null;
  const lifecycleStage = idea.lifecycle_stage as LifecycleStageFilter | null;

  const allQuestions = await getRelevantQuestions(ideaType, lifecycleStage);
  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  // Filter to criterion, unanswered, dependencies met
  const eligible = allQuestions.filter(q => {
    if (q.criterion !== criterion) return false;
    if (answeredIds.has(q.id)) return false;
    if (q.depends_on && !q.depends_on.every(d => answeredIds.has(d))) return false;
    return true;
  });

  // Sort by priority
  const priorityOrder = { critical: 0, important: 1, 'nice-to-have': 2 };
  eligible.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return eligible.slice(0, limit);
}

/**
 * Get a balanced set of questions across all categories
 * Useful for initial development sessions
 */
export async function getBalancedQuestions(
  ideaId: string,
  questionsPerCategory: number = 2,
  skipDependencies: boolean = false
): Promise<QuestionWithCategory[]> {
  const idea = await getIdeaById(ideaId);
  if (!idea) return [];

  const ideaType = idea.idea_type as IdeaTypeFilter | null;
  const lifecycleStage = idea.lifecycle_stage as LifecycleStageFilter | null;

  const allQuestions = await getRelevantQuestions(ideaType, lifecycleStage);
  const answers = await getAnswersForIdea(ideaId);
  const answeredIds = new Set(answers.map(a => a.questionId));

  const categories: QuestionCategory[] = [
    'problem', 'solution', 'feasibility', 'market', 'risk'
  ];

  // Add business_model for business ideas
  if (ideaType === 'business') {
    categories.push('business_model');
  }

  const result: QuestionWithCategory[] = [];

  for (const category of categories) {
    const categoryQuestions = allQuestions
      .filter(q => {
        if (q.category !== category) return false;
        if (answeredIds.has(q.id)) return false;
        // Check dependencies unless skipDependencies is true
        if (!skipDependencies && q.depends_on && !q.depends_on.every(d => answeredIds.has(d))) return false;
        return true;
      })
      .sort((a, b) => {
        // Critical first, then important, then nice-to-have
        const priorityOrder = { critical: 0, important: 1, 'nice-to-have': 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    result.push(...categoryQuestions.slice(0, questionsPerCategory));
  }

  return result;
}
