// Lifecycle stages for ideas
export type LifecycleStage =
  | "SPARK"
  | "CLARIFY"
  | "RESEARCH"
  | "IDEATE"
  | "EVALUATE"
  | "VALIDATE"
  | "DESIGN"
  | "PROTOTYPE"
  | "TEST"
  | "REFINE"
  | "BUILD"
  | "LAUNCH"
  | "GROW"
  | "MAINTAIN"
  | "PIVOT"
  | "PAUSE"
  | "SUNSET"
  | "ARCHIVE"
  | "ABANDONED";

// Idea types
export type IdeaType =
  | "business"
  | "creative"
  | "technical"
  | "personal"
  | "research";

// Evaluation categories
export type EvaluationCategory =
  | "problem"
  | "solution"
  | "feasibility"
  | "fit"
  | "market"
  | "risk";

// Recommendation types
export type Recommendation = "PURSUE" | "REFINE" | "PAUSE" | "ABANDON";

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

// Idea status for lifecycle management
export type IdeaStatus =
  | "active"
  | "paused"
  | "abandoned"
  | "completed"
  | "archived";

// Idea with computed scores
export interface IdeaWithScores extends Idea {
  avg_agent_score: number | null;
  avg_user_score: number | null;
  avg_final_score: number | null;
  avg_confidence: number | null;
  tags: string[];
  // Latest run tracking (scores are from most recent evaluation only)
  latest_run_id?: string | null;
  total_evaluation_count?: number;
  // Lifecycle fields
  status?: IdeaStatus;
  status_reason?: string | null;
  current_version?: number;
  iteration_number?: number;
  parent_idea_id?: string | null;
  incubation_phase?: string;
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
  initial_score: number; // Score when reasoning was written (pre-debate)
  final_score: number; // Score after debate adjustments
  confidence: number;
  reasoning: string; // Reasoning matches initial_score, not final_score
  created_at: string;
}

// Category scores grouped
export interface CategoryScore {
  category: EvaluationCategory;
  avg_score: number;
  avg_initial_score?: number; // Pre-debate score for before/after comparison
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
  arbiter_verdict: "EVALUATOR" | "RED_TEAM" | "DRAW" | null;
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
  persona:
    | "skeptic"
    | "realist"
    | "first_principles"
    | "competitor"
    | "contrarian"
    | "edge_case";
  challenge: string;
  severity: "low" | "medium" | "high" | "critical";
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
  relationship_type:
    | "parent"
    | "child"
    | "related"
    | "combines"
    | "conflicts"
    | "inspired_by";
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
  source: "ai" | "user";
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
  sortBy?: "title" | "created_at" | "updated_at" | "score";
  sortOrder?: "asc" | "desc";
}

// Score interpretation helpers
export const scoreInterpretation = {
  getLevel: (score: number): string => {
    if (score >= 8.0) return "Excellent";
    if (score >= 7.0) return "Strong";
    if (score >= 6.0) return "Promising";
    if (score >= 5.0) return "Uncertain";
    if (score >= 4.0) return "Weak";
    return "Poor";
  },
  getColor: (score: number): string => {
    if (score >= 8.0) return "text-score-excellent";
    if (score >= 7.0) return "text-score-strong";
    if (score >= 6.0) return "text-score-promising";
    if (score >= 5.0) return "text-score-uncertain";
    if (score >= 4.0) return "text-score-weak";
    return "text-score-poor";
  },
  getBgColor: (score: number): string => {
    if (score >= 8.0) return "bg-green-500";
    if (score >= 7.0) return "bg-lime-500";
    if (score >= 6.0) return "bg-yellow-500";
    if (score >= 5.0) return "bg-orange-500";
    if (score >= 4.0) return "bg-red-500";
    return "bg-red-900";
  },
};

// Lifecycle stage metadata
export const lifecycleStages: Record<
  LifecycleStage,
  { label: string; order: number; color: string }
> = {
  SPARK: { label: "Spark", order: 1, color: "bg-purple-500" },
  CLARIFY: { label: "Clarify", order: 2, color: "bg-indigo-500" },
  RESEARCH: { label: "Research", order: 3, color: "bg-blue-500" },
  IDEATE: { label: "Ideate", order: 4, color: "bg-cyan-500" },
  EVALUATE: { label: "Evaluate", order: 5, color: "bg-teal-500" },
  VALIDATE: { label: "Validate", order: 6, color: "bg-green-500" },
  DESIGN: { label: "Design", order: 7, color: "bg-lime-500" },
  PROTOTYPE: { label: "Prototype", order: 8, color: "bg-yellow-500" },
  TEST: { label: "Test", order: 9, color: "bg-amber-500" },
  REFINE: { label: "Refine", order: 10, color: "bg-orange-500" },
  BUILD: { label: "Build", order: 11, color: "bg-red-500" },
  LAUNCH: { label: "Launch", order: 12, color: "bg-rose-500" },
  GROW: { label: "Grow", order: 13, color: "bg-pink-500" },
  MAINTAIN: { label: "Maintain", order: 14, color: "bg-fuchsia-500" },
  PIVOT: { label: "Pivot", order: 15, color: "bg-violet-500" },
  PAUSE: { label: "Pause", order: 16, color: "bg-gray-500" },
  SUNSET: { label: "Sunset", order: 17, color: "bg-slate-500" },
  ARCHIVE: { label: "Archive", order: 18, color: "bg-zinc-500" },
  ABANDONED: { label: "Abandoned", order: 19, color: "bg-stone-500" },
};

// Category weights for weighted average
export const categoryWeights: Record<EvaluationCategory, number> = {
  problem: 0.2,
  solution: 0.2,
  feasibility: 0.15,
  fit: 0.15,
  market: 0.15,
  risk: 0.15,
};

// ==========================================
// DYNAMIC QUESTIONING TYPES
// ==========================================

// Question type
export type QuestionType = "factual" | "analytical" | "reflective";

// Priority levels
export type QuestionPriority = "critical" | "important" | "nice-to-have";

// Question categories
export type QuestionCategory =
  | "problem"
  | "solution"
  | "feasibility"
  | "fit"
  | "market"
  | "risk"
  | "business_model";

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
  answerSource: "user" | "ai_extracted" | "ai_inferred";
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
  readinessLevel: "SPARK" | "CLARIFY" | "READY" | "CONFIDENT";
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
export const readinessLevels: Record<
  ReadinessScore["readinessLevel"],
  { label: string; color: string; description: string }
> = {
  SPARK: {
    label: "Spark",
    color: "bg-purple-500",
    description: "Too early for meaningful evaluation",
  },
  CLARIFY: {
    label: "Clarify",
    color: "bg-blue-500",
    description: "Needs more development",
  },
  READY: {
    label: "Ready",
    color: "bg-green-500",
    description: "Can evaluate with caveats",
  },
  CONFIDENT: {
    label: "Confident",
    color: "bg-emerald-500",
    description: "Full evaluation possible",
  },
};

// Priority metadata
export const priorityMeta: Record<
  QuestionPriority,
  { label: string; color: string; weight: number }
> = {
  critical: { label: "Critical", color: "text-red-600", weight: 3 },
  important: { label: "Important", color: "text-amber-600", weight: 2 },
  "nice-to-have": { label: "Nice to Have", color: "text-gray-500", weight: 1 },
};

// Category display names
export const categoryNames: Record<QuestionCategory, string> = {
  problem: "Problem",
  solution: "Solution",
  feasibility: "Feasibility",
  fit: "Personal Fit",
  market: "Market",
  risk: "Risk",
  business_model: "Business Model",
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
  // Extended financial fields
  current_annual_income?: number | null;
  monthly_burn_rate?: number | null;
  has_alternative_income?: boolean;
  total_investment_capacity?: number | null;
  debt_tolerance?: "none" | "low" | "moderate" | "high" | null;
  willingness_to_raise_funding?: boolean;
  lifestyle_income_target?: number | null;
}

// ==========================================
// STRATEGIC APPROACH TYPES
// ==========================================

export type StrategicApproach =
  | "create"
  | "copy_improve"
  | "combine"
  | "localize"
  | "specialize"
  | "time";

export const strategicApproachMeta: Record<
  StrategicApproach,
  {
    label: string;
    description: string;
    bestFor: string;
    riskLevel: "low" | "medium" | "high";
    timeToRevenue: string;
  }
> = {
  create: {
    label: "Create",
    description: "Build something genuinely new",
    bestFor: "VC-backed, long runway, high risk tolerance",
    riskLevel: "high",
    timeToRevenue: "12-24+ months",
  },
  copy_improve: {
    label: "Copy & Improve",
    description: "Take proven model, execute better",
    bestFor: "Bootstrapped, income goals, proven demand",
    riskLevel: "low",
    timeToRevenue: "3-6 months",
  },
  combine: {
    label: "Combine",
    description: "Merge two validated concepts",
    bestFor: "Unique insight at intersection",
    riskLevel: "medium",
    timeToRevenue: "6-12 months",
  },
  localize: {
    label: "Localize",
    description: "Proven model, new geography/segment",
    bestFor: "Local market knowledge",
    riskLevel: "low",
    timeToRevenue: "3-6 months",
  },
  specialize: {
    label: "Specialize",
    description: "Narrow general solution to niche",
    bestFor: "Deep domain expertise",
    riskLevel: "low",
    timeToRevenue: "4-8 months",
  },
  time: {
    label: "Time",
    description: "Retry failed concept, market now ready",
    bestFor: "Timing insight, patience",
    riskLevel: "high",
    timeToRevenue: "Variable",
  },
};

// ==========================================
// FINANCIAL ALLOCATION TYPES
// ==========================================

export type AllocationPriority =
  | "primary"
  | "secondary"
  | "exploration"
  | "parked";
export type IncomeType =
  | "full_replacement"
  | "partial_replacement"
  | "supplement"
  | "wealth_building"
  | "learning";
export type PivotWillingness =
  | "rigid"
  | "moderate"
  | "flexible"
  | "very_flexible";
export type RiskTolerance = "low" | "medium" | "high" | "very_high";

export interface IdeaFinancialAllocation {
  id?: string;
  ideaId: string;
  allocatedBudget: number;
  allocatedWeeklyHours: number;
  allocatedRunwayMonths: number;
  allocationPriority: AllocationPriority;
  targetIncomeFromIdea: number | null;
  incomeTimelineMonths: number | null;
  incomeType: IncomeType;
  exitIntent: boolean;
  ideaRiskTolerance: RiskTolerance | null;
  maxAcceptableLoss: number | null;
  pivotWillingness: PivotWillingness;
  validationBudget: number;
  maxTimeToValidateMonths: number | null;
  killCriteria: string | null;
  strategicApproach: StrategicApproach | null;
  approachRationale: string | null;
  createdAt?: string;
  updatedAt?: string;
  exists?: boolean;
}

export const allocationPriorityMeta: Record<
  AllocationPriority,
  { label: string; description: string; color: string }
> = {
  primary: {
    label: "Primary",
    description: "Main focus",
    color: "bg-green-500",
  },
  secondary: {
    label: "Secondary",
    description: "Active but not main",
    color: "bg-blue-500",
  },
  exploration: {
    label: "Exploration",
    description: "Testing viability",
    color: "bg-yellow-500",
  },
  parked: { label: "Parked", description: "On hold", color: "bg-gray-500" },
};

export const incomeTypeMeta: Record<
  IncomeType,
  { label: string; description: string }
> = {
  full_replacement: {
    label: "Full Replacement",
    description: "This idea replaces your job",
  },
  partial_replacement: {
    label: "Partial Replacement",
    description: "This idea + other income = target",
  },
  supplement: { label: "Supplement", description: "Extra income on top" },
  wealth_building: {
    label: "Wealth Building",
    description: "Equity play, income later",
  },
  learning: { label: "Learning", description: "Not income focused" },
};

// ==========================================
// POSITIONING DECISION TYPES
// ==========================================

export type TimingDecision = "proceed_now" | "wait" | "urgent";

export interface PositioningDecision {
  id?: string;
  ideaId: string;
  primaryStrategyId: string | null;
  primaryStrategyName: string | null;
  secondaryStrategyId: string | null;
  secondaryStrategyName: string | null;
  acknowledgedRiskIds: string[]; // DEPRECATED - kept for backward compatibility
  riskResponses?: RiskResponse[]; // New structured responses
  riskResponseStats?: RiskResponseStats; // Quick stats lookup
  timingDecision: TimingDecision | null;
  timingRationale: string | null;
  selectedApproach: StrategicApproach | null;
  notes: string | null;
  createdAt?: string;
  updatedAt?: string;
  exists?: boolean;
}

// ==========================================
// ENHANCED STRATEGY TYPES (with financial viability)
// ==========================================

export interface RevenueEstimate {
  year1: { low: number; mid: number; high: number };
  year3: { low: number; mid: number; high: number };
  assumptions: string[];
}

export interface GoalAlignment {
  meetsIncomeTarget: boolean;
  gapToTarget: number | null;
  timelineAlignment: "faster" | "aligned" | "slower" | "unlikely";
  runwaySufficient: boolean;
  investmentFeasible: boolean;
}

export interface AllocationFeasibility {
  budgetSufficient: boolean;
  budgetGap: number | null;
  timeSufficient: boolean;
  timeGap: number | null;
  runwaySufficient: boolean;
  runwayGap: number | null;
  overallFeasible: boolean;
  adjustmentOptions: Array<{
    type:
      | "increase_allocation"
      | "reduce_scope"
      | "extend_timeline"
      | "seek_funding";
    description: string;
    newRequirement: number;
  }>;
}

export interface ProfileFitBreakdown {
  score: number;
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

export interface EnhancedStrategy {
  id?: string;
  name: string;
  description: string;
  differentiators: string[];
  tradeoffs: string[];
  fitWithProfile: number;
  fiveWH?: {
    what?: string;
    why?: string;
    how?: string;
    when?: string;
    where?: string;
    howMuch?: string;
  };
  // Relationship tracking
  addressesOpportunities?: string[];
  mitigatesRisks?: string[];
  timingAlignment?: "favorable" | "neutral" | "challenging";
  // Financial analysis
  revenueEstimates?: RevenueEstimate;
  goalAlignment?: GoalAlignment;
  allocationFeasibility?: AllocationFeasibility;
  profileFitBreakdown?: ProfileFitBreakdown;
}

export interface StrategicSummary {
  recommendedStrategy: {
    id: string;
    name: string;
    fitScore: number;
    reason: string;
  };
  primaryOpportunity: {
    id: string;
    segment: string;
    fit: "high" | "medium" | "low";
  };
  criticalRisk: {
    id: string;
    description: string;
    severity: "high" | "medium" | "low";
    mitigation: string;
  };
  timingAssessment: {
    urgency: "high" | "medium" | "low";
    window: string;
  };
  overallConfidence: number;
}

// Incubation phases - now includes 'position' (replaces 'differentiation')
export type IncubationPhase =
  | "capture"
  | "clarify"
  | "position"
  | "update"
  | "evaluate"
  | "iterate";

// For backward compatibility
export type LegacyIncubationPhase =
  | "capture"
  | "clarify"
  | "differentiation"
  | "update"
  | "evaluate"
  | "iterate";

export const incubationPhases: Array<{
  phase: IncubationPhase;
  label: string;
  description: string;
}> = [
  { phase: "capture", label: "Capture", description: "Initial idea capture" },
  {
    phase: "clarify",
    label: "Clarify",
    description: "Answer questions to clarify the idea",
  },
  {
    phase: "position",
    label: "Position",
    description: "Choose strategic positioning",
  },
  {
    phase: "update",
    label: "Update",
    description: "Refine idea based on positioning",
  },
  {
    phase: "evaluate",
    label: "Evaluate",
    description: "Full evaluation against 30 criteria",
  },
  {
    phase: "iterate",
    label: "Iterate",
    description: "Address weak areas and iterate",
  },
];

// ==========================================
// COMPETITIVE ANALYSIS TYPES
// ==========================================

export interface ValidatedOpportunity {
  id: string;
  targetSegment: string;
  description: string;
  potentialImpact: "high" | "medium" | "low";
  feasibility: "high" | "medium" | "low";
  marketSize?: string;
  timing?: string;
  validationConfidence?: number;
  validationWarnings?: string[];
  why?: string;
  sourceStrategyId?: string;
}

export interface CompetitiveRisk {
  id: string;
  competitor: string;
  type:
    | "direct_competition"
    | "feature_parity"
    | "price_war"
    | "market_saturation"
    | "substitution";
  threat: string;
  severity: "high" | "medium" | "low";
  mitigation?: string;
  timeframe?: string;
}

// ==========================================
// RISK RESPONSE TYPES
// ==========================================

// 5 response options for risks
export type RiskResponseType =
  | "mitigate"
  | "accept"
  | "monitor"
  | "disagree"
  | "skip";

// Structured disagreement reasons
export type DisagreeReason =
  | "not_applicable" // This doesn't apply to my situation
  | "already_addressed" // Already handling this
  | "low_likelihood" // AI overestimated the likelihood
  | "insider_knowledge" // I have info the AI doesn't
  | "other"; // Custom reason

// Individual risk response
export interface RiskResponse {
  riskId: string;
  riskDescription: string; // Store for context
  riskSeverity: "high" | "medium" | "low";
  response: RiskResponseType;
  disagreeReason?: DisagreeReason;
  reasoning?: string; // Freetext explanation
  mitigationPlan?: string; // For mitigate/monitor
  respondedAt: string; // ISO timestamp
}

// Stats for quick access
export interface RiskResponseStats {
  total: number;
  responded: number;
  mitigate: number;
  accept: number;
  monitor: number;
  disagree: number;
  skipped: number;
}

// Response metadata for display
export const riskResponseMeta: Record<
  RiskResponseType,
  {
    label: string;
    icon: string;
    description: string;
    color: string;
    bgColor: string;
  }
> = {
  mitigate: {
    label: "Mitigate",
    icon: "🛡️",
    description: "I will actively address this risk",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  accept: {
    label: "Accept",
    icon: "✓",
    description: "I accept this risk as-is",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
  },
  monitor: {
    label: "Monitor",
    icon: "👁️",
    description: "I will watch this closely",
    color: "text-yellow-700",
    bgColor: "bg-yellow-50 border-yellow-200",
  },
  disagree: {
    label: "Disagree",
    icon: "✗",
    description: "I don't think this applies",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  skip: {
    label: "Skip",
    icon: "⏭️",
    description: "Skip for now",
    color: "text-gray-500",
    bgColor: "bg-gray-50 border-gray-200",
  },
};

// Disagree reason metadata
export const disagreeReasonMeta: Record<
  DisagreeReason,
  {
    label: string;
    description: string;
  }
> = {
  not_applicable: {
    label: "Not applicable",
    description: "This risk doesn't apply to my situation",
  },
  already_addressed: {
    label: "Already addressed",
    description: "I'm already handling this",
  },
  low_likelihood: {
    label: "Low likelihood",
    description: "AI overestimated the probability",
  },
  insider_knowledge: {
    label: "Insider knowledge",
    description: "I have information the AI doesn't",
  },
  other: {
    label: "Other",
    description: "Different reason (explain below)",
  },
};

// ==========================================
// IDEATION TYPES (Re-exported from root)
// ==========================================

// Core Ideation Types
export type SessionStatus = "active" | "completed" | "abandoned";
export type SessionPhase =
  | "exploring"
  | "narrowing"
  | "validating"
  | "refining";
export type CandidateStatus =
  | "forming"
  | "active"
  | "captured"
  | "discarded"
  | "saved";
export type RiskType =
  | "impossible"
  | "unrealistic"
  | "too_complex"
  | "too_vague"
  | "saturated_market"
  | "wrong_timing"
  | "resource_mismatch";
export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type ButtonStyle = "primary" | "secondary" | "outline" | "danger";

export interface IdeaCandidate {
  id: string;
  sessionId: string;
  title: string;
  summary: string | null;
  confidence: number; // 0-100
  viability: number; // 0-100
  userSuggested: boolean;
  status: CandidateStatus;
  capturedIdeaId: string | null;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ViabilityRisk {
  id: string;
  candidateId: string;
  riskType: RiskType;
  description: string;
  evidenceUrl: string | null;
  evidenceText: string | null;
  severity: RiskSeverity;
  userAcknowledged: boolean;
  userResponse: string | null;
  createdAt: Date | string;
}

export interface ButtonOption {
  id: string;
  label: string;
  value: string;
  style: ButtonStyle;
  fullWidth?: boolean;
  icon?: string;
  disabled?: boolean;
}

export interface FormField {
  id: string;
  type:
    | "text"
    | "textarea"
    | "radio"
    | "checkbox"
    | "slider"
    | "dropdown"
    | "date";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: FormFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
}

export interface FormFieldOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormDefinition {
  id: string;
  title?: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedDate?: string;
}
