import { z } from "zod";

// Helper to coerce Date to string
const dateToString = z.preprocess((val) => {
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  return val;
}, z.string());

// Idea frontmatter schema
export const IdeaFrontmatterSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: z.enum(["business", "creative", "technical", "personal", "research"]),
  stage: z.enum([
    "SPARK",
    "CLARIFY",
    "RESEARCH",
    "IDEATE",
    "EVALUATE",
    "VALIDATE",
    "DESIGN",
    "PROTOTYPE",
    "TEST",
    "REFINE",
    "BUILD",
    "LAUNCH",
    "GROW",
    "MAINTAIN",
    "PIVOT",
    "PAUSE",
    "SUNSET",
    "ARCHIVE",
    "ABANDONED",
  ]),
  created: dateToString,
  updated: dateToString.optional(),
  tags: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
  summary: z.string().optional(),
});

export type IdeaFrontmatter = z.infer<typeof IdeaFrontmatterSchema>;

// Lifecycle stages
export const LifecycleStageSchema = z.enum([
  "SPARK",
  "CLARIFY",
  "RESEARCH",
  "IDEATE",
  "EVALUATE",
  "VALIDATE",
  "DESIGN",
  "PROTOTYPE",
  "TEST",
  "REFINE",
  "BUILD",
  "LAUNCH",
  "GROW",
  "MAINTAIN",
  "PIVOT",
  "PAUSE",
  "SUNSET",
  "ARCHIVE",
  "ABANDONED",
]);

export type LifecycleStage = z.infer<typeof LifecycleStageSchema>;

// Idea types
export const IdeaTypeSchema = z.enum([
  "business",
  "creative",
  "technical",
  "personal",
  "research",
]);
export type IdeaType = z.infer<typeof IdeaTypeSchema>;

// Evaluation categories
export const EvaluationCategorySchema = z.enum([
  "problem",
  "solution",
  "feasibility",
  "fit",
  "market",
  "risk",
]);
export type EvaluationCategory = z.infer<typeof EvaluationCategorySchema>;

// Single criterion evaluation
export const CriterionEvaluationSchema = z.object({
  criterion: z.string(),
  category: EvaluationCategorySchema,
  score: z.number().min(1).max(10),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export type CriterionEvaluation = z.infer<typeof CriterionEvaluationSchema>;

// Full evaluation response from agent
export const EvaluationResponseSchema = z.object({
  evaluations: z.array(CriterionEvaluationSchema),
});

export type EvaluationResponse = z.infer<typeof EvaluationResponseSchema>;

// Arbiter verdict
export const ArbiterVerdictSchema = z.object({
  verdict: z.enum(["EVALUATOR", "RED_TEAM", "DRAW"]),
  reasoning: z.string(),
  firstPrinciplesBonus: z.boolean(),
  scoreAdjustment: z.number().min(-3).max(3),
});

export type ArbiterVerdict = z.infer<typeof ArbiterVerdictSchema>;

// Red team personas
export const RedTeamPersonaSchema = z.enum([
  "skeptic",
  "realist",
  "first-principles",
  "competitor",
  "contrarian",
  "edge-case",
]);

export type RedTeamPersona = z.infer<typeof RedTeamPersonaSchema>;

// Red team challenge
export const ChallengeSchema = z.object({
  persona: RedTeamPersonaSchema,
  criterion: z.string(),
  challenge: z.string(),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR"]).optional(),
});

export type Challenge = z.infer<typeof ChallengeSchema>;

// Synthesis output
export const SynthesisOutputSchema = z.object({
  executiveSummary: z.string(),
  keyStrengths: z.array(z.string()),
  keyWeaknesses: z.array(z.string()),
  criticalAssumptions: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
  recommendation: z.enum(["PURSUE", "REFINE", "PAUSE", "ABANDON"]),
  recommendationReasoning: z.string(),
});

export type SynthesisOutput = z.infer<typeof SynthesisOutputSchema>;

// Convergence state
export const ConvergenceStateSchema = z.object({
  round: z.number(),
  hasConverged: z.boolean(),
  reason: z
    .enum(["SCORE_STABILITY", "MAX_ROUNDS", "TIMEOUT", "BUDGET_EXCEEDED"])
    .optional(),
});

export type ConvergenceState = z.infer<typeof ConvergenceStateSchema>;

// Development question
export const DevelopmentQuestionSchema = z.object({
  category: z.enum(["user", "problem", "solution", "market", "execution"]),
  question: z.string(),
  priority: z.enum(["critical", "important", "nice-to-have"]),
});

export type DevelopmentQuestion = z.infer<typeof DevelopmentQuestionSchema>;

// Relationship types
export const RelationshipTypeSchema = z.enum([
  "parent",
  "child",
  "related",
  "combines",
  "conflicts",
  "inspired_by",
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

// Idea relationship
export const IdeaRelationshipSchema = z.object({
  sourceSlug: z.string(),
  targetSlug: z.string(),
  type: RelationshipTypeSchema,
  strength: z.enum(["strong", "medium", "weak"]).optional(),
  notes: z.string().optional(),
});

export type IdeaRelationship = z.infer<typeof IdeaRelationshipSchema>;

// ==========================================
// USER PROFILE SCHEMAS (Personal Fit Context)
// ==========================================

// Primary goal types for FT1
export const PrimaryGoalSchema = z.enum([
  "income", // Revenue/salary generation
  "impact", // Making a difference
  "learning", // Skill development
  "portfolio", // Building credentials
  "lifestyle", // Work-life balance
  "exit", // Building to sell
  "passion", // Pursuing interest
  "legacy", // Long-term contribution
]);

export type PrimaryGoal = z.infer<typeof PrimaryGoalSchema>;

// Employment status for FT5
export const EmploymentStatusSchema = z.enum([
  "employed",
  "self-employed",
  "unemployed",
  "student",
  "retired",
]);

export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

// Risk tolerance for FT5
export const RiskToleranceSchema = z.enum([
  "low",
  "medium",
  "high",
  "very_high",
]);

export type RiskTolerance = z.infer<typeof RiskToleranceSchema>;

// Industry connection with depth
export const IndustryConnectionSchema = z.object({
  industry: z.string(),
  depth: z.enum(["deep", "moderate", "surface"]),
  description: z.string().optional(),
});

export type IndustryConnection = z.infer<typeof IndustryConnectionSchema>;

// Debt tolerance level
export const DebtToleranceSchema = z.enum(["none", "low", "moderate", "high"]);
export type DebtTolerance = z.infer<typeof DebtToleranceSchema>;

// Full user profile schema
export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),

  // FT1: Personal Goals
  primaryGoals: z.array(PrimaryGoalSchema).min(1),
  successDefinition: z.string().optional(),

  // FT2: Passion & Motivation
  interests: z.array(z.string()).default([]),
  motivations: z.string().optional(),
  domainConnection: z.string().optional(),

  // FT3: Skills & Experience
  technicalSkills: z.array(z.string()).default([]),
  professionalExperience: z.string().optional(),
  domainExpertise: z.array(z.string()).default([]),
  knownGaps: z.string().optional(),

  // FT4: Network & Connections
  industryConnections: z.array(IndustryConnectionSchema).default([]),
  professionalNetwork: z.string().optional(),
  communityAccess: z.array(z.string()).default([]),
  partnershipPotential: z.string().optional(),

  // FT5: Life Stage & Capacity
  employmentStatus: EmploymentStatusSchema.optional(),
  weeklyHoursAvailable: z.number().min(0).max(80).optional(),
  financialRunwayMonths: z.number().min(0).optional(),
  riskTolerance: RiskToleranceSchema.optional(),
  otherCommitments: z.string().optional(),

  // Extended Financial Fields (Portfolio Level)
  currentAnnualIncome: z.number().min(0).optional(),
  monthlyBurnRate: z.number().min(0).optional(),
  hasAlternativeIncome: z.boolean().optional(),
  totalInvestmentCapacity: z.number().min(0).optional(),
  debtTolerance: DebtToleranceSchema.optional(),
  willingnessToRaiseFunding: z.boolean().optional(),
  lifestyleIncomeTarget: z.number().min(0).optional(),

  // Geographic Location (for market analysis)
  country: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),

  // Timestamps
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// Idea-specific profile link with overrides
export const IdeaProfileLinkSchema = z.object({
  ideaId: z.string().uuid(),
  profileId: z.string().uuid(),
  goalsOverride: z.array(PrimaryGoalSchema).optional(),
  passionNotes: z.string().optional(),
  relevantSkills: z.array(z.string()).optional(),
  relevantNetwork: z.string().optional(),
  timeCommitment: z.string().optional(),
  linkedAt: z.string().optional(),
});

export type IdeaProfileLink = z.infer<typeof IdeaProfileLinkSchema>;

// Profile creation input (for capture flow)
export const ProfileInputSchema = z.object({
  name: z.string().min(1),

  // FT1: Goals (required)
  primaryGoals: z.array(PrimaryGoalSchema).min(1),
  successDefinition: z.string().optional(),

  // FT2: Passion (at least interests or motivations)
  interests: z.array(z.string()).optional(),
  motivations: z.string().optional(),
  domainConnection: z.string().optional(),

  // FT3: Skills
  technicalSkills: z.array(z.string()).optional(),
  professionalExperience: z.string().optional(),
  domainExpertise: z.array(z.string()).optional(),
  knownGaps: z.string().optional(),

  // FT4: Network
  industryConnections: z.array(IndustryConnectionSchema).optional(),
  professionalNetwork: z.string().optional(),
  communityAccess: z.array(z.string()).optional(),
  partnershipPotential: z.string().optional(),

  // FT5: Life Stage
  employmentStatus: EmploymentStatusSchema.optional(),
  weeklyHoursAvailable: z.number().min(0).max(80).optional(),
  financialRunwayMonths: z.number().min(0).optional(),
  riskTolerance: RiskToleranceSchema.optional(),
  otherCommitments: z.string().optional(),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

// Formatted profile context for evaluator prompts
export const ProfileContextSchema = z.object({
  // Summaries for each FT criterion
  goalsContext: z.string(), // For FT1
  passionContext: z.string(), // For FT2
  skillsContext: z.string(), // For FT3
  networkContext: z.string(), // For FT4
  lifeStageContext: z.string(), // For FT5

  // Raw data for detailed evaluation
  profile: UserProfileSchema.optional(),
  ideaOverrides: IdeaProfileLinkSchema.optional(),
});

export type ProfileContext = z.infer<typeof ProfileContextSchema>;

// Import needed for parse error
import { EvaluationParseError } from "./errors.js";

// Helper to safely parse JSON responses from agents
export function parseAgentResponse<T>(
  text: string,
  schema: z.ZodType<T>,
  context: string,
): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new EvaluationParseError(
      `Could not extract JSON from ${context} response`,
    );
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new EvaluationParseError(
        `Invalid ${context} response: ${error.errors.map((e) => e.message).join(", ")}`,
      );
    }
    throw error;
  }
}
