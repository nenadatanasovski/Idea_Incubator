// Lifecycle stages for ideas
export type LifecycleStage =
  | 'SPARK'
  | 'CLARIFY'
  | 'RESEARCH'
  | 'IDEATE'
  | 'EVALUATE'
  | 'VALIDATE'
  | 'DESIGN'
  | 'PROTOTYPE'
  | 'TEST'
  | 'REFINE'
  | 'BUILD'
  | 'LAUNCH'
  | 'GROW'
  | 'MAINTAIN'
  | 'PIVOT'
  | 'PAUSE'
  | 'SUNSET'
  | 'ARCHIVE'
  | 'ABANDONED';

// Idea types
export type IdeaType = 'business' | 'creative' | 'technical' | 'personal' | 'research';

// Evaluation categories
export type EvaluationCategory =
  | 'problem'
  | 'solution'
  | 'feasibility'
  | 'fit'
  | 'market'
  | 'risk';

// Recommendation types
export type Recommendation = 'PURSUE' | 'REFINE' | 'PAUSE' | 'ABANDON';

// Core idea from database
export interface Idea {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  idea_type: IdeaType;
  lifecycle_stage: LifecycleStage;
  content: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

// Idea with computed scores
export interface IdeaWithScores extends Idea {
  avg_agent_score: number | null;
  avg_user_score: number | null;
  avg_final_score: number | null;
  avg_confidence: number | null;
  tags: string[];
}

// Individual evaluation
export interface Evaluation {
  id: number;
  idea_id: string;
  run_id: string;
  criterion: string;
  category: EvaluationCategory;
  agent_score: number;
  user_score: number | null;
  final_score: number;
  confidence: number;
  reasoning: string;
  created_at: string;
}

// Category scores grouped
export interface CategoryScore {
  category: EvaluationCategory;
  avg_score: number;
  avg_confidence: number;
  criteria: Evaluation[];
}

// Debate round
export interface DebateRound {
  id: number;
  idea_id: string;
  evaluation_run_id: string;
  round_number: number;
  criterion: string;
  challenge_number: number;
  evaluator_claim: string | null;
  redteam_persona: string | null;
  redteam_challenge: string | null;
  evaluator_defense: string | null;
  arbiter_verdict: 'EVALUATOR' | 'RED_TEAM' | 'DRAW' | null;
  first_principles_bonus: boolean;
  score_adjustment: number;
  timestamp: string;
}

// Red team challenge
export interface RedTeamChallenge {
  id: number;
  idea_id: string;
  run_id: string;
  criterion: string;
  category: EvaluationCategory;
  persona: 'skeptic' | 'realist' | 'first_principles' | 'competitor' | 'contrarian' | 'edge_case';
  challenge: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  addressed: boolean;
  resolution: string | null;
  created_at: string;
  is_preliminary?: boolean;
}

// Final synthesis
export interface Synthesis {
  id: number;
  idea_id: string;
  run_id: string;
  overall_score: number;
  confidence: number;
  executive_summary: string;
  key_strengths: string[];
  key_weaknesses: string[];
  critical_assumptions: string[];
  unresolved_questions: string[];
  recommendation: Recommendation;
  recommendation_reasoning: string;
  locked: boolean;
  locked_at: string | null;
  created_at: string;
  is_preliminary?: boolean;
}

// Tag
export interface Tag {
  id: number;
  name: string;
  category: string | null;
}

// Relationship between ideas
export interface IdeaRelationship {
  source_idea_id: string;
  target_idea_id: string;
  relationship_type: 'parent' | 'child' | 'related' | 'combines' | 'conflicts' | 'inspired_by';
  target_title: string;
  target_slug: string;
}

// Cost log entry
export interface CostEntry {
  id: number;
  run_id: string;
  idea_id: string;
  agent_type: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

// Development log entry
export interface DevelopmentEntry {
  id: number;
  idea_id: string;
  question: string;
  answer: string | null;
  source: 'ai' | 'user';
  created_at: string;
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Filter options for idea list
export interface IdeaFilters {
  type?: IdeaType;
  stage?: LifecycleStage;
  tag?: string;
  search?: string;
  sortBy?: 'title' | 'created_at' | 'updated_at' | 'score';
  sortOrder?: 'asc' | 'desc';
}

// Score interpretation helpers
export const scoreInterpretation = {
  getLevel: (score: number): string => {
    if (score >= 8.0) return 'Excellent';
    if (score >= 7.0) return 'Strong';
    if (score >= 6.0) return 'Promising';
    if (score >= 5.0) return 'Uncertain';
    if (score >= 4.0) return 'Weak';
    return 'Poor';
  },
  getColor: (score: number): string => {
    if (score >= 8.0) return 'text-score-excellent';
    if (score >= 7.0) return 'text-score-strong';
    if (score >= 6.0) return 'text-score-promising';
    if (score >= 5.0) return 'text-score-uncertain';
    if (score >= 4.0) return 'text-score-weak';
    return 'text-score-poor';
  },
  getBgColor: (score: number): string => {
    if (score >= 8.0) return 'bg-green-500';
    if (score >= 7.0) return 'bg-lime-500';
    if (score >= 6.0) return 'bg-yellow-500';
    if (score >= 5.0) return 'bg-orange-500';
    if (score >= 4.0) return 'bg-red-500';
    return 'bg-red-900';
  },
};

// Lifecycle stage metadata
export const lifecycleStages: Record<LifecycleStage, { label: string; order: number; color: string }> = {
  SPARK: { label: 'Spark', order: 1, color: 'bg-purple-500' },
  CLARIFY: { label: 'Clarify', order: 2, color: 'bg-indigo-500' },
  RESEARCH: { label: 'Research', order: 3, color: 'bg-blue-500' },
  IDEATE: { label: 'Ideate', order: 4, color: 'bg-cyan-500' },
  EVALUATE: { label: 'Evaluate', order: 5, color: 'bg-teal-500' },
  VALIDATE: { label: 'Validate', order: 6, color: 'bg-green-500' },
  DESIGN: { label: 'Design', order: 7, color: 'bg-lime-500' },
  PROTOTYPE: { label: 'Prototype', order: 8, color: 'bg-yellow-500' },
  TEST: { label: 'Test', order: 9, color: 'bg-amber-500' },
  REFINE: { label: 'Refine', order: 10, color: 'bg-orange-500' },
  BUILD: { label: 'Build', order: 11, color: 'bg-red-500' },
  LAUNCH: { label: 'Launch', order: 12, color: 'bg-rose-500' },
  GROW: { label: 'Grow', order: 13, color: 'bg-pink-500' },
  MAINTAIN: { label: 'Maintain', order: 14, color: 'bg-fuchsia-500' },
  PIVOT: { label: 'Pivot', order: 15, color: 'bg-violet-500' },
  PAUSE: { label: 'Pause', order: 16, color: 'bg-gray-500' },
  SUNSET: { label: 'Sunset', order: 17, color: 'bg-slate-500' },
  ARCHIVE: { label: 'Archive', order: 18, color: 'bg-zinc-500' },
  ABANDONED: { label: 'Abandoned', order: 19, color: 'bg-stone-500' },
};

// Category weights for weighted average
export const categoryWeights: Record<EvaluationCategory, number> = {
  problem: 0.20,
  solution: 0.20,
  feasibility: 0.15,
  fit: 0.15,
  market: 0.15,
  risk: 0.15,
};

// ==========================================
// DYNAMIC QUESTIONING TYPES
// ==========================================

// Question type
export type QuestionType = 'factual' | 'analytical' | 'reflective';

// Priority levels
export type QuestionPriority = 'critical' | 'important' | 'nice-to-have';

// Question categories
export type QuestionCategory = 'problem' | 'solution' | 'feasibility' | 'fit' | 'market' | 'risk' | 'business_model';

// Question from question bank
export interface Question {
  id: string;
  criterion: string;
  category: QuestionCategory;
  text: string;
  type: QuestionType;
  priority: QuestionPriority;
  idea_types: IdeaType[] | null;
  lifecycle_stages: LifecycleStage[] | null;
  depends_on: string[] | null;
  follow_ups: string[] | null;
}

// Answer to a question
export interface Answer {
  id: string;
  ideaId: string;
  questionId: string;
  answer: string;
  answerSource: 'user' | 'ai_extracted' | 'ai_inferred';
  confidence: number;
  answeredAt: string;
  updatedAt: string;
  question?: Question;
}

// Readiness score
export interface ReadinessScore {
  overall: number;
  byCategory: {
    problem: number;
    solution: number;
    feasibility: number;
    fit: number;
    market: number;
    risk: number;
    business_model?: number;
  };
  readyForEvaluation: boolean;
  readinessLevel: 'SPARK' | 'CLARIFY' | 'READY' | 'CONFIDENT';
  blockingGaps: string[];
}

// Criterion coverage
export interface CriterionCoverage {
  criterion: string;
  category: QuestionCategory;
  answered: number;
  total: number;
  coverage: number;
}

// Development session
export interface DevelopmentSession {
  id: string;
  ideaId: string;
  startedAt: string;
  completedAt: string | null;
  questionsAsked: number;
  questionsAnswered: number;
  readinessBefore: number | null;
  readinessAfter: number | null;
}

// Questions response
export interface QuestionsResponse {
  questions: Question[];
  readiness: ReadinessScore;
  coverage: CriterionCoverage[];
  totalQuestions: number;
  answeredCount: number;
  answeredIds: string[];
  remainingCount: number;
}

// Answer submission response
export interface AnswerSubmitResponse {
  answer: Answer;
  readiness: ReadinessScore;
  nextQuestions: Question[];
}

// Readiness level metadata
export const readinessLevels: Record<ReadinessScore['readinessLevel'], { label: string; color: string; description: string }> = {
  SPARK: { label: 'Spark', color: 'bg-purple-500', description: 'Too early for meaningful evaluation' },
  CLARIFY: { label: 'Clarify', color: 'bg-blue-500', description: 'Needs more development' },
  READY: { label: 'Ready', color: 'bg-green-500', description: 'Can evaluate with caveats' },
  CONFIDENT: { label: 'Confident', color: 'bg-emerald-500', description: 'Full evaluation possible' },
};

// Priority metadata
export const priorityMeta: Record<QuestionPriority, { label: string; color: string; weight: number }> = {
  critical: { label: 'Critical', color: 'text-red-600', weight: 3 },
  important: { label: 'Important', color: 'text-amber-600', weight: 2 },
  'nice-to-have': { label: 'Nice to Have', color: 'text-gray-500', weight: 1 },
};

// Category display names
export const categoryNames: Record<QuestionCategory, string> = {
  problem: 'Problem',
  solution: 'Solution',
  feasibility: 'Feasibility',
  fit: 'Personal Fit',
  market: 'Market',
  risk: 'Risk',
  business_model: 'Business Model',
};

// User profile summary for linking
export interface UserProfileSummary {
  id: string;
  name: string;
  slug: string;
  primary_goals: string; // JSON string
  success_definition: string | null;
  interests: string | null;
  technical_skills: string | null;
  professional_experience: string | null;
  domain_expertise: string | null;
  employment_status: string | null;
  weekly_hours_available: number | null;
  risk_tolerance: string | null;
  updated_at: string;
}
