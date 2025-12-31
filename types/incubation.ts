/**
 * Incubation System Types
 *
 * Types for the idea lifecycle system including:
 * - Status and phase management
 * - Gap analysis and assumptions
 * - Soft gates and advisories
 * - Versioning
 * - Iteration tracking
 * - Lineage and branching
 */

import { z } from 'zod';

// ============================================================================
// Status and Phase Enums
// ============================================================================

export const IdeaStatusSchema = z.enum(['active', 'paused', 'abandoned', 'completed', 'archived']);
export type IdeaStatus = z.infer<typeof IdeaStatusSchema>;

// Note: 'position' replaces 'differentiation' as the phase name
export const IncubationPhaseSchema = z.enum(['capture', 'clarify', 'position', 'update', 'evaluate', 'iterate']);
export type IncubationPhase = z.infer<typeof IncubationPhaseSchema>;

// Legacy alias for backward compatibility
export const LegacyIncubationPhaseSchema = z.enum(['capture', 'clarify', 'differentiation', 'update', 'evaluate', 'iterate']);

// ============================================================================
// Strategic Approach Types
// ============================================================================

export const StrategicApproachSchema = z.enum([
  'create',         // Build something genuinely new - for VC-backed, long runway
  'copy_improve',   // Take proven model, execute better - for bootstrapped, income goals
  'combine',        // Merge two validated concepts - for unique insight at intersection
  'localize',       // Proven model, new geography/segment - for local market knowledge
  'specialize',     // Narrow general solution to niche - for deep domain expertise
  'time'            // Retry failed concept, market now ready - for timing insight
]);
export type StrategicApproach = z.infer<typeof StrategicApproachSchema>;

// Strategic approach metadata
export const STRATEGIC_APPROACH_META: Record<StrategicApproach, {
  label: string;
  description: string;
  bestFor: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeToRevenue: string;
}> = {
  create: {
    label: 'Create',
    description: 'Build something genuinely new',
    bestFor: 'VC-backed, long runway, high risk tolerance',
    riskLevel: 'high',
    timeToRevenue: '12-24+ months'
  },
  copy_improve: {
    label: 'Copy & Improve',
    description: 'Take proven model, execute better',
    bestFor: 'Bootstrapped, income goals, proven demand',
    riskLevel: 'low',
    timeToRevenue: '3-6 months'
  },
  combine: {
    label: 'Combine',
    description: 'Merge two validated concepts',
    bestFor: 'Unique insight at intersection',
    riskLevel: 'medium',
    timeToRevenue: '6-12 months'
  },
  localize: {
    label: 'Localize',
    description: 'Proven model, new geography/segment',
    bestFor: 'Local market knowledge',
    riskLevel: 'low',
    timeToRevenue: '3-6 months'
  },
  specialize: {
    label: 'Specialize',
    description: 'Narrow general solution to niche',
    bestFor: 'Deep domain expertise',
    riskLevel: 'low',
    timeToRevenue: '4-8 months'
  },
  time: {
    label: 'Time',
    description: 'Retry failed concept, market now ready',
    bestFor: 'Timing insight, patience',
    riskLevel: 'high',
    timeToRevenue: 'Variable'
  }
};

// Valid status transitions
export const VALID_STATUS_TRANSITIONS: Record<IdeaStatus, IdeaStatus[]> = {
  active: ['paused', 'abandoned', 'completed'],
  paused: ['active', 'abandoned', 'archived'],
  abandoned: ['active', 'archived'],
  completed: ['archived'],
  archived: ['active']
};

// ============================================================================
// Gap Analysis Types
// ============================================================================

export const AssumptionCategorySchema = z.enum(['problem', 'solution', 'market', 'user', 'technical', 'execution']);
export type AssumptionCategory = z.infer<typeof AssumptionCategorySchema>;

export const AssumptionImpactSchema = z.enum(['critical', 'significant', 'minor']);
export type AssumptionImpact = z.infer<typeof AssumptionImpactSchema>;

export const AssumptionConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type AssumptionConfidence = z.infer<typeof AssumptionConfidenceSchema>;

export interface Assumption {
  id: string;
  text: string;
  category: AssumptionCategory;
  impact: AssumptionImpact;
  confidence: AssumptionConfidence;
  evidence?: string;
  addressed: boolean;
  addressedAt?: Date;
}

export interface GapAnalysis {
  assumptions: Assumption[];
  criticalGapsCount: number;
  significantGapsCount: number;
  readinessScore: number;  // 0-100, calculated from gaps
}

// Impact and confidence weights for prioritization
export const IMPACT_WEIGHTS: Record<AssumptionImpact, number> = {
  critical: 3,
  significant: 2,
  minor: 1
};

export const CONFIDENCE_WEIGHTS: Record<AssumptionConfidence, number> = {
  low: 3,      // Higher weight for low confidence (more urgent)
  medium: 2,
  high: 1
};

// ============================================================================
// Gap Suggestion Types
// ============================================================================

export type GapSuggestionSource = 'profile' | 'web_research' | 'synthesis';

export interface GapSuggestion {
  id: string;
  suggestion: string;
  rationale: string;
  tradeoffs: string[];
  confidence: number;  // 0-1
  source: GapSuggestionSource;
}

export type GapResolutionSource = 'suggestion_selected' | 'suggestion_modified' | 'user_provided' | 'skipped';

export interface GapResolution {
  gapId: string;
  resolution: string;
  source: GapResolutionSource;
  selectedSuggestionId?: string;
}

export interface IdeaContext {
  problem: string;
  solution: string;
  targetUser: string;
  currentAnswers: Record<string, string>;
}

export interface ProfileContext {
  // Basic fields
  goals?: string[];
  skills?: string[];
  network?: string[];
  constraints?: string[];
  interests?: string[];

  // Extended profile fields for richer context
  successDefinition?: string;
  motivations?: string;
  domainConnection?: string;
  professionalExperience?: string;
  domainExpertise?: string[];
  knownGaps?: string;
  industryConnections?: string[];
  professionalNetwork?: string;
  employmentStatus?: string;
  weeklyHoursAvailable?: number;
  riskTolerance?: string;

  // Financial context for positioning analysis
  currentAnnualIncome?: number;
  monthlyBurnRate?: number;
  runwayMonths?: number;
  hoursPerWeek?: number;
}

// ============================================================================
// Soft Gates / Advisory Types
// ============================================================================

export type ViabilityRecommendation = 'proceed' | 'research_more' | 'pause';

export interface ViabilityAdvisory {
  criticalGaps: Assumption[];
  significantGaps: Assumption[];
  readinessScore: number;
  recommendation: ViabilityRecommendation;
  reasoning: string;
}

export interface WeakCriterion {
  code: string;        // e.g., "P1", "S2"
  name: string;        // e.g., "Problem Clarity"
  score: number;       // 1-10
  confidence: number;  // 0-1
  addressable: boolean;
  suggestedAction: string;
}

export type EvaluationRecommendation = 'pursue' | 'iterate' | 'branch' | 'pause' | 'abandon';

export interface EvaluationAdvisory {
  overallScore: number;
  confidence: number;
  weakCriteria: WeakCriterion[];
  recommendation: EvaluationRecommendation;
  reasoning: string;
}

// Gate types
export type GateType = 'viability' | 'evaluation';

export interface GateDecision {
  id: string;
  ideaId: string;
  gateType: GateType;
  recommendation: string;
  userChoice: string;
  context: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// Versioning Types
// ============================================================================

export type VersionChangeType = 'initial' | 'post-clarify' | 'post-differentiation' | 'post-evaluation' | 'iteration' | 'manual';

export interface IdeaVersion {
  id: string;
  ideaId: string;
  versionNumber: number;
  iterationNumber: number;
  contentSnapshot: string;
  evaluationSnapshot?: string;
  phase: IncubationPhase;
  changeType: VersionChangeType;
  changeSummary?: string;
  createdAt: Date;
}

export interface ContentChange {
  field: string;
  before: string;
  after: string;
}

export interface ScoreChange {
  criterion: string;
  before: number;
  after: number;
  delta: number;
}

export interface VersionDiff {
  from: number;
  to: number;
  contentChanges: ContentChange[];
  scoreChanges?: ScoreChange[];
}

// ============================================================================
// Iteration Types
// ============================================================================

export interface IterationContext {
  iterationNumber: number;
  previousScore: number;
  triggerCriteria: string[];  // Criteria codes that were weak
  userDirection: string;      // What user wants to focus on
}

export interface IterationLog {
  id: string;
  ideaId: string;
  fromIteration: number;
  toIteration: number;
  triggerCriteria: string[];
  userDirection: string;
  previousScore: number;
  createdAt: Date;
}

// Criteria-to-question category mapping for focused iteration
export const CRITERIA_TO_QUESTION_CATEGORIES: Record<string, string[]> = {
  // Problem criteria
  'P1': ['problem_clarity', 'problem_scope'],
  'P2': ['problem_severity', 'problem_frequency'],
  'P3': ['target_user', 'user_segments'],
  'P4': ['problem_validation', 'user_interviews'],
  'P5': ['problem_uniqueness', 'existing_solutions'],

  // Solution criteria
  'S1': ['solution_clarity', 'solution_mechanism'],
  'S2': ['technical_approach', 'build_complexity'],
  'S3': ['solution_uniqueness', 'innovation'],
  'S4': ['scalability', 'growth_constraints'],
  'S5': ['defensibility', 'moats'],

  // Feasibility criteria
  'F1': ['technical_stack', 'technical_risks'],
  'F2': ['resource_requirements', 'costs'],
  'F3': ['skills_needed', 'team_gaps'],
  'F4': ['time_to_value', 'milestones'],
  'F5': ['dependencies', 'partnerships'],

  // Fit criteria
  'FT1': ['personal_goals', 'motivation'],
  'FT2': ['passion', 'interest_areas'],
  'FT3': ['skills_match', 'experience'],
  'FT4': ['network', 'connections'],
  'FT5': ['life_stage', 'availability'],

  // Market criteria
  'M1': ['market_size', 'market_segments'],
  'M2': ['market_growth', 'trends'],
  'M3': ['competitors', 'competitive_advantage'],
  'M4': ['entry_barriers', 'switching_costs'],
  'M5': ['market_timing', 'readiness'],

  // Risk criteria
  'R1': ['execution_risks', 'mitigation'],
  'R2': ['market_risks', 'demand_uncertainty'],
  'R3': ['technical_risks', 'unknowns'],
  'R4': ['financial_risks', 'runway'],
  'R5': ['regulatory_risks', 'compliance']
};

// ============================================================================
// Lineage Types
// ============================================================================

export interface IdeaSummary {
  id: string;
  slug: string;
  title: string;
  status: IdeaStatus;
  currentVersion: number;
  latestScore?: number;
  branchReason?: string;
}

export interface IdeaLineage {
  current: IdeaSummary;
  parent?: IdeaSummary;
  children: IdeaSummary[];
  ancestors: IdeaSummary[];  // Full parent chain to root
}

export type ParentAction = 'keep_active' | 'pause' | 'abandon';

export interface BranchRequest {
  parentIdeaId: string;
  newTitle: string;
  branchReason: string;
  parentAction: ParentAction;
}

// ============================================================================
// Differentiation Types
// ============================================================================

export type ImpactLevel = 'high' | 'medium' | 'low';
export type FeasibilityLevel = 'high' | 'medium' | 'low';

export interface Opportunity {
  description: string;
  targetSegment: string;
  potentialImpact: ImpactLevel;
  feasibility: FeasibilityLevel;
  // Extended 5W+H fields
  why?: string;           // Why this opportunity exists
  marketSize?: string;    // Estimated market size
  timing?: string;        // Why now is the right time
}

export interface FiveWH {
  what?: string;     // Exactly what to do/build/offer
  why?: string;      // Strategic rationale and value proposition
  how?: string;      // Step-by-step implementation approach
  when?: string;     // Timeline with key milestones
  where?: string;    // Target markets, channels, go-to-market
  howMuch?: string;  // Resource estimate and expected ROI
}

export interface Strategy {
  id?: string;             // Unique identifier
  name: string;
  description: string;
  differentiators: string[];
  tradeoffs: string[];
  fitWithProfile: number;  // 1-10
  fiveWH?: FiveWH;         // Comprehensive 5W+H breakdown
}

export interface Risk {
  description: string;
  likelihood: ImpactLevel;
  severity: ImpactLevel;
  mitigation?: string;
  competitors?: string[];  // Names of competitors posing this risk
  timeframe?: string;      // When this risk might materialize
}

export interface MarketTiming {
  currentWindow: string;
  urgency: ImpactLevel;
  keyTrends: string[];
  recommendation: string;
}

export interface DifferentiationAnalysis {
  marketOpportunities: Opportunity[];
  competitiveRisks: Risk[];
  differentiationStrategies: Strategy[];
  summary: string;
  marketTiming?: MarketTiming;  // Overall market timing analysis
}

// Validated versions with confidence ratings
export interface ValidatedOpportunity extends Opportunity {
  validationConfidence: number;  // 0-1
  validationWarnings: string[];  // Empty if no issues
  contradictions?: string[];     // Any conflicts with earlier findings
}

export interface ValidatedStrategy extends Strategy {
  validationConfidence: number;
  validationWarnings: string[];
  feasibilityCheck: {
    alignsWithSkills: boolean;
    alignsWithResources: boolean;
    alignsWithGoals: boolean;
    issues: string[];
  };
}

export interface ValidatedDifferentiationAnalysis {
  marketOpportunities: ValidatedOpportunity[];
  competitiveRisks: Risk[];  // Risks don't need validation
  differentiationStrategies: ValidatedStrategy[];
  summary: string;
  validationSummary: string;  // Overall validation notes
  overallConfidence: number;  // 0-1, average of all validations
}

// ============================================================================
// Status History Types
// ============================================================================

export interface StatusHistoryEntry {
  id: number;
  ideaId: string;
  fromStatus: IdeaStatus | null;
  toStatus: IdeaStatus;
  reason?: string;
  changedAt: Date;
}

// ============================================================================
// Extended Idea Type (with incubation fields)
// ============================================================================

export interface IdeaWithIncubation {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  ideaType: string;
  lifecycleStage: string;
  // Incubation fields
  status: IdeaStatus;
  statusReason?: string;
  statusChangedAt?: Date;
  currentVersion: number;
  iterationNumber: number;
  parentIdeaId?: string;
  branchReason?: string;
  incubationPhase: IncubationPhase;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  folderPath: string;
}

// ============================================================================
// Idea Financial Allocation Types (Per-Idea Resource Commitment)
// ============================================================================

export const AllocationPrioritySchema = z.enum(['primary', 'secondary', 'exploration', 'parked']);
export type AllocationPriority = z.infer<typeof AllocationPrioritySchema>;

export const IncomeTypeSchema = z.enum([
  'full_replacement',    // This idea replaces job
  'partial_replacement', // This idea + other income = target
  'supplement',          // Extra income on top
  'wealth_building',     // Equity play, income later
  'learning'             // Not income focused
]);
export type IncomeType = z.infer<typeof IncomeTypeSchema>;

export const PivotWillingnessSchema = z.enum(['rigid', 'moderate', 'flexible', 'very_flexible']);
export type PivotWillingness = z.infer<typeof PivotWillingnessSchema>;

export const IdeaFinancialAllocationSchema = z.object({
  id: z.string().uuid(),
  ideaId: z.string().uuid(),

  // Resource Allocation
  allocatedBudget: z.number().min(0).default(0),
  allocatedWeeklyHours: z.number().min(0).max(80).default(0),
  allocatedRunwayMonths: z.number().min(0).default(0),
  allocationPriority: AllocationPrioritySchema.default('exploration'),

  // Idea-Specific Goals
  targetIncomeFromIdea: z.number().min(0).optional(),
  incomeTimelineMonths: z.number().min(0).optional(),
  incomeType: IncomeTypeSchema.default('supplement'),
  exitIntent: z.boolean().default(false),

  // Idea-Specific Risk
  ideaRiskTolerance: z.enum(['low', 'medium', 'high', 'very_high']).optional(),
  maxAcceptableLoss: z.number().min(0).optional(),
  pivotWillingness: PivotWillingnessSchema.default('moderate'),

  // Validation Budget
  validationBudget: z.number().min(0).default(0),
  maxTimeToValidateMonths: z.number().min(0).optional(),
  killCriteria: z.string().optional(),

  // Strategic Approach (selected by user or recommended)
  strategicApproach: StrategicApproachSchema.optional(),
  approachRationale: z.string().optional(),

  // Timestamps
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export type IdeaFinancialAllocation = z.infer<typeof IdeaFinancialAllocationSchema>;

// Input schema for creating/updating allocation
export const IdeaFinancialAllocationInputSchema = IdeaFinancialAllocationSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type IdeaFinancialAllocationInput = z.infer<typeof IdeaFinancialAllocationInputSchema>;

// ============================================================================
// Positioning Decision Types (Captures user decisions for Update phase)
// ============================================================================

export const TimingDecisionSchema = z.enum(['proceed_now', 'wait', 'urgent']);
export type TimingDecision = z.infer<typeof TimingDecisionSchema>;

export const PositioningDecisionSchema = z.object({
  id: z.string().uuid(),
  ideaId: z.string().uuid(),

  // Strategy Selection
  primaryStrategyId: z.string().optional(),
  primaryStrategyName: z.string().optional(),
  secondaryStrategyId: z.string().optional(),
  secondaryStrategyName: z.string().optional(),

  // Risk Acknowledgment
  acknowledgedRiskIds: z.array(z.string()).default([]),

  // Timing Decision
  timingDecision: TimingDecisionSchema.optional(),
  timingRationale: z.string().optional(),

  // Strategic Approach
  selectedApproach: StrategicApproachSchema.optional(),

  // Notes
  notes: z.string().optional(),

  // Timestamps
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});

export type PositioningDecision = z.infer<typeof PositioningDecisionSchema>;

// ============================================================================
// Enhanced Strategy Types (with financial viability)
// ============================================================================

export interface RevenueEstimate {
  year1: { low: number; mid: number; high: number };
  year3: { low: number; mid: number; high: number };
  assumptions: string[];
}

export interface UnitEconomics {
  estimatedCAC: { low: number; high: number };
  estimatedLTV: { low: number; high: number };
  estimatedMargin: number;  // Percentage
  breakEvenCustomers: number;
}

export interface InvestmentRequired {
  upfront: { low: number; high: number };
  monthly: { low: number; high: number };
  timeToBreakEven: { low: number; high: number };  // Months
}

export interface GoalAlignment {
  meetsIncomeTarget: boolean;
  gapToTarget: number | null;
  timelineAlignment: 'faster' | 'aligned' | 'slower' | 'unlikely';
  runwaySufficient: boolean;
  investmentFeasible: boolean;
}

export interface ValidationStep {
  name: string;
  duration: string;
  cost: number;
  successCriteria: string;
  killCriteria: string;
}

export interface ValidationPlan {
  steps: ValidationStep[];
  totalCost: number;
  totalDuration: string;
}

export interface Reversibility {
  score: number;  // 1-10
  pivotOptions: string[];
  sunkCostAtMonth6: number;
  transferableAssets: string[];
}

export interface ExecutionComplexity {
  score: number;  // 1-10
  soloFounderFeasibility: number;  // 1-10
  criticalDependencies: string[];
  teamSizeRecommendation: string;
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
    type: 'increase_allocation' | 'reduce_scope' | 'extend_timeline' | 'seek_funding';
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

// Enhanced Strategy with financial analysis
export interface EnhancedStrategy extends Strategy {
  // Relationship tracking
  addressesOpportunities: string[];
  mitigatesRisks: string[];
  timingAlignment: 'favorable' | 'neutral' | 'challenging';

  // Financial analysis
  revenueEstimates?: RevenueEstimate;
  unitEconomics?: UnitEconomics;
  investmentRequired?: InvestmentRequired;
  goalAlignment?: GoalAlignment;
  validationPlan?: ValidationPlan;
  reversibility?: Reversibility;
  executionComplexity?: ExecutionComplexity;
  allocationFeasibility?: AllocationFeasibility;

  // Profile fit details
  profileFitBreakdown?: ProfileFitBreakdown;
}

// Strategic Summary (always visible at top)
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
    fit: 'high' | 'medium' | 'low';
  };
  criticalRisk: {
    id: string;
    description: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  };
  timingAssessment: {
    urgency: 'high' | 'medium' | 'low';
    window: string;
  };
  overallConfidence: number;
}

// Enhanced Positioning Analysis (replaces DifferentiationAnalysis)
export interface PositioningAnalysis {
  strategicApproach: StrategicApproach;
  strategicSummary: StrategicSummary;
  marketOpportunities: ValidatedOpportunity[];
  competitiveRisks: Risk[];
  strategies: EnhancedStrategy[];
  marketTiming?: MarketTiming;
  summary: string;
  overallConfidence: number;
}
